sap.ui.define([
    "sap/m/MessageToast"
], (MessageToast) => {
    "use strict";

    return {

        onRefreshSuppliers() {
            this._refreshTable("supplierTable");
            MessageToast.show("Suppliers refreshed");
        }
    };
});