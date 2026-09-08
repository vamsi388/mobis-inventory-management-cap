sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], (JSONModel, MessageBox) => {
    "use strict";

    return {

        async _loadSpendAnalysis() {

            try {

                const oResponse = await fetch("/procurement/PurchaseOrders?$expand=supplier,items");

                if (!oResponse.ok) {
                    throw new Error(`HTTP ${oResponse.status}`);
                }

                const oData = await oResponse.json();
                const aPOs = oData.value || [];

                const mBySupplier = {};

                aPOs.forEach((oPO) => {

                    const sSupplierName = oPO.supplier ? oPO.supplier.name : "Unknown";

                    if (!mBySupplier[sSupplierName]) {
                        mBySupplier[sSupplierName] = {
                            supplierName: sSupplierName,
                            poCount: 0,
                            totalQty: 0,
                            totalSpend: 0
                        };
                    }

                    mBySupplier[sSupplierName].poCount += 1;

                    (oPO.items || []).forEach((oItem) => {
                        mBySupplier[sSupplierName].totalQty += oItem.orderedQty || 0;
                        mBySupplier[sSupplierName].totalSpend += (oItem.orderedQty || 0) * (oItem.unitPrice || 0);
                    });
                });

                const aBySupplier = Object.values(mBySupplier).sort((a, b) => b.totalSpend - a.totalSpend);

                this.getView().setModel(new JSONModel({ bySupplier: aBySupplier }), "spend");

            } catch (e) {

                MessageBox.error("Unable to load spend analysis: " + e.message);
            }
        },

        onRefreshSpend() {
            this._loadSpendAnalysis();
        }
    };
});