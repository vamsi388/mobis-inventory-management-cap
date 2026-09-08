sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], (JSONModel, MessageToast, MessageBox, Fragment) => {
    "use strict";

    return {

        onRefreshGRs() {
            this._refreshTable("grTable");
        },

        async onPostGR() {

            if (!this._pPostGRDialog) {

                this._pPostGRDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "procurement.fragments.PostGR",
                    controller: this
                }).then((oDialog) => {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                });
            }

            this.getView().setModel(new JSONModel({ items: [] }), "grItems");

            (await this._pPostGRDialog).open();
        },

        async onGRPoChange(oEvent) {

            const sPoId = oEvent.getSource().getSelectedKey();

            if (!sPoId) {
                return;
            }

            try {

                const oResponse = await fetch(
                    `/procurement/PurchaseOrderItems?$filter=po_ID eq ${encodeURIComponent(sPoId)}`
                );

                if (!oResponse.ok) {
                    throw new Error(`HTTP ${oResponse.status}`);
                }

                const oData = await oResponse.json();

                const aItems = (oData.value || []).map((i) => ({
                    poItemID: i.ID,
                    orderedQty: i.orderedQty,
                    receivedQty: i.receivedQty,
                    receiveNow: 0
                }));

                const oModel = this.getView().getModel("grItems");

                if (oModel) {
                    oModel.setProperty("/items", aItems);
                }

            } catch (e) {

                MessageBox.error("Unable to load PO items: " + e.message);
            }
        },

        onCancelGRDialog() {

            const oDialog = this.byId("postGRDialog");

            if (oDialog) {
                oDialog.close();
            }
        },

        async onSubmitGR() {

            const oPoSelect = this.byId("grPoSelect");
            const oLocationInput = this.byId("grLocationInput");
            const oReceivedByInput = this.byId("grReceivedByInput");

            if (!oPoSelect || !oLocationInput || !oReceivedByInput) {
                MessageBox.error("Goods Receipt dialog controls could not be found.");
                return;
            }

            const sPoId = oPoSelect.getSelectedKey();
            const sLocationId = oLocationInput.getValue();
            const sReceivedBy = oReceivedByInput.getValue();

            const oItemsModel = this.getView().getModel("grItems");
            const aItems = oItemsModel ? oItemsModel.getProperty("/items") : [];

            const aSubmitItems = aItems
                .filter((i) => parseInt(i.receiveNow, 10) > 0)
                .map((i) => ({
                    poItemID: i.poItemID,
                    receivedQty: parseInt(i.receiveNow, 10)
                }));

            if (!sPoId || !sLocationId || !sReceivedBy || !aSubmitItems.length) {
                MessageToast.show("Select a PO, fill Location/Received By, and enter at least one receive quantity.");
                return;
            }

            try {

                await this._callAction("postGoodsReceipt", {
                    poID: sPoId,
                    locationID: sLocationId,
                    receivedBy: sReceivedBy,
                    items: aSubmitItems
                });

                MessageToast.show("Goods Receipt posted.");

                const oDialog = this.byId("postGRDialog");

                if (oDialog) {
                    oDialog.close();
                }

                this._refreshTable("grTable");
                this._refreshTable("poTable");
                this._loadCounts();

            } catch (e) {

                MessageBox.error(e.message);
            }
        }
    };
});