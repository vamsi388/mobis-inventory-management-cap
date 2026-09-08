sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (MessageToast, MessageBox) => {
    "use strict";

    return {

        onRefreshAlerts() {
            this._refreshTable("alertsTable");
            this._loadCounts();
        },

        async onResolveAlert(oEvent) {

            const oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                return;
            }

            try {

                await this._callAction("resolveAlert", {
                    alertID: oContext.getProperty("ID")
                });

                MessageToast.show("Alert resolved.");

                this._refreshTable("alertsTable");
                this._loadCounts();

            } catch (e) {

                MessageBox.error(e.message);
            }
        }
    };
});