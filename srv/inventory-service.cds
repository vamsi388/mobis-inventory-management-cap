using mobis.db as db from '../db/schema';

@requires: 'authenticated-user'
service InventoryService @(path: '/inventory') {
  @readonly 
  entity SpareParts as projection on db.SpareParts;
  @readonly 
  entity Locations  as projection on db.Locations;

  @restrict: [
    { grant: 'READ', to: 'WarehouseExecutive', where: 'location.region = $user.region' },
    { grant: 'READ', to: 'ProcurementOfficer' }
  ]
  @readonly 
  entity Inventory  as projection on db.Inventory;

  @restrict: [
    { grant: 'READ', to: ['WarehouseExecutive','ProcurementOfficer'] }
  ]
  @readonly 
  entity StockMovements as projection on db.StockMovements;

  @restrict: [
    { grant: 'READ', to: ['WarehouseExecutive','ProcurementOfficer'] }
  ]
  @readonly 
  entity AlertNotifications as projection on db.AlertNotifications;

  @restrict: [{ grant: 'issueStock', to: 'WarehouseExecutive' }]
  action issueStock(partID: UUID,locationID : UUID,quantity : Integer,reference : String) returns StockMovements;

  @restrict: [{ grant: 'transferStock', to: 'WarehouseExecutive' }]
  action transferStock(partID:UUID,fromLocationID:UUID,toLocationID:UUID,quantity:Integer,reference:String)returns StockMovements;

  @restrict: [{ grant: 'getAvailableStock', to: ['WarehouseExecutive','ProcurementOfficer'] }]
  function getAvailableStock(partID: UUID, locationID: UUID) returns Integer;
}
