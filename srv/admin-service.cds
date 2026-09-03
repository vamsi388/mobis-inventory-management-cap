using mobis.db as db from '../db/schema';


@requires: 'authenticated-user'
service AdminService @(path: '/admin') {
  @restrict: [{ grant: ['READ','CREATE','UPDATE','DELETE'], to: 'MasterDataSteward' }]
  entity SpareParts as projection on db.SpareParts;

  @restrict: [{ grant: ['READ','CREATE','UPDATE','DELETE'], to: 'MasterDataSteward' }]
  entity Suppliers  as projection on db.Suppliers;

  @restrict: [{ grant: ['READ','CREATE','UPDATE','DELETE'], to: 'MasterDataSteward' }]
  entity Locations  as projection on db.Locations;

  @restrict: [{ grant: 'READ', to: ['MasterDataSteward','Auditor'] }]
  @readonly 
  entity ApplicationLogs as projection on db.ApplicationLogs;
}
