sap.ui.define([
    "sap/m/MessageBox"
], (MessageBox) => {
    "use strict";

    return {

        async _loadAnalytics() {

            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);

            try {

                const [prData, poData, alertData, supplierData, poWithItems] = await Promise.all([
                    fetch("/procurement/PurchaseRequisitions").then((r) => r.json()),
                    fetch("/procurement/PurchaseOrders").then((r) => r.json()),
                    fetch("/procurement/AlertNotifications").then((r) => r.json()),
                    fetch("/procurement/Suppliers").then((r) => r.json()),
                    fetch("/procurement/PurchaseOrders?$expand=supplier,items").then((r) => r.json())
                ]);

                const aPRs = prData.value || [];
                const aPOs = poData.value || [];
                const aAlerts = alertData.value || [];
                const aSuppliers = supplierData.value || [];
                const aPOsFull = poWithItems.value || [];

                const mPRStatus = {};
                aPRs.forEach((pr) => {
                    const sStatus = pr.status || "UNKNOWN";
                    mPRStatus[sStatus] = (mPRStatus[sStatus] || 0) + 1;
                });
                const aPRStatusData = Object.keys(mPRStatus).map((k) => ({ status: k, count: mPRStatus[k] }));

                const mPOStatus = {};
                aPOs.forEach((po) => {
                    const sStatus = po.status || "UNKNOWN";
                    mPOStatus[sStatus] = (mPOStatus[sStatus] || 0) + 1;
                });
                const aPOStatusData = Object.keys(mPOStatus).map((k) => ({ status: k, count: mPOStatus[k] }));

                const mSeverity = {};
                aAlerts.forEach((a) => {
                    const sSeverity = a.severity || "UNKNOWN";
                    mSeverity[sSeverity] = (mSeverity[sSeverity] || 0) + 1;
                });
                const aSeverityData = Object.keys(mSeverity).map((k) => ({ severity: k, count: mSeverity[k] }));

                const mSpend = {};
                aPOsFull.forEach((po) => {
                    const sName = (po.supplier && po.supplier.name) || "Unknown";
                    if (!mSpend[sName]) mSpend[sName] = 0;
                    (po.items || []).forEach((item) => {
                        mSpend[sName] += (item.orderedQty || 0) * (item.unitPrice || 0);
                    });
                });
                const aSpendData = Object.keys(mSpend)
                    .map((k) => ({ supplierName: k, totalSpend: Math.round(mSpend[k]) }))
                    .sort((a, b) => b.totalSpend - a.totalSpend)
                    .slice(0, 10);

                const aRatingData = aSuppliers
                    .map((s) => ({ supplierName: s.name || "Unknown", rating: s.rating || 0 }))
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 10);

                const iTotalSpend = Object.values(mSpend).reduce((sum, v) => sum + v, 0);

                const fAvgRating = aSuppliers.length
                    ? (aSuppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / aSuppliers.length)
                    : 0;

                const fAvgLeadTime = aSuppliers.length
                    ? (aSuppliers.reduce((sum, s) => sum + (s.leadTimeDays || 0), 0) / aSuppliers.length)
                    : 0;

                const iConvertedPRs = aPRs.filter((pr) => pr.status === "CONVERTED" || pr.status === "APPROVED").length;
                const fConversionPct = aPRs.length ? Math.round((iConvertedPRs / aPRs.length) * 100) : 0;

                this.getView().getModel("analytics").setData({
                    prStatusData: aPRStatusData,
                    poStatusData: aPOStatusData,
                    severityData: aSeverityData,
                    spendData: aSpendData,
                    ratingData: aRatingData,
                    kpi: {
                        totalSpend: Math.round(iTotalSpend).toLocaleString("en-IN"),
                        avgRating: fAvgRating.toFixed(1),
                        avgLeadTime: fAvgLeadTime.toFixed(1),
                        conversionPct: fConversionPct + "%"
                    }
                });

            } catch (e) {

                MessageBox.error("Unable to load analytics: " + e.message);

            } finally {

                oViewModel.setProperty("/busy", false);
            }
        },

        onRefreshAnalytics() {
            this._loadAnalytics();
        }
    };
});