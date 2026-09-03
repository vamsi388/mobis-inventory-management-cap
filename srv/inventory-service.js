const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { SpareParts, Locations, Inventory, StockMovements, AlertNotifications } =
    this.entities;
  // ApplicationLogs lives in the db namespace, not exposed via this service's
  // API, so we reach it through the CDS reflection model rather than
  // this.entities (which only lists entities this service projects).
  const { ApplicationLogs } = cds.entities('mobis.db');

  // Shared helper: fetch (or lazily create) the Inventory row for a
  // part/location pair. In enterprise MM terms this is the equivalent of
  // reading MARD (storage-location stock) before posting a material doc.
  async function getInventoryRow(tx, partID, locationID) {
    let row = await tx.run(
      SELECT.one.from(Inventory).where({ part_ID: partID, location_ID: locationID })
    );
    if (!row) {
      // First movement ever for this part at this location — initialize at 0
      // rather than erroring, since "no row yet" and "zero stock" are the
      // same business fact.
      await tx.run(
        INSERT.into(Inventory).entries({ part_ID: partID, location_ID: locationID, quantityOnHand: 0 })
      );
      row = { part_ID: partID, location_ID: locationID, quantityOnHand: 0, reorderLevel: null };
    }
    return row;
  }

  async function raiseLowStockAlertIfNeeded(tx, part, locationID, newQty) {
    const effectiveReorderLevel =
      (await tx.run(SELECT.one.from(Inventory).where({ part_ID: part.ID, location_ID: locationID })))
        ?.reorderLevel ?? part.reorderLevel;

    if (newQty < effectiveReorderLevel) {
      await tx.run(
        INSERT.into(AlertNotifications).entries({
          alertType: 'LOW_STOCK',
          part_ID: part.ID,
          location_ID: locationID,
          message: `Part ${part.partNumber} at location fell to ${newQty}, below reorder level ${effectiveReorderLevel}.`,
          severity: newQty <= (part.safetyStock ?? 0) ? 'HIGH' : 'MEDIUM',
        })
      );
    }
  }

  // issueStock — validations mirror your spec exactly:
  //   1. part exists   2. location exists   3. qty > 0
  //   4. sufficient available stock (never allow negative inventory)
  this.on('issueStock', async (req) => {
    const { partID, locationID, quantity, reference } = req.data;
    const tx = cds.transaction(req);

    if (!(quantity > 0)) {
      return req.error(400, 'Quantity must be a positive number.');
    }

    const part = await tx.run(SELECT.one.from(SpareParts).where({ ID: partID }));
    if (!part) return req.error(404, `Spare part ${partID} does not exist.`);

    const location = await tx.run(SELECT.one.from(Locations).where({ ID: locationID }));
    if (!location) return req.error(404, `Location ${locationID} does not exist.`);

    const invRow = await getInventoryRow(tx, partID, locationID);
    if (invRow.quantityOnHand < quantity) {
      // Log the failed attempt — this is what your spec calls "application logging"
      await tx.run(
        INSERT.into(ApplicationLogs).entries({
          layer: 'InventoryService',
          operation: 'issueStock',
          message: `Insufficient stock: requested ${quantity}, available ${invRow.quantityOnHand} for part ${partID} at ${locationID}.`,
          severity: 'WARNING',
        })
      );
      return req.error(
        409,
        `Insufficient stock. Available: ${invRow.quantityOnHand}, requested: ${quantity}.`
      );
    }

    const newQty = invRow.quantityOnHand - quantity;

    await tx.run(
      UPDATE(Inventory)
        .set({ quantityOnHand: newQty, lastMovementAt: new Date().toISOString() })
        .where({ part_ID: partID, location_ID: locationID })
    );

    await tx.run(
      INSERT.into(StockMovements).entries({
        movementType: 'ISSUE',
        part_ID: partID,
        fromLocation_ID: locationID,
        quantity,
        reference,
        status: 'POSTED',
      })
    );

    await raiseLowStockAlertIfNeeded(tx, part, locationID, newQty);

    return SELECT.one.from(StockMovements).where({ part_ID: partID, reference });
  });

  // transferStock — same guard rails as issue, applied to the SOURCE
  // location, plus a mandatory increment on the TARGET location.
  // Modeled as ONE ledger row with both fromLocation and toLocation set,
  // not two rows — this preserves the semantic "this was one transfer",
  // which matters when you reconcile movements later.
  this.on('transferStock', async (req) => {
    const { partID, fromLocationID, toLocationID, quantity, reference } = req.data;
    const tx = cds.transaction(req);

    if (!(quantity > 0)) return req.error(400, 'Quantity must be positive.');
    if (fromLocationID === toLocationID)
      return req.error(400, 'Source and target location must differ.');

    const part = await tx.run(SELECT.one.from(SpareParts).where({ ID: partID }));
    if (!part) return req.error(404, `Spare part ${partID} does not exist.`);

    for (const locID of [fromLocationID, toLocationID]) {
      const loc = await tx.run(SELECT.one.from(Locations).where({ ID: locID }));
      if (!loc) return req.error(404, `Location ${locID} does not exist.`);
    }

    const sourceRow = await getInventoryRow(tx, partID, fromLocationID);
    if (sourceRow.quantityOnHand < quantity) {
      return req.error(
        409,
        `Insufficient stock at source. Available: ${sourceRow.quantityOnHand}, requested: ${quantity}.`
      );
    }
    const targetRow = await getInventoryRow(tx, partID, toLocationID);

    const newSourceQty = sourceRow.quantityOnHand - quantity;
    const newTargetQty = targetRow.quantityOnHand + quantity;
    const now = new Date().toISOString();

    await tx.run(
      UPDATE(Inventory)
        .set({ quantityOnHand: newSourceQty, lastMovementAt: now })
        .where({ part_ID: partID, location_ID: fromLocationID })
    );
    await tx.run(
      UPDATE(Inventory)
        .set({ quantityOnHand: newTargetQty, lastMovementAt: now })
        .where({ part_ID: partID, location_ID: toLocationID })
    );

    await tx.run(
      INSERT.into(StockMovements).entries({
        movementType: 'TRANSFER',
        part_ID: partID,
        fromLocation_ID: fromLocationID,
        toLocation_ID: toLocationID,
        quantity,
        reference,
        status: 'POSTED',
      })
    );

    await raiseLowStockAlertIfNeeded(tx, part, fromLocationID, newSourceQty);

    return SELECT.one
      .from(StockMovements)
      .where({ part_ID: partID, fromLocation_ID: fromLocationID, toLocation_ID: toLocationID })
      .orderBy('createdAt desc');
  });

  this.on('getAvailableStock', async (req) => {
    const { partID, locationID } = req.data;
    const row = await SELECT.one.from(Inventory).where({ part_ID: partID, location_ID: locationID });
    return row ? row.quantityOnHand : 0;
  });
});
