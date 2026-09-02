/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["procurement/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
