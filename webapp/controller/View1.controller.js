sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "../model/formatter"
], (Controller, JSONModel, MessageToast, MessageBox, Fragment, formatter) => {
    "use strict";

    return Controller.extend("procurement.controller.View1", {

        formatter,

        onInit() {
            this.getView().setModel(new JSONModel({
                busy: false,
                counts: { prTotal: 0, prPending: 0, poOpen: 0, alertsOpen: 0 }
            }), "view");
            this._loadCounts();
        },

        onTabSelect() {
            this._loadCounts();
        },

        // ---------- Generic OData action call helper ----------
        async _callAction(sActionName, oParams) {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);
            try {
                const oResponse = await fetch(`/procurement/${sActionName}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(oParams || {})
                });
                const oResult = await oResponse.json().catch(() => ({}));
                if (!oResponse.ok) {
                    const sMsg = oResult?.error?.message || `${sActionName} failed (HTTP ${oResponse.status})`;
                    throw new Error(sMsg);
                }
                return oResult;
            } finally {
                oViewModel.setProperty("/busy", false);
            }
        },

        async _loadCounts() {
            const oModel = this.getView().getModel();
            const oViewModel = this.getView().getModel("view");
            try {
                const [prTotal, prPending, poOpen, alertsOpen] = await Promise.all([
                    this._count(oModel, "PurchaseRequisitions"),
                    this._count(oModel, "PurchaseRequisitions", "status eq 'SUBMITTED'"),
                    this._count(oModel, "PurchaseOrders", "status ne 'RECEIVED' and status ne 'CLOSED' and status ne 'CANCELLED'"),
                    this._count(oModel, "AlertNotifications", "isResolved eq false")
                ]);
                oViewModel.setProperty("/counts", { prTotal, prPending, poOpen, alertsOpen });
            } catch (e) { /* dashboard counts are best-effort */ }
        },

        async _count(oModel, sEntitySet, sFilter) {
            const sUrl = `/procurement/${sEntitySet}/$count${sFilter ? "?$filter=" + encodeURIComponent(sFilter) : ""}`;
            const oResp = await fetch(sUrl, { headers: { Accept: "text/plain" } });
            return parseInt(await oResp.text(), 10) || 0;
        },

        _refreshTable(sId) {
            const oTable = this.byId(sId);
            if (oTable) oTable.getBinding("items").refresh();
        },
        onRefreshPRs() { this._refreshTable("prTable"); this._loadCounts(); },
        onRefreshPOs() { this._refreshTable("poTable"); this._loadCounts(); },
        onRefreshGRs() { this._refreshTable("grTable"); },
        onRefreshSuppliers() { MessageToast.show("Suppliers refreshed"); },
        onRefreshAlerts() { this._refreshTable("alertsTable"); this._loadCounts(); },

        // ---------- Purchase Requisitions ----------
        async onCreatePR() {
            if (!this._pCreatePRDialog) {
                this._pCreatePRDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "procurement.fragments.CreatePR",
                    controller: this
                }).then((oDialog) => {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                });
            }
            this.getView().setModel(new JSONModel({ items: [] }), "prItems");
            (await this._pCreatePRDialog).open();
        },

        onAddPRItemRow() {
            const oModel = this.getView().getModel("prItems");
            const aItems = oModel.getProperty("/items");
            aItems.push({ partId: "", requiredQty: 1, supplierId: "", estimatedPrice: 0 });
            oModel.setProperty("/items", aItems);
        },

        onRemovePRItemRow(oEvent) {
            const oCtx = oEvent.getSource().getParent().getBindingContext("prItems");
            const oModel = this.getView().getModel("prItems");
            const aItems = oModel.getProperty("/items");
            aItems.splice(oCtx.getPath().split("/").pop(), 1);
            oModel.setProperty("/items", aItems);
        },

        onCancelPRDialog() { this.byId("createPRDialog").close(); },

        async onSavePR() {
            const sLocationId = this.byId("prLocationInput").getValue();
            const sRequestedBy = this.byId("prRequestedByInput").getValue();
            const aItems = this.getView().getModel("prItems").getProperty("/items");

            if (!sLocationId || !sRequestedBy || !aItems.length) {
                MessageToast.show("Please fill Location, Requested By, and add at least one item.");
                return;
            }

            const oModel = this.getView().getModel();
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);
            try {
                const oListBinding = oModel.bindList("/PurchaseRequisitions");
                const oContext = oListBinding.create({
                    location_ID: sLocationId,
                    requestedBy: sRequestedBy,
                    status: "DRAFT",
                    items: aItems.map((i) => ({
                        part_ID: i.partId,
                        requiredQty: parseInt(i.requiredQty, 10),
                        supplier_ID: i.supplierId || null,
                        estimatedPrice: parseFloat(i.estimatedPrice) || 0
                    }))
                });
                await oContext.created();
                MessageToast.show("Purchase Requisition created as DRAFT.");
                this.byId("createPRDialog").close();
                this._refreshTable("prTable");
                this._loadCounts();
            } catch (e) {
                MessageBox.error("Could not create PR: " + e.message);
            } finally {
                oViewModel.setProperty("/busy", false);
            }
        },

        async onSubmitPR(oEvent) {
            const oCtx = oEvent.getSource().getBindingContext();
            try {
                await this._callAction("submitPR", { prID: oCtx.getProperty("ID") });
                MessageToast.show("PR submitted for approval.");
                this._refreshTable("prTable");
                this._loadCounts();
            } catch (e) { MessageBox.error(e.message); }
        },

        onApprovePR(oEvent) {
            const oCtx = oEvent.getSource().getBindingContext();
            MessageBox.confirm("Enter approver name to approve this PR.", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;
                    try {
                        await this._callAction("approvePR", { prID: oCtx.getProperty("ID"), approver: "Inventory Manager" });
                        MessageToast.show("PR approved.");
                        this._refreshTable("prTable");
                        this._loadCounts();
                    } catch (e) { MessageBox.error(e.message); }
                }
            });
        },

        onRejectPR(oEvent) {
            const oCtx = oEvent.getSource().getBindingContext();
            MessageBox.confirm("Reject this PR?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;
                    try {
                        await this._callAction("rejectPR", {
                            prID: oCtx.getProperty("ID"),
                            approver: "Inventory Manager",
                            reason: "Rejected via Procurement app"
                        });
                        MessageToast.show("PR rejected.");
                        this._refreshTable("prTable");
                        this._loadCounts();
                    } catch (e) { MessageBox.error(e.message); }
                }
            });
        },

        async onCreatePOFromPR(oEvent) {
            const oCtx = oEvent.getSource().getBindingContext();
            try {
                const aPOs = await this._callAction("createPOFromPR", { prID: oCtx.getProperty("ID") });
                MessageToast.show(`Created ${Array.isArray(aPOs) ? aPOs.length : 1} Purchase Order(s).`);
                this._refreshTable("prTable");
                this._refreshTable("poTable");
                this._loadCounts();
            } catch (e) { MessageBox.error(e.message); }
        },

        // ---------- Goods Receipt ----------
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
            if (!sPoId) return;
            const oResp = await fetch(`/procurement/PurchaseOrderItems?$filter=po_ID eq ${sPoId}`);
            const oData = await oResp.json();
            const aItems = (oData.value || []).map((i) => ({
                poItemID: i.ID,
                orderedQty: i.orderedQty,
                receivedQty: i.receivedQty,
                receiveNow: 0
            }));
            this.getView().getModel("grItems").setProperty("/items", aItems);
        },

        onCancelGRDialog() { this.byId("postGRDialog").close(); },

        async onSubmitGR() {
            const sPoId = this.byId("grPoSelect").getSelectedKey();
            const sLocationId = this.byId("grLocationInput").getValue();
            const sReceivedBy = this.byId("grReceivedByInput").getValue();
            const aItems = this.getView().getModel("grItems").getProperty("/items")
                .filter((i) => parseInt(i.receiveNow, 10) > 0)
                .map((i) => ({ poItemID: i.poItemID, receivedQty: parseInt(i.receiveNow, 10) }));

            if (!sPoId || !sLocationId || !sReceivedBy || !aItems.length) {
                MessageToast.show("Select a PO, fill Location/Received By, and enter at least one receive quantity.");
                return;
            }

            try {
                await this._callAction("postGoodsReceipt", {
                    poID: sPoId,
                    locationID: sLocationId,
                    receivedBy: sReceivedBy,
                    items: aItems
                });
                MessageToast.show("Goods Receipt posted.");
                this.byId("postGRDialog").close();
                this._refreshTable("grTable");
                this._refreshTable("poTable");
            } catch (e) { MessageBox.error(e.message); }
        },

        // ---------- Alerts ----------
        async onResolveAlert(oEvent) {
            const oCtx = oEvent.getSource().getBindingContext();
            try {
                await this._callAction("resolveAlert", { alertID: oCtx.getProperty("ID") });
                MessageToast.show("Alert resolved.");
                this._refreshTable("alertsTable");
                this._loadCounts();
            } catch (e) { MessageBox.error(e.message); }
        }
    });
});