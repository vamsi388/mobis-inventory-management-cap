sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "../model/formatter"
], (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    Fragment,
    formatter
) => {

    "use strict";

    return Controller.extend("procurement.controller.View1", {

        formatter: formatter,


        // =========================================================
        // INIT
        // =========================================================

        onInit() {

            this.getView().setModel(
                new JSONModel({
                    busy: false,
                    counts: {
                        prTotal: 0,
                        prPending: 0,
                        poOpen: 0,
                        alertsOpen: 0,
                        alertsResolved: 0
                    },
                    statusPct: {
                        resolvedPct: 0,
                        unresolvedPct: 0
                    },
                    severityChartData: []
                }),
                "view"
            );

            this._loadCounts();
        },


        // =========================================================
        // SIDE NAVIGATION
        // =========================================================

        onSideNavigationSelect(oEvent) {

            const oItem = oEvent.getParameter("item");

            if (!oItem) {
                return;
            }

            const sKey = oItem.getKey();

            switch (sKey) {

                case "dashboard":
                    this._showSection("dashboard");
                    break;

                case "requisitions":
                    this._showSection("requisitions");
                    break;

                case "orders":
                    this._showSection("orders");
                    break;

                case "gr":
                    this._showSection("gr");
                    break;

                case "suppliers":
                    this._showSection("suppliers");
                    break;

                case "alerts":
                    this._showSection("alerts");
                    break;

                case "analytics":
                    this._showSection("analytics");
                    break;

                case "settings":
                    this._showSection("settings");
                    break;

                default:
                    this._showSection("dashboard");
                    break;
            }
        },


        // =========================================================
        // SHOW SECTION
        // =========================================================

        _showSection(sKey) {

            const aSections = [
                "dashboard",
                "requisitions",
                "orders",
                "gr",
                "suppliers",
                "alerts",
                "analytics",
                "settings"
            ];

            aSections.forEach((sSection) => {

                const oSection = this.byId(
                    sSection + "Section"
                );

                if (oSection) {
                    oSection.setVisible(
                        sSection === sKey
                    );
                }
            });


            const oSideNavigation =
                this.byId("sideNavigation");

            if (oSideNavigation) {

                const oNavigationList =
                    oSideNavigation.getItem();

                if (oNavigationList) {

                    const aItems =
                        oNavigationList.getItems();

                    aItems.forEach((oItem) => {

                        oItem.setSelected(
                            oItem.getKey() === sKey
                        );

                    });
                }
            }


            // Load data only when necessary

            switch (sKey) {

                case "dashboard":
                    this._loadCounts();
                    break;

                case "requisitions":
                    this._refreshTable("prTable");
                    break;

                case "orders":
                    this._refreshTable("poTable");
                    break;

                case "gr":
                    this._refreshTable("grTable");
                    break;

                case "suppliers":
                    this._refreshTable("supplierTable");
                    break;

                case "alerts":
                    this._refreshTable("alertsTable");
                    this._loadCounts();
                    break;
            }
        },


        // =========================================================
        // DASHBOARD
        // =========================================================

        _showDashboard() {

            this._showSection("dashboard");
        },


        // =========================================================
        // GLOBAL SEARCH
        // =========================================================

        onGlobalSearch(oEvent) {

            const sQuery =
                oEvent.getParameter("query");

            if (!sQuery) {
                return;
            }

            MessageToast.show(
                "Searching for: " + sQuery
            );
        },


        // =========================================================
        // KPI TILE EVENTS
        // =========================================================

        onPRTilePress() {

            this._showSection("requisitions");
        },


        onPendingTilePress() {

            this._showSection("requisitions");
        },


        onPOTilePress() {

            this._showSection("orders");
        },


        onAlertsTilePress() {

            this._showSection("alerts");
        },


        onViewAllAlerts() {

            this._showSection("alerts");
        },


        // =========================================================
        // GENERIC ACTION
        // =========================================================

        async _callAction(
            sActionName,
            oParams
        ) {

            const oViewModel =
                this.getView().getModel("view");

            oViewModel.setProperty(
                "/busy",
                true
            );

            try {

                const oResponse =
                    await fetch(
                        `/procurement/${sActionName}`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    oParams || {}
                                )
                        }
                    );


                const oResult =
                    await oResponse
                        .json()
                        .catch(() => ({}));


                if (!oResponse.ok) {

                    const sMessage =
                        oResult?.error?.message ||
                        `${sActionName} failed (HTTP ${oResponse.status})`;

                    throw new Error(sMessage);
                }


                return oResult;

            } finally {

                oViewModel.setProperty(
                    "/busy",
                    false
                );
            }
        },


        // =========================================================
        // LOAD DASHBOARD COUNTS (+ SEVERITY CHART + STATUS %)
        // =========================================================

        async _loadCounts() {

            const oViewModel =
                this.getView().getModel("view");

            try {

                const [
                    prTotal,
                    prPending,
                    poOpen,
                    alertsOpen,
                    alertsResolved,
                    high,
                    medium,
                    low
                ] = await Promise.all([

                    this._count(
                        "PurchaseRequisitions"
                    ),

                    this._count(
                        "PurchaseRequisitions",
                        "status eq 'SUBMITTED'"
                    ),

                    this._count(
                        "PurchaseOrders",
                        "status ne 'RECEIVED' and " +
                        "status ne 'CLOSED' and " +
                        "status ne 'CANCELLED'"
                    ),

                    this._count(
                        "AlertNotifications",
                        "isResolved eq false"
                    ),

                    this._count(
                        "AlertNotifications",
                        "isResolved eq true"
                    ),

                    this._count(
                        "AlertNotifications",
                        "severity eq 'HIGH'"
                    ),

                    this._count(
                        "AlertNotifications",
                        "severity eq 'MEDIUM'"
                    ),

                    this._count(
                        "AlertNotifications",
                        "severity eq 'LOW'"
                    )
                ]);


                const iTotalAlerts =
                    (alertsOpen + alertsResolved) || 1;


                oViewModel.setProperty(
                    "/counts",
                    {
                        prTotal,
                        prPending,
                        poOpen,
                        alertsOpen,
                        alertsResolved
                    }
                );


                oViewModel.setProperty(
                    "/statusPct",
                    {
                        resolvedPct:
                            Math.round(
                                (alertsResolved / iTotalAlerts) * 100
                            ),

                        unresolvedPct:
                            Math.round(
                                (alertsOpen / iTotalAlerts) * 100
                            )
                    }
                );


                oViewModel.setProperty(
                    "/severityChartData",
                    [
                        { severity: "High", count: high },
                        { severity: "Medium", count: medium },
                        { severity: "Low", count: low }
                    ]
                );

            } catch (e) {

                console.error(
                    "Failed to load dashboard counts:",
                    e
                );
            }
        },


        // =========================================================
        // COUNT
        // =========================================================

        async _count(
            sEntitySet,
            sFilter
        ) {

            let sUrl =
                `/procurement/${sEntitySet}/$count`;

            if (sFilter) {

                sUrl +=
                    `?$filter=${encodeURIComponent(sFilter)}`;
            }


            const oResponse =
                await fetch(
                    sUrl,
                    {
                        method: "GET",
                        headers: {
                            Accept: "text/plain"
                        }
                    }
                );


            if (!oResponse.ok) {

                throw new Error(
                    `Count failed for ${sEntitySet} (HTTP ${oResponse.status})`
                );
            }


            const sText =
                await oResponse.text();

            return parseInt(
                sText,
                10
            ) || 0;
        },


        // =========================================================
        // REFRESH TABLE
        // =========================================================

        _refreshTable(sId) {

            const oTable =
                this.byId(sId);

            if (!oTable) {
                return;
            }


            const oBinding =
                oTable.getBinding("items");

            if (oBinding) {

                oBinding.refresh();
            }
        },


        // =========================================================
        // REFRESH PR
        // =========================================================

        onRefreshPRs() {

            this._refreshTable(
                "prTable"
            );

            this._loadCounts();
        },


        // =========================================================
        // REFRESH PO
        // =========================================================

        onRefreshPOs() {

            this._refreshTable(
                "poTable"
            );

            this._loadCounts();
        },


        // =========================================================
        // REFRESH GR
        // =========================================================

        onRefreshGRs() {

            this._refreshTable(
                "grTable"
            );
        },


        // =========================================================
        // REFRESH SUPPLIERS
        // =========================================================

        onRefreshSuppliers() {

            this._refreshTable(
                "supplierTable"
            );

            MessageToast.show(
                "Suppliers refreshed"
            );
        },


        // =========================================================
        // REFRESH ALERTS
        // =========================================================

        onRefreshAlerts() {

            this._refreshTable(
                "alertsTable"
            );

            this._loadCounts();
        },


        // =========================================================
        // CREATE PURCHASE REQUISITION
        // =========================================================

        async onCreatePR() {

            if (!this._pCreatePRDialog) {

                this._pCreatePRDialog =
                    Fragment.load({

                        id:
                            this.getView().getId(),

                        name:
                            "procurement.fragments.CreatePR",

                        controller:
                            this

                    }).then((oDialog) => {

                        this.getView()
                            .addDependent(oDialog);

                        return oDialog;
                    });
            }


            this.getView().setModel(
                new JSONModel({
                    items: []
                }),
                "prItems"
            );


            (
                await this._pCreatePRDialog
            ).open();
        },


        // =========================================================
        // ADD PR ITEM
        // =========================================================

        onAddPRItemRow() {

            const oModel =
                this.getView()
                    .getModel("prItems");

            const aItems =
                oModel.getProperty("/items");


            aItems.push({

                partId: "",
                requiredQty: 1,
                supplierId: "",
                estimatedPrice: 0

            });


            oModel.setProperty(
                "/items",
                aItems
            );
        },


        // =========================================================
        // REMOVE PR ITEM
        // =========================================================

        onRemovePRItemRow(oEvent) {

            const oContext =
                oEvent
                    .getSource()
                    .getParent()
                    .getBindingContext(
                        "prItems"
                    );


            if (!oContext) {
                return;
            }


            const oModel =
                this.getView()
                    .getModel("prItems");


            const aItems =
                oModel.getProperty("/items");


            const iIndex =
                parseInt(
                    oContext
                        .getPath()
                        .split("/")
                        .pop(),
                    10
                );


            if (
                Number.isNaN(iIndex)
            ) {
                return;
            }


            aItems.splice(
                iIndex,
                1
            );


            oModel.setProperty(
                "/items",
                aItems
            );
        },


        // =========================================================
        // CANCEL PR
        // =========================================================

        onCancelPRDialog() {

            const oDialog =
                this.byId(
                    "createPRDialog"
                );

            if (oDialog) {
                oDialog.close();
            }
        },


        // =========================================================
        // SAVE PR
        // =========================================================

        async onSavePR() {

            const oLocationInput =
                this.byId(
                    "prLocationInput"
                );

            const oRequestedByInput =
                this.byId(
                    "prRequestedByInput"
                );


            if (
                !oLocationInput ||
                !oRequestedByInput
            ) {

                MessageBox.error(
                    "PR dialog controls could not be found."
                );

                return;
            }


            const sLocationId =
                oLocationInput.getValue();


            const sRequestedBy =
                oRequestedByInput.getValue();


            const oItemsModel =
                this.getView()
                    .getModel("prItems");


            const aItems =
                oItemsModel
                    ? oItemsModel.getProperty(
                        "/items"
                    )
                    : [];


            if (
                !sLocationId ||
                !sRequestedBy ||
                !aItems.length
            ) {

                MessageToast.show(
                    "Please fill Location, Requested By, and add at least one item."
                );

                return;
            }


            const oModel =
                this.getView().getModel();


            const oViewModel =
                this.getView()
                    .getModel("view");


            oViewModel.setProperty(
                "/busy",
                true
            );


            try {

                const oListBinding =
                    oModel.bindList(
                        "/PurchaseRequisitions"
                    );


                const oContext =
                    oListBinding.create({

                        location_ID:
                            sLocationId,

                        requestedBy:
                            sRequestedBy,

                        status:
                            "DRAFT",

                        items:
                            aItems.map(
                                (i) => ({

                                    part_ID:
                                        i.partId,

                                    requiredQty:
                                        parseInt(
                                            i.requiredQty,
                                            10
                                        ) || 0,

                                    supplier_ID:
                                        i.supplierId ||
                                        null,

                                    estimatedPrice:
                                        parseFloat(
                                            i.estimatedPrice
                                        ) || 0

                                })
                            )
                    });


                await oContext.created();


                MessageToast.show(
                    "Purchase Requisition created as DRAFT."
                );


                const oDialog =
                    this.byId(
                        "createPRDialog"
                    );


                if (oDialog) {
                    oDialog.close();
                }


                this._refreshTable(
                    "prTable"
                );

                this._loadCounts();

            } catch (e) {

                MessageBox.error(
                    "Could not create PR: " +
                    e.message
                );

            } finally {

                oViewModel.setProperty(
                    "/busy",
                    false
                );
            }
        },


        // =========================================================
        // SUBMIT PR
        // =========================================================

        async onSubmitPR(oEvent) {

            const oContext =
                oEvent
                    .getSource()
                    .getBindingContext();


            if (!oContext) {
                return;
            }


            try {

                await this._callAction(
                    "submitPR",
                    {
                        prID:
                            oContext.getProperty(
                                "ID"
                            )
                    }
                );


                MessageToast.show(
                    "PR submitted for approval."
                );


                this._refreshTable(
                    "prTable"
                );

                this._loadCounts();

            } catch (e) {

                MessageBox.error(
                    e.message
                );
            }
        },


        // =========================================================
        // APPROVE PR
        // =========================================================

        onApprovePR(oEvent) {

            const oContext =
                oEvent
                    .getSource()
                    .getBindingContext();


            if (!oContext) {
                return;
            }


            MessageBox.confirm(
                "Approve this Purchase Requisition?",
                {

                    actions: [
                        MessageBox.Action.OK,
                        MessageBox.Action.CANCEL
                    ],


                    onClose: async (
                        sAction
                    ) => {

                        if (
                            sAction !==
                            MessageBox.Action.OK
                        ) {
                            return;
                        }


                        try {

                            await this._callAction(
                                "approvePR",
                                {

                                    prID:
                                        oContext.getProperty(
                                            "ID"
                                        ),

                                    approver:
                                        "Inventory Manager"
                                }
                            );


                            MessageToast.show(
                                "PR approved."
                            );


                            this._refreshTable(
                                "prTable"
                            );

                            this._loadCounts();

                        } catch (e) {

                            MessageBox.error(
                                e.message
                            );
                        }
                    }
                }
            );
        },


        // =========================================================
        // REJECT PR
        // =========================================================

        onRejectPR(oEvent) {

            const oContext =
                oEvent
                    .getSource()
                    .getBindingContext();


            if (!oContext) {
                return;
            }


            MessageBox.confirm(
                "Reject this PR?",
                {

                    actions: [
                        MessageBox.Action.OK,
                        MessageBox.Action.CANCEL
                    ],


                    onClose: async (
                        sAction
                    ) => {

                        if (
                            sAction !==
                            MessageBox.Action.OK
                        ) {
                            return;
                        }


                        try {

                            await this._callAction(
                                "rejectPR",
                                {

                                    prID:
                                        oContext.getProperty(
                                            "ID"
                                        ),

                                    approver:
                                        "Inventory Manager",

                                    reason:
                                        "Rejected via Procurement app"
                                }
                            );


                            MessageToast.show(
                                "PR rejected."
                            );


                            this._refreshTable(
                                "prTable"
                            );

                            this._loadCounts();

                        } catch (e) {

                            MessageBox.error(
                                e.message
                            );
                        }
                    }
                }
            );
        },


        // =========================================================
        // CREATE PO FROM PR
        // =========================================================

        async onCreatePOFromPR(
            oEvent
        ) {

            const oContext =
                oEvent
                    .getSource()
                    .getBindingContext();


            if (!oContext) {
                return;
            }


            try {

                const aPOs =
                    await this._callAction(
                        "createPOFromPR",
                        {

                            prID:
                                oContext.getProperty(
                                    "ID"
                                )
                        }
                    );


                MessageToast.show(
                    `Created ${
                        Array.isArray(aPOs)
                            ? aPOs.length
                            : 1
                    } Purchase Order(s).`
                );


                this._refreshTable(
                    "prTable"
                );

                this._refreshTable(
                    "poTable"
                );

                this._loadCounts();

            } catch (e) {

                MessageBox.error(
                    e.message
                );
            }
        },


        // =========================================================
        // POST GOODS RECEIPT
        // =========================================================

        async onPostGR() {

            if (!this._pPostGRDialog) {

                this._pPostGRDialog =
                    Fragment.load({

                        id:
                            this.getView()
                                .getId(),

                        name:
                            "procurement.fragments.PostGR",

                        controller:
                            this

                    }).then((oDialog) => {

                        this.getView()
                            .addDependent(oDialog);

                        return oDialog;
                    });
            }


            this.getView().setModel(
                new JSONModel({
                    items: []
                }),
                "grItems"
            );


            (
                await this._pPostGRDialog
            ).open();
        },


        // =========================================================
        // PO CHANGE FOR GR
        // =========================================================

        async onGRPoChange(
            oEvent
        ) {

            const sPoId =
                oEvent
                    .getSource()
                    .getSelectedKey();


            if (!sPoId) {
                return;
            }


            try {

                const oResponse =
                    await fetch(
                        `/procurement/PurchaseOrderItems?$filter=po_ID eq ${encodeURIComponent(sPoId)}`
                    );


                if (!oResponse.ok) {

                    throw new Error(
                        `HTTP ${oResponse.status}`
                    );
                }


                const oData =
                    await oResponse.json();


                const aItems =
                    (oData.value || [])
                        .map((i) => ({

                            poItemID:
                                i.ID,

                            orderedQty:
                                i.orderedQty,

                            receivedQty:
                                i.receivedQty,

                            receiveNow:
                                0
                        }));


                const oModel =
                    this.getView()
                        .getModel(
                            "grItems"
                        );


                if (oModel) {

                    oModel.setProperty(
                        "/items",
                        aItems
                    );
                }

            } catch (e) {

                MessageBox.error(
                    "Unable to load PO items: " +
                    e.message
                );
            }
        },


        // =========================================================
        // CANCEL GR
        // =========================================================

        onCancelGRDialog() {

            const oDialog =
                this.byId(
                    "postGRDialog"
                );


            if (oDialog) {
                oDialog.close();
            }
        },


        // =========================================================
        // SUBMIT GR
        // =========================================================

        async onSubmitGR() {

            const oPoSelect =
                this.byId(
                    "grPoSelect"
                );

            const oLocationInput =
                this.byId(
                    "grLocationInput"
                );

            const oReceivedByInput =
                this.byId(
                    "grReceivedByInput"
                );


            if (
                !oPoSelect ||
                !oLocationInput ||
                !oReceivedByInput
            ) {

                MessageBox.error(
                    "Goods Receipt dialog controls could not be found."
                );

                return;
            }


            const sPoId =
                oPoSelect.getSelectedKey();


            const sLocationId =
                oLocationInput.getValue();


            const sReceivedBy =
                oReceivedByInput.getValue();


            const oItemsModel =
                this.getView()
                    .getModel(
                        "grItems"
                    );


            const aItems =
                oItemsModel
                    ? oItemsModel.getProperty(
                        "/items"
                    )
                    : [];


            const aSubmitItems =
                aItems
                    .filter(
                        (i) =>
                            parseInt(
                                i.receiveNow,
                                10
                            ) > 0
                    )
                    .map(
                        (i) => ({

                            poItemID:
                                i.poItemID,

                            receivedQty:
                                parseInt(
                                    i.receiveNow,
                                    10
                                )
                        })
                    );


            if (
                !sPoId ||
                !sLocationId ||
                !sReceivedBy ||
                !aSubmitItems.length
            ) {

                MessageToast.show(
                    "Select a PO, fill Location/Received By, and enter at least one receive quantity."
                );

                return;
            }


            try {

                await this._callAction(
                    "postGoodsReceipt",
                    {

                        poID:
                            sPoId,

                        locationID:
                            sLocationId,

                        receivedBy:
                            sReceivedBy,

                        items:
                            aSubmitItems
                    }
                );


                MessageToast.show(
                    "Goods Receipt posted."
                );


                const oDialog =
                    this.byId(
                        "postGRDialog"
                    );


                if (oDialog) {
                    oDialog.close();
                }


                this._refreshTable(
                    "grTable"
                );

                this._refreshTable(
                    "poTable"
                );

                this._loadCounts();

            } catch (e) {

                MessageBox.error(
                    e.message
                );
            }
        },


        // =========================================================
        // RESOLVE ALERT
        // =========================================================

        async onResolveAlert(
            oEvent
        ) {

            const oContext =
                oEvent
                    .getSource()
                    .getBindingContext();


            if (!oContext) {
                return;
            }


            try {

                await this._callAction(
                    "resolveAlert",
                    {

                        alertID:
                            oContext.getProperty(
                                "ID"
                            )
                    }
                );


                MessageToast.show(
                    "Alert resolved."
                );


                this._refreshTable(
                    "alertsTable"
                );

                this._refreshTable(
                    "dashboardAlertsTable"
                );

                this._loadCounts();

            } catch (e) {

                MessageBox.error(
                    e.message
                );
            }
        }

    });
});