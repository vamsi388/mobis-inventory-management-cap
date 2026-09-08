sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], (JSONModel, MessageToast, MessageBox, Fragment) => {
    "use strict";

    return {

        onRefreshPRs() {
            this._refreshTable("prTable");
            this._loadCounts();
        },

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

            aItems.push({
                partId: "",
                requiredQty: 1,
                supplierId: "",
                unitPrice: 0,
                estimatedPrice: 0
            });

            oModel.setProperty("/items", aItems);
        },

        onPRItemPartChange(oEvent) {

            const sPartId = oEvent.getParameter("selectedItem")
                ? oEvent.getParameter("selectedItem").getKey()
                : oEvent.getSource().getSelectedKey();

            if (!sPartId) {
                return;
            }

            const oContext = oEvent.getSource().getBindingContext("prItems");

            if (!oContext) {
                return;
            }

            const oInventoryModel = this.getView().getModel("inventory");
            const oPartsBinding = oInventoryModel.bindContext(`/SpareParts('${sPartId}')`);

            oPartsBinding.requestObject().then((oPart) => {

                const oItemsModel = this.getView().getModel("prItems");
                const fUnitPrice = oPart.unitPrice || 0;
                const iQty = parseInt(oItemsModel.getProperty(oContext.getPath() + "/requiredQty"), 10) || 0;

                oItemsModel.setProperty(oContext.getPath() + "/unitPrice", fUnitPrice);
                oItemsModel.setProperty(oContext.getPath() + "/estimatedPrice", fUnitPrice * iQty);

                if (oPart.preferredSupplier_ID) {
                    oItemsModel.setProperty(oContext.getPath() + "/supplierId", oPart.preferredSupplier_ID);
                }

            }).catch(() => {
                // part lookup failed — leave price as-is
            });
        },

        onPRItemQtyChange(oEvent) {

            const oContext = oEvent.getSource().getBindingContext("prItems");

            if (!oContext) {
                return;
            }

            const oItemsModel = this.getView().getModel("prItems");
            const fUnitPrice = oItemsModel.getProperty(oContext.getPath() + "/unitPrice") || 0;
            const iQty = parseInt(oEvent.getParameter("value"), 10) || 0;

            oItemsModel.setProperty(oContext.getPath() + "/estimatedPrice", fUnitPrice * iQty);
        },

        onRemovePRItemRow(oEvent) {

            const oContext = oEvent.getSource().getParent().getBindingContext("prItems");

            if (!oContext) {
                return;
            }

            const oModel = this.getView().getModel("prItems");
            const aItems = oModel.getProperty("/items");

            const iIndex = parseInt(oContext.getPath().split("/").pop(), 10);

            if (Number.isNaN(iIndex)) {
                return;
            }

            aItems.splice(iIndex, 1);

            oModel.setProperty("/items", aItems);
        },

        onCancelPRDialog() {

            const oDialog = this.byId("createPRDialog");

            if (oDialog) {
                oDialog.close();
            }

            this._oEditingPRContext = null;
        },

        async onEditPR(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            this._oEditingPRContext = oContext;

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

            const oDialog = await this._pCreatePRDialog;

            const oLocationInput = this.byId("prLocationInput");
            const oRequestedByInput = this.byId("prRequestedByInput");

            oLocationInput.setSelectedKey(oContext.getProperty("location_ID"));
            oRequestedByInput.setSelectedKey(oContext.getProperty("requestedBy"));

            const oItemsResponse = await fetch(
                `/procurement/PurchaseRequisitionItems?$filter=pr_ID eq ${encodeURIComponent(oContext.getProperty("ID"))}`
            );

            const oItemsData = await oItemsResponse.json();

            const aItems = (oItemsData.value || []).map((i) => ({
                partId: i.part_ID,
                requiredQty: i.requiredQty,
                supplierId: i.supplier_ID || "",
                unitPrice: 0,
                estimatedPrice: i.estimatedPrice
            }));

            this.getView().setModel(new JSONModel({ items: aItems }), "prItems");

            oDialog.open();
        },

        onDeletePR(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            MessageBox.confirm(
                `Delete Purchase Requisition ${oContext.getProperty("prNumber")}? `,
                {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: async (sAction) => {

                        if (sAction !== MessageBox.Action.OK) {
                            return;
                        }

                        try {

                            await oContext.delete();

                            MessageToast.show("Purchase Requisition deleted.");

                            this._refreshTable("prTable");
                            this._loadCounts();

                        } catch (e) {

                            MessageBox.error("Could not delete PR: " + e.message);
                        }
                    }
                }
            );
        },

        async _generateNextPRNumber() {

            try {

                const oResponse = await fetch(
                    "/procurement/PurchaseRequisitions?$select=prNumber&$orderby=prNumber desc&$top=1"
                );

                if (!oResponse.ok) {
                    throw new Error(`HTTP ${oResponse.status}`);
                }

                const oData = await oResponse.json();
                const aResults = oData.value || [];

                let iNext = 3001;

                if (aResults.length && aResults[0].prNumber) {

                    const sLast = aResults[0].prNumber;
                    const iLastNum = parseInt(sLast.replace("PR-", ""), 10);

                    if (!Number.isNaN(iLastNum)) {
                        iNext = iLastNum + 1;
                    }
                }

                return "PR-" + iNext;

            } catch (e) {

                // fallback so PR creation never blocks on this
                return "PR-" + Date.now().toString().slice(-4);
            }
        },

        async onSavePR() {

            const oLocationInput = this.byId("prLocationInput");
            const oRequestedByInput = this.byId("prRequestedByInput");

            if (!oLocationInput || !oRequestedByInput) {
                MessageBox.error("PR dialog controls could not be found.");
                return;
            }

            const sLocationId = oLocationInput.getSelectedKey();
            const sRequestedBy = oRequestedByInput.getSelectedKey();

            const oItemsModel = this.getView().getModel("prItems");
            const aItems = oItemsModel ? oItemsModel.getProperty("/items") : [];

            if (!sLocationId || !sRequestedBy || !aItems.length) {
                MessageToast.show("Please fill Location, Requested By, and add at least one item.");
                return;
            }

            const oModel = this.getView().getModel();
            const oViewModel = this.getView().getModel("view");

            oViewModel.setProperty("/busy", true);

            const bIsEdit = !!this._oEditingPRContext;

            try {

                if (bIsEdit) {

                    const oEditContext = this._oEditingPRContext;

                    oEditContext.setProperty("location_ID", sLocationId);
                    oEditContext.setProperty("requestedBy", sRequestedBy);

                    await this._callAction("replacePRItems", {
                        prID: oEditContext.getProperty("ID"),
                        items: aItems.map((i) => ({
                            part_ID: i.partId,
                            requiredQty: parseInt(i.requiredQty, 10) || 0,
                            supplier_ID: i.supplierId || null,
                            estimatedPrice: parseFloat(i.estimatedPrice) || 0
                        }))
                    });

                    MessageToast.show("Purchase Requisition updated.");

                } else {

                    const sPrNumber = await this._generateNextPRNumber();

                    const oListBinding = oModel.bindList("/PurchaseRequisitions");

                    const oContext = oListBinding.create({
                        prNumber: sPrNumber,
                        location_ID: sLocationId,
                        requestedBy: sRequestedBy,
                        status: "DRAFT",
                        items: aItems.map((i) => ({
                            part_ID: i.partId,
                            requiredQty: parseInt(i.requiredQty, 10) || 0,
                            supplier_ID: i.supplierId || null,
                            estimatedPrice: parseFloat(i.estimatedPrice) || 0
                        }))
                    });

                    await oContext.created();

                    MessageToast.show("Purchase Requisition created as DRAFT.");
                }

                this._oEditingPRContext = null;

                const oDialog = this.byId("createPRDialog");

                if (oDialog) {
                    oDialog.close();
                }

                this._refreshTable("prTable");
                this._loadCounts();

            } catch (e) {

                MessageBox.error(`Could not ${bIsEdit ? "update" : "create"} PR: ` + e.message);

            } finally {

                oViewModel.setProperty("/busy", false);
            }
        },

        async onSubmitPR(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            try {

                await this._callAction("submitPR", { prID: oContext.getProperty("ID") });

                MessageToast.show("PR submitted for approval.");

                this._refreshTable("prTable");
                this._loadCounts();

            } catch (e) {

                MessageBox.error(e.message);
            }
        },

        onApprovePR(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            MessageBox.confirm("Approve this Purchase Requisition?", {

                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],

                onClose: async (sAction) => {

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {

                        await this._callAction("approvePR", {
                            prID: oContext.getProperty("ID"),
                            approver: "Inventory Manager"
                        });

                        MessageToast.show("PR approved.");

                        this._refreshTable("prTable");
                        this._loadCounts();

                    } catch (e) {

                        MessageBox.error(e.message);
                    }
                }
            });
        },

        onRejectPR(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            MessageBox.confirm("Reject this PR?", {

                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],

                onClose: async (sAction) => {

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {

                        await this._callAction("rejectPR", {
                            prID: oContext.getProperty("ID"),
                            approver: "Inventory Manager",
                            reason: "Rejected via Procurement app"
                        });

                        MessageToast.show("PR rejected.");

                        this._refreshTable("prTable");
                        this._loadCounts();

                    } catch (e) {

                        MessageBox.error(e.message);
                    }
                }
            });
        },

        async onCreatePOFromPR(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            try {

                const aPOs = await this._callAction("createPOFromPR", {
                    prID: oContext.getProperty("ID")
                });

                MessageToast.show(`Created ${Array.isArray(aPOs) ? aPOs.length : 1} Purchase Order(s).`);

                this._refreshTable("prTable");
                this._refreshTable("poTable");
                this._loadCounts();

            } catch (e) {

                MessageBox.error(e.message);
            }
        },
        async onOpenPRObjectPage(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            if (!this._pPRObjectPageDialog) {

                this._pPRObjectPageDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "procurement.fragments.RequisitionObjectPage",
                    controller: this
                }).then((oDialog) => {
                    this.getView().addDependent(oDialog);
                    this._oPRObjectPageDialog = oDialog;   // NEW — direct reference for closing
                    return oDialog;
                });
            }

            const oDialog = await this._pPRObjectPageDialog;
            const oObjectPage = this.byId("prObjectPage");

            oObjectPage.bindElement({
                path: oContext.getPath(),
                parameters: { $expand: "location" }
            });

            const sPrId = oContext.getProperty("ID");

            const oItemsResponse = await fetch(
                `/procurement/PurchaseRequisitionItems?$filter=pr_ID eq ${encodeURIComponent(sPrId)}&$expand=supplier`
            );
            const oItemsData = await oItemsResponse.json();
            const aRawItems = oItemsData.value || [];

            const oInventoryModel = this.getView().getModel("inventory");

            const aItems = await Promise.all(aRawItems.map(async (oItem) => {

                let sPartLabel = oItem.part_ID;

                try {
                    const oPartBinding = oInventoryModel.bindContext(`/SpareParts('${oItem.part_ID}')`);
                    const oPart = await oPartBinding.requestObject();
                    sPartLabel = `${oPart.partNumber} - ${oPart.description}`;
                } catch (e) {
                    // inventory lookup failed — fall back to raw ID rather than blocking the page
                }

                return {
                    partLabel: sPartLabel,
                    requiredQty: oItem.requiredQty,
                    supplierLabel: oItem.supplier ? `${oItem.supplier.name} (${oItem.supplier.supplierCode})` : "N/A",
                    estimatedPrice: oItem.estimatedPrice
                };
            }));

            this.getView().setModel(new JSONModel({ items: aItems }), "prObjItems");

            oDialog.open();
        },

        onCloseObjectPage() {

            if (this._oPRObjectPageDialog) {
                this._oPRObjectPageDialog.close();
            }
        },
        async onSendForApproval(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) return;

            try {
                await this._callAction("sendForApproval", { prID: oContext.getProperty("ID") }); // confirm action name
                MessageToast.show("PR sent for approval.");
                this._refreshTable("prTable");
                this._loadCounts();
            } catch (e) {
                MessageBox.error(e.message);
            }
        },

        async onResubmitPR(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) return;

            try {
                await this._callAction("resubmitPR", { prID: oContext.getProperty("ID") }); // confirm action name
                MessageToast.show("PR resubmitted.");
                this._refreshTable("prTable");
                this._loadCounts();
            } catch (e) {
                MessageBox.error(e.message);
            }
        },
                async onClosePR(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            if (!oContext) return;

            try {
                await this._callAction("closePR", { prID: oContext.getProperty("ID") });
                MessageToast.show("PR closed.");
                this._refreshTable("prTable");
                this._loadCounts();
            } catch (e) {
                MessageBox.error(e.message);
            }
        },
    };
});