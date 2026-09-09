sap.ui.define([], () => {
    "use strict";

    return {

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

        onProcessFlowTilePress() {
            this._showSection("processflow");
            this.onShowProcessFlowSection();
        },

        async _loadCounts() {

            const oViewModel = this.getView().getModel("view");

            try {

                const [
                    prTotal, prPending, poOpen, alertsOpen, alertsResolved,
                    high, medium, low
                ] = await Promise.all([

                    this._count("PurchaseRequisitions"),
                    this._count("PurchaseRequisitions", "status eq 'SUBMITTED'"),
                    this._count("PurchaseOrders", "status ne 'RECEIVED' and status ne 'CLOSED' and status ne 'CANCELLED'"),
                    this._count("AlertNotifications", "isResolved eq false"),
                    this._count("AlertNotifications", "isResolved eq true"),
                    this._count("AlertNotifications", "severity eq 'HIGH'"),
                    this._count("AlertNotifications", "severity eq 'MEDIUM'"),
                    this._count("AlertNotifications", "severity eq 'LOW'")
                ]);

                const iTotalAlerts = (alertsOpen + alertsResolved) || 1;

                oViewModel.setProperty("/counts", {
                    prTotal, prPending, poOpen, alertsOpen, alertsResolved
                });

                oViewModel.setProperty("/statusPct", {
                    resolvedPct: Math.round((alertsResolved / iTotalAlerts) * 100),
                    unresolvedPct: Math.round((alertsOpen / iTotalAlerts) * 100)
                });

                oViewModel.setProperty("/severityChartData", [
                    { severity: "High", count: high },
                    { severity: "Medium", count: medium },
                    { severity: "Low", count: low }
                ]);

            } catch (e) {

                console.error("Failed to load dashboard counts:", e);
            }
        },

        async _count(sEntitySet, sFilter) {

            let sUrl = `/procurement/${sEntitySet}/$count`;

            if (sFilter) {
                sUrl += `?$filter=${encodeURIComponent(sFilter)}`;
            }

            const oResponse = await fetch(sUrl, { method: "GET" });

            if (!oResponse.ok) {
                throw new Error(`Count failed for ${sEntitySet} (HTTP ${oResponse.status})`);
            }

            const sText = await oResponse.text();

            return parseInt(sText, 10) || 0;
        },
        onHideWelcomeBanner() {
            const oBanner = this.byId("welcomeBanner");
            if (oBanner) {
                oBanner.setVisible(false);
            }
        },
    };
});