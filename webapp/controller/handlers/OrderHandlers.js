sap.ui.define([], () => {
    "use strict";

    return {

        onRefreshPOs() {
            this._refreshTable("poTable");
            this._loadCounts();
        }
    };
});