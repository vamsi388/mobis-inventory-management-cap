sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (JSONModel, MessageToast, MessageBox) => {
    "use strict";

    return {

        _initProcessFlowModel() {

            if (!this.getView().getModel("pf")) {

                this.getView().setModel(new JSONModel({
                    nodes: [],
                    lanes: [
                        { laneId: "lane1", icon: "sap-icon://request", text: "Draft", position: 0 },
                        { laneId: "lane2", icon: "sap-icon://paper-plane", text: "Submitted", position: 1 },
                        { laneId: "lane3", icon: "sap-icon://approvals", text: "Pending Approval", position: 2 },
                        { laneId: "lane4", icon: "sap-icon://decision", text: "Decision", position: 3 },
                        { laneId: "lane5", icon: "sap-icon://complete", text: "Closed", position: 4 }
                    ]
                }), "pf");
            }
        },

        onProcessFlowPrChange(oEvent) {

            const sPrId = oEvent.getSource().getSelectedKey();

            if (sPrId) {
                this._loadProcessFlow(sPrId);
            }
        },

        onRefreshProcessFlow() {

            const oSelect = this.byId("pfPrSelect");
            const sPrId = oSelect ? oSelect.getSelectedKey() : null;

            if (sPrId) {
                this._loadProcessFlow(sPrId);
            }
        },
        onShowProcessFlowSection() {

            this._initProcessFlowModel();

            const oSelect = this.byId("pfPrSelect");
            const oBinding = oSelect ? oSelect.getBinding("items") : null;

            if (oBinding) {
                oBinding.refresh();
            }
        },

        async _loadProcessFlow(sPrId) {

            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);

            try {

                const oPrResp = await fetch(`/procurement/PurchaseRequisitions(${sPrId})`);
                const oPr = await oPrResp.json();

                const sStatus = oPr.status || "DRAFT";

                // happy-path order, used to work out what's "completed" vs "not yet reached"
                const aHappyPath = ["DRAFT", "SUBMITTED", "PENDING_APPROVAL", "APPROVED", "CLOSED"];
                const iCurrentIdx = aHappyPath.indexOf(sStatus);
                const bWasRejected = sStatus === "REJECTED";

                const stageState = (iStageIdx) => {

                    if (bWasRejected) {
                        // once rejected: Draft/Submitted/Pending are completed, Approved/Closed never reached
                        return iStageIdx <= 2 ? "Positive" : "Neutral";
                    }

                    return iStageIdx <= iCurrentIdx ? "Positive" : "Neutral";
                };

                const aNodes = [
                    {
                        lane: "lane1",
                        nodeId: "draft",
                        title: "Draft",
                        texts: [oPr.prNumber, "Requested by " + oPr.requestedBy],
                        state: stageState(0),
                        stateText: "DRAFT",
                        highlighted: sStatus === "DRAFT",
                        focused: sStatus === "DRAFT",
                        children: ["submitted"]
                    },
                    {
                        lane: "lane2",
                        nodeId: "submitted",
                        title: "Submitted",
                        texts: ["Submitted for review"],
                        state: stageState(1),
                        stateText: "SUBMITTED",
                        highlighted: sStatus === "SUBMITTED",
                        focused: sStatus === "SUBMITTED",
                        children: ["pending"]
                    },
                    {
                        lane: "lane3",
                        nodeId: "pending",
                        title: "Pending Approval",
                        texts: ["Awaiting decision"],
                        state: stageState(2),
                        stateText: "PENDING_APPROVAL",
                        highlighted: sStatus === "PENDING_APPROVAL",
                        focused: sStatus === "PENDING_APPROVAL",
                        // always branches into both possible outcomes
                        children: ["approved", "rejected"]
                    },
                    {
                        lane: "lane4",
                        nodeId: "approved",
                        title: "Approved",
                        texts: [oPr.approvedBy ? "Approved by " + oPr.approvedBy : "Not yet approved"],
                        state: (sStatus === "APPROVED" || sStatus === "CLOSED") ? "Positive" : "Neutral",
                        stateText: "APPROVED",
                        highlighted: sStatus === "APPROVED",
                        focused: sStatus === "APPROVED",
                        // always connects onward to Closed — that's the intended path once approved
                        children: ["closed"]
                    },
                    {
                        lane: "lane4",
                        nodeId: "rejected",
                        title: "Rejected",
                        texts: [
                            oPr.rejectionReason || "No reason provided",
                            "Resubmit to return to Draft"
                        ],
                        state: bWasRejected ? "Negative" : "Neutral",
                        stateText: "REJECTED",
                        highlighted: bWasRejected,
                        focused: bWasRejected,
                        // terminal — rejection doesn't flow onwarthis.byId("pfPrSelect").getBinding("items").refresh();d to Closed
                        children: []
                    },
                    {
                        lane: "lane5",
                        nodeId: "closed",
                        title: sStatus === "CLOSED" ? "Closed" : "Closed (pending)",
                        texts: [sStatus === "CLOSED" ? "Procurement completed" : "Awaiting final closure"],
                        state: sStatus === "CLOSED" ? "Positive" : "Neutral",
                        stateText: "CLOSED",
                        highlighted: sStatus === "CLOSED",
                        focused: sStatus === "CLOSED",
                        children: []
                    }
                ];

                const aLanes = [
                    { laneId: "lane1", icon: "sap-icon://request", text: "Draft", position: 0 },
                    { laneId: "lane2", icon: "sap-icon://paper-plane", text: "Submitted", position: 1 },
                    { laneId: "lane3", icon: "sap-icon://approvals", text: "Pending Approval", position: 2 },
                    { laneId: "lane4", icon: "sap-icon://decision", text: "Decision", position: 3 },
                    { laneId: "lane5", icon: "sap-icon://complete", text: "Closed", position: 4 }
                ];

                this.getView().setModel(new JSONModel({ nodes: aNodes, lanes: aLanes }), "pf");

            } catch (e) {

                MessageBox.error("Unable to load process flow: " + e.message);

            } finally {

                oViewModel.setProperty("/busy", false);
            }
        },

        onProcessFlowNodePress(oEvent) {

            MessageToast.show("Node: " + oEvent.getParameter("nodeId"));
        },
        onPRComboLiveChange(oEvent) {

            const oComboBox = oEvent.getSource();
            const sTypedValue = oEvent.getParameter("value") || "";

            const oBinding = oComboBox.getBinding("items");

            if (!oBinding) {
                return;
            }

            if (!sTypedValue) {
                oBinding.filter([]);
                return;
            }

            const aFilters = [
                new Filter("prNumber", FilterOperator.Contains, sTypedValue),
                new Filter("status", FilterOperator.Contains, sTypedValue)
            ];

            oBinding.filter(new Filter({ filters: aFilters, and: false }));

            if (!oComboBox.isOpen()) {
                oComboBox.open();
            }
        },
    };
});