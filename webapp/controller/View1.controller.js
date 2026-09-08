sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../model/formatter",
    "./handlers/DashboardHandlers",
    "./handlers/RequisitionHandlers",
    "./handlers/OrderHandlers",
    "./handlers/GRHandlers",
    "./handlers/SupplierHandlers",
    "./handlers/AlertHandlers",
    "./handlers/ProcessFlowHandlers",
    "./handlers/AnalyticsHandlers",
    "./handlers/SettingsHandlers",
    "./handlers/SpendHandlers",
    "./handlers/UserRoleHandlers"
], (
    Controller,
    JSONModel,
    MessageToast,
    MessageBox,
    formatter,
    DashboardHandlers,
    RequisitionHandlers,
    OrderHandlers,
    GRHandlers,
    SupplierHandlers,
    AlertHandlers,
    ProcessFlowHandlers,
    AnalyticsHandlers,
    SettingsHandlers,
    SpendHandlers,
    UserRoleHandlers
) => {
    "use strict";

    const oControllerMembers = Object.assign(
        {},
        DashboardHandlers,
        RequisitionHandlers,
        OrderHandlers,
        GRHandlers,
        SupplierHandlers,
        AlertHandlers,
        ProcessFlowHandlers,
        AnalyticsHandlers,
        SettingsHandlers,
        SpendHandlers,
        UserRoleHandlers,
        {

            formatter: formatter,

            // =========================================================
            // INIT
            // =========================================================

            onInit() {

                this.getView().setModel(new JSONModel({
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
                }), "view");

                this.getView().setModel(new JSONModel({
                    prStatusData: [],
                    poStatusData: [],
                    severityData: [],
                    spendData: [],
                    ratingData: [],
                    kpi: {
                        totalSpend: "0",
                        avgRating: "0.0",
                        avgLeadTime: "0.0",
                        conversionPct: "0%"
                    }
                }), "analytics");

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

                this._showSection(sKey || "dashboard");
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
                    "processflow",
                    "analytics",
                    "settings",
                    "spend",
                    "supplierPerf",
                    "users",
                    "roles"
                ];

                aSections.forEach((sSection) => {

                    const oSection = this.byId(sSection + "Section");

                    if (oSection) {
                        oSection.setVisible(sSection === sKey);
                    }
                });

                this._updateSideNavSelection(sKey);

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

                    case "processflow":
                        this._initProcessFlowModel();
                        break;

                    case "analytics":
                        this._loadAnalytics();
                        break;

                    case "settings":
                        this._loadSettings();
                        break;

                    case "spend":
                        this._loadSpendAnalysis();
                        break;

                    case "supplierPerf":
                        this._refreshTable("supplierPerfTable");
                        break;

                    case "users":
                        this._loadUsers();
                        break;

                    case "roles":
                        this._loadRoles();
                        break;
                }
            },

            // =========================================================
            // BACK TO DASHBOARD
            // =========================================================

            onBackToDashboard() {
                this._showSection("dashboard");
            },

            // =========================================================
            // GLOBAL SEARCH
            // =========================================================

            onGlobalSearch(oEvent) {

                const sQuery = oEvent.getParameter("query");

                if (!sQuery) {
                    return;
                }

                MessageToast.show("Searching for: " + sQuery);
            },

            // =========================================================
            // GENERIC ACTION
            // =========================================================

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

                        const sMessage = oResult?.error?.message ||
                            `${sActionName} failed (HTTP ${oResponse.status})`;

                        throw new Error(sMessage);
                    }

                    return oResult;

                } finally {

                    oViewModel.setProperty("/busy", false);
                }
            },

            // =========================================================
            // REFRESH TABLE
            // =========================================================

            _refreshTable(sId) {

                const oTable = this.byId(sId);

                if (!oTable) {
                    return;
                }

                const oBinding = oTable.getBinding("items");

                if (oBinding) {
                    oBinding.refresh();
                }
            },

            // =========================================================
            // SIDE NAV SELECTION (recursive — handles nested group items)
            // =========================================================

            _updateSideNavSelection(sKey) {

                const oSideNavigation = this.byId("sideNavigation");

                if (!oSideNavigation) {
                    return;
                }

                const oNavigationList = oSideNavigation.getItem();

                if (!oNavigationList) {
                    return;
                }

                const setSelectionRecursive = (aItems) => {

                    if (!aItems) {
                        return;
                    }

                    aItems.forEach((oItem) => {

                        if (typeof oItem.setSelected === "function" && typeof oItem.getKey === "function") {
                            oItem.setSelected(oItem.getKey() === sKey);
                        }

                        if (typeof oItem.getItems === "function") {

                            const aChildren = oItem.getItems();

                            if (aChildren && aChildren.length) {
                                setSelectionRecursive(aChildren);
                            }
                        }
                    });
                };

                setSelectionRecursive(oNavigationList.getItems());
            },

            // =========================================================
            // AFTER RENDERING — wire tile clicks via delegation
            // =========================================================

            onAfterRendering() {
                this._wireDashboardTileClicksOnce();
            },

            _wireDashboardTileClicksOnce() {

                if (this._bTileClicksWired) {
                    return;
                }

                const oPage = this.byId("mainPage");

                if (!oPage) {
                    return;
                }

                const mTileHandlers = {
                    "_IDGenTilePRTotal": this.onPRTilePress,
                    "_IDGenTilePending": this.onPendingTilePress,
                    "_IDGenTilePO": this.onPOTilePress,
                    "_IDGenTileAlerts": this.onAlertsTilePress,
                    "_IDGenTileProcessFlow": this.onProcessFlowTilePress
                };

                const oView = this.getView();

                oPage.$().on("click.tileDelegation", ".phTile", (oJQEvent) => {

                    const sClickedDomId = oJQEvent.currentTarget.id;

                    Object.keys(mTileHandlers).forEach((sLocalId) => {

                        const oTile = oView.byId(sLocalId);

                        if (oTile && oTile.getId() === sClickedDomId) {
                            mTileHandlers[sLocalId].call(this);
                        }
                    });
                });

                oPage.$().find(".phTile").css("cursor", "pointer");

                this._bTileClicksWired = true;
            }
        }
    );

    return Controller.extend("procurement.controller.View1", oControllerMembers);
});