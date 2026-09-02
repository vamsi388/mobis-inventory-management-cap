sap.ui.define([], () => {
    "use strict";

    return {
        prStatusState(sStatus) {
            switch (sStatus) {
                case "DRAFT": return "None";
                case "SUBMITTED": return "Warning";
                case "APPROVED": return "Success";
                case "REJECTED": return "Error";
                default: return "None";
            }
        },

        poStatusState(sStatus) {
            switch (sStatus) {
                case "CREATED": return "None";
                case "SENT": return "Information";
                case "PARTIALLY_RECEIVED": return "Warning";
                case "RECEIVED": return "Success";
                case "CLOSED": return "Success";
                case "CANCELLED": return "Error";
                default: return "None";
            }
        },

        severityState(sSeverity) {
            switch ((sSeverity || "").toUpperCase()) {
                case "LOW": return "None";
                case "MEDIUM": return "Warning";
                case "HIGH": return "Error";
                case "CRITICAL": return "Error";
                default: return "None";
            }
        }
    };
});