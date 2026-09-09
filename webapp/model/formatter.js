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
                case "APPROVED": return "Success";
                case "REJECTED": return "Error";
                case "PENDING_APPROVAL":
                case "SUBMITTED": return "Warning";
                default: return "None"; // DRAFT, CLOSED
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
        },

        prCanEdit(sStatus) {
            return sStatus === "DRAFT";
        },

        prCanDelete(sStatus) {
            return sStatus === "DRAFT";
        },

        prCanSubmit(sStatus) {
            return sStatus === "DRAFT";
        },

        prCanSendForApproval(sStatus) {
            return sStatus === "SUBMITTED";
        },

        prCanApprove(sStatus) {
            return sStatus === "PENDING_APPROVAL";
        },

        prCanReject(sStatus) {
            return sStatus === "PENDING_APPROVAL";
        },

        prCanCreatePO(sStatus) {
            return sStatus === "APPROVED";
        },

        prCanClose(sStatus) {
            return sStatus === "APPROVED";
        },

        prCanResubmit(sStatus) {
            return sStatus === "REJECTED";
        },
        prStatusIcon(sStatus) {
            switch (sStatus) {
                case "APPROVED": return "sap-icon://accept";
                case "REJECTED": return "sap-icon://decline";
                case "PENDING_APPROVAL":
                case "SUBMITTED": return "sap-icon://pending";
                case "CLOSED": return "sap-icon://complete";
                default: return "sap-icon://edit"; // DRAFT
            }
        },
        daysSinceCreated(sCreatedAt) {
            if (!sCreatedAt) return 0;
            const iDiffMs = Date.now() - new Date(sCreatedAt).getTime();
            return Math.floor(iDiffMs / (1000 * 60 * 60 * 24));
        },

        ageState(sCreatedAt) {
            const iDays = this.daysSinceCreated(sCreatedAt);
            if (iDays > 14) return "Error";
            if (iDays > 7) return "Warning";
            return "Success";
        },

        prWorkflowPct(sStatus) {
            const mPct = { DRAFT: 10, SUBMITTED: 35, PENDING_APPROVAL: 50, APPROVED: 80, CLOSED: 100, REJECTED: 100 };
            return mPct[sStatus] ?? 0;
        },

        prWorkflowLabel(sStatus) {
            const mLabel = {
                DRAFT: "Draft — not yet submitted",
                SUBMITTED: "Submitted, awaiting review",
                PENDING_APPROVAL: "Pending approval",
                APPROVED: "Approved",
                REJECTED: "Rejected",
                CLOSED: "Closed"
            };
            return mLabel[sStatus] || sStatus;
        }

    };
});