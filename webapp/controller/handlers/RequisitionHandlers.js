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
        onPRSearch(oEvent) {

            const sQuery = (oEvent.getParameter("newValue") ?? oEvent.getParameter("query") ?? "").trim();

            const oTable = this.byId("prTable");

            if (!oTable) {
                return;
            }

            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            const Filter = sap.ui.require("sap/ui/model/Filter") || sap.ui.requireSync("sap/ui/model/Filter");
            const FilterOperator = sap.ui.require("sap/ui/model/FilterOperator") || sap.ui.requireSync("sap/ui/model/FilterOperator");

            const aFilters = [
                new Filter("prNumber", FilterOperator.Contains, sQuery),
                new Filter("requestedBy", FilterOperator.Contains, sQuery),
                new Filter("status", FilterOperator.Contains, sQuery),
                new Filter("location/name", FilterOperator.Contains, sQuery)
            ];

            oBinding.filter(new Filter({ filters: aFilters, and: false }));
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
                    const sGroupId = "prEditGroup";               // NEW — deferred group for this save

                    oEditContext.setProperty("location_ID", sLocationId, sGroupId);   // CHANGED — pass group
                    oEditContext.setProperty("requestedBy", sRequestedBy, sGroupId);  // CHANGED — pass group

                    await this._replacePRItemsViaCRUD(oEditContext, aItems, sGroupId); // CHANGED — pass group

                    await oModel.submitBatch(sGroupId);            // NEW — flush header property changes too

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

            const fTotal = aItems.reduce((fSum, i) => fSum + (parseFloat(i.estimatedPrice) || 0), 0);

            this.getView().setModel(new JSONModel({ items: aItems, totalEstimated: fTotal }), "prObjItems");

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
        async _loadPRObjectPageDetails(sPrId) {

            // Fetch item lines with expand for real supplier/part names
            const oItemsResp = await fetch(`/procurement/PurchaseRequisitionItems?$filter=pr_ID eq ${sPrId}&$expand=part,supplier`);
            const oItemsData = await oItemsResp.json();
            const aRawItems = oItemsData.value || [];

            const aItems = aRawItems.map((i) => {
                const fPrice = i.estimatedPrice || 0;
                const iQty = i.requiredQty || 0;

                return {
                    partLabel: (i.part && i.part.description) || i.part_ID || "Unknown Part",
                    categoryLabel: (i.part && i.part.category) || "—",
                    requiredQty: iQty,
                    supplierLabel: (i.supplier && i.supplier.name) || "Not specified",
                    estimatedPrice: fPrice,
                    lineTotal: Math.round(fPrice * iQty)
                };
            });

            const iTotalEstimated = aItems.reduce((sum, i) => sum + i.lineTotal, 0);

            this.getView().setModel(new JSONModel({
                items: aItems,
                totalEstimated: iTotalEstimated
            }), "prObjItems");

            // Build approval timeline from the PR's own audit fields
            // (extend this once you have a dedicated audit-log entity)
            const oPrResp = await fetch(`/procurement/PurchaseRequisitions(${sPrId})`);
            const oPr = await oPrResp.json();

            const aEvents = [];

            aEvents.push({
                label: "Requisition Created",
                actor: oPr.requestedBy || "Unknown",
                timestamp: this._formatTimelineDate(oPr.createdAt),
                icon: "sap-icon://create",
                infoState: "None"
            });

            if (oPr.status === "SUBMITTED" || oPr.status === "APPROVED" || oPr.status === "REJECTED" || oPr.status === "CLOSED") {
                aEvents.push({
                    label: "Submitted for Approval",
                    actor: oPr.requestedBy || "Unknown",
                    timestamp: this._formatTimelineDate(oPr.submittedAt || oPr.createdAt),
                    icon: "sap-icon://paper-plane",
                    infoState: "None"
                });
            }

            if (oPr.status === "APPROVED" || oPr.status === "CLOSED") {
                aEvents.push({
                    label: "Approved",
                    actor: oPr.approvedBy || "Unknown",
                    timestamp: this._formatTimelineDate(oPr.approvedAt),
                    icon: "sap-icon://accept",
                    infoState: "Success"
                });
            }

            if (oPr.status === "REJECTED") {
                aEvents.push({
                    label: "Rejected",
                    actor: oPr.approvedBy || "Unknown",
                    timestamp: this._formatTimelineDate(oPr.approvedAt),
                    icon: "sap-icon://decline",
                    infoState: "Error"
                });
            }

            if (oPr.status === "CLOSED") {
                aEvents.push({
                    label: "Purchase Requisition Closed",
                    actor: oPr.approvedBy || "System",
                    timestamp: this._formatTimelineDate(oPr.closedAt || oPr.approvedAt),
                    icon: "sap-icon://complete",
                    infoState: "Success"
                });
            }

            this.getView().setModel(new JSONModel({ events: aEvents }), "prObjTimeline");

            // Related POs
            const oPoResp = await fetch(`/procurement/PurchaseOrders?$filter=pr_ID eq ${sPrId}&$expand=supplier`);
            const oPoData = await oPoResp.json();
            const aOrders = (oPoData.value || []).map((po) => ({
                poNumber: po.poNumber,
                supplierName: (po.supplier && po.supplier.name) || "Unknown",
                status: po.status,
                s4POId: po.s4POId || "—"
            }));

            this.getView().setModel(new JSONModel({ orders: aOrders }), "prObjRelatedPO");
        },

        _formatTimelineDate(sIsoDate) {
            if (!sIsoDate) return "—";
            const oDate = new Date(sIsoDate);
            return oDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
                " " + oDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        },

        onViewRelatedPO(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("prObjRelatedPO");
            MessageToast.show(`Open PO: ${oContext.getProperty("poNumber")}`);
            // Wire this to your existing PO Object Page open logic once you have one
        }
    };
});