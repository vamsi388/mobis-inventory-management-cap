sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], (JSONModel, MessageToast) => {
    "use strict";

    return {

        onRefreshSupplierPerf() {
            this._refreshTable("supplierPerfTable");
        },

        _loadUsers() {

            if (this.getView().getModel("users")) {
                return;
            }

            this.getView().setModel(new JSONModel({
                list: [
                    { name: "Rajesh Kumar", email: "rajesh.kumar@mobis.com", role: "Procurement Team", active: true },
                    { name: "Priya Sharma", email: "priya.sharma@mobis.com", role: "Inventory Manager", active: true },
                    { name: "Admin User", email: "admin@mobis.com", role: "Administrator", active: true },
                    { name: "Vikram Singh", email: "vikram.singh@mobis.com", role: "Warehouse Executive", active: false }
                ]
            }), "users");
        },

        onAddUser() {
            MessageToast.show("Add User dialog — wire this to a real Users entity once available in the backend.");
        },

        onToggleUserStatus(oEvent) {

            const oContext = oEvent.getSource().getBindingContext("users");
            const bCurrent = oContext.getProperty("active");

            oContext.getModel().setProperty(oContext.getPath() + "/active", !bCurrent);
        },

        _loadRoles() {

            if (this.getView().getModel("roles")) {
                return;
            }

            this.getView().setModel(new JSONModel({
                list: [
                    {
                        role: "Warehouse Executive",
                        description: "Manages day-to-day warehouse stock movement",
                        permissions: "Receive Stock, Issue Stock, Stock Transfer"
                    },
                    {
                        role: "Procurement Team",
                        description: "Handles supplier ordering",
                        permissions: "Create Purchase Requisition/Order, view Supplier data"
                    },
                    {
                        role: "Inventory Manager",
                        description: "Oversees inventory and approvals",
                        permissions: "Approve Purchase Orders, monitor stock levels, view reports"
                    },
                    {
                        role: "Administrator",
                        description: "System configuration",
                        permissions: "Manage users, roles, and master data"
                    }
                ]
            }), "roles");
        }
    };
});