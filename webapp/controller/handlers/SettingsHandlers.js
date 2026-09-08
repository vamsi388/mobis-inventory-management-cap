sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (JSONModel, MessageToast, MessageBox) => {
    "use strict";

    return {

        _getDefaultSettings() {
            return {
                currency: "INR",
                density: "compact",
                reorderBufferPct: 10,
                emailAlertsEnabled: true,
                autoResolveLow: false,
                approvalLimit: 50000,
                defaultApproverRole: "INVENTORY_MANAGER"
            };
        },

        _loadSettings() {

            if (this.getView().getModel("settings")) {
                return;
            }

            const sStored = localStorage.getItem("mobisProcureFlowSettings");
            const oSettings = sStored ? JSON.parse(sStored) : this._getDefaultSettings();

            this.getView().setModel(new JSONModel(oSettings), "settings");
        },

        onSaveSettings() {

            const oSettings = this.getView().getModel("settings").getData();

            localStorage.setItem("mobisProcureFlowSettings", JSON.stringify(oSettings));

            MessageToast.show("Settings saved.");
        },

        onResetSettings() {

            MessageBox.confirm("Reset all settings to their default values?", {

                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],

                onClose: (sAction) => {

                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    const oDefaults = this._getDefaultSettings();

                    this.getView().getModel("settings").setData(oDefaults);
                    localStorage.setItem("mobisProcureFlowSettings", JSON.stringify(oDefaults));

                    MessageToast.show("Settings reset to defaults.");
                }
            });
        }
    };
});