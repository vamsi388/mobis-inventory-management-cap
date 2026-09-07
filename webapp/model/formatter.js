sap.ui.define([], () => {
    "use strict";
    return {
        severityState(sSeverity) {
            switch ((sSeverity || "").toUpperCase()) {
                case "HIGH": return "Error";
                case "MEDIUM": return "Warning";
                case "LOW": return "Success";
                default: return "None";
            }
        },
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
                case "SENT": return "Warning";
                case "PARTIAL": return "Warning";
                case "RECEIVED": return "Success";
                case "CLOSED": return "Success";
                case "CANCELLED": return "Error";
                default: return "None";
            }
        },
        supplierGradeText(fRating) {
            if (fRating == null) return "Unrated";
            if (fRating >= 4.5) return "Excellent";
            if (fRating >= 3.5) return "Good";
            if (fRating >= 2.5) return "Average";
            return "Poor";
        },

        supplierGradeState(fRating) {
            if (fRating == null) return "None";
            if (fRating >= 4.5) return "Success";
            if (fRating >= 3.5) return "Success";
            if (fRating >= 2.5) return "Warning";
            return "Error";
        }

    };
});