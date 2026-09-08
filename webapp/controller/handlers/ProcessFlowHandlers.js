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
                        { laneId: "lane1", icon: "sap-icon://request", text: "Requisition", position: 0 },
                        { laneId: "lane2", icon: "sap-icon://cart", text: "Purchase Order", position: 1 },
                        { laneId: "lane3", icon: "sap-icon://shipping-status", text: "Goods Receipt", position: 2 }
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

        async _loadProcessFlow(sPrId) {

            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);

            try {

                const [prResp, poResp] = await Promise.all([
                    fetch(`/procurement/PurchaseRequisitions(${sPrId})`),
                    fetch(`/procurement/PurchaseOrders?$filter=pr_ID eq ${sPrId}`)
                ]);

                const oPr = await prResp.json();
                const oPoData = await poResp.json();
                const aPOs = oPoData.value || [];

                let aGRs = [];

                if (aPOs.length) {

                    const oGrResp = await fetch(`/procurement/GoodsReceipts?$filter=po_ID eq ${aPOs[0].ID}`);
                    aGRs = (await oGrResp.json()).value || [];
                }

                const mapPrState = (s) => ({
                    DRAFT: "Neutral",
                    SUBMITTED: "Positive",
                    APPROVED: "Positive",
                    REJECTED: "Negative",
                    CONVERTED: "Positive"
                }[s] || "Neutral");

                const mapPoState = (s) => ({
                    CREATED: "Neutral",
                    SENT: "Positive",
                    PARTIALLY_RECEIVED: "Critical",
                    RECEIVED: "Positive",
                    CLOSED: "Positive",
                    CANCELLED: "Negative"
                }[s] || "Neutral");

                const aNodes = [
                    {
                        lane: "lane1",
                        nodeId: "pr",
                        title: oPr.prNumber,
                        texts: [oPr.status, "Requested by " + oPr.requestedBy],
                        state: mapPrState(oPr.status),
                        stateText: oPr.status,
                        children: aPOs.length ? ["po"] : []
                    }
                ];

                if (aPOs.length) {

                    aNodes.push({
                        lane: "lane2",
                        nodeId: "po",
                        title: aPOs[0].poNumber,
                        texts: [aPOs[0].status],
                        state: mapPoState(aPOs[0].status),
                        stateText: aPOs[0].status,
                        children: aGRs.length ? ["gr"] : []
                    });
                }

                if (aGRs.length) {

                    aNodes.push({
                        lane: "lane3",
                        nodeId: "gr",
                        title: aGRs[0].grNumber,
                        texts: ["Received by " + aGRs[0].receivedBy],
                        state: "Positive",
                        stateText: "RECEIVED",
                        children: []
                    });
                }

                const aLanes = [
                    { laneId: "lane1", icon: "sap-icon://request", text: "Requisition", position: 0 },
                    { laneId: "lane2", icon: "sap-icon://cart", text: "Purchase Order", position: 1 },
                    { laneId: "lane3", icon: "sap-icon://shipping-status", text: "Goods Receipt", position: 2 }
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
        }
    };
});