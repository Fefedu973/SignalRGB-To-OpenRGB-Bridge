const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const bridgePath = path.join(__dirname, "..", "OpenRGBBridge.js");
let source = fs.readFileSync(bridgePath, "utf8");
source = source
	.replace(/^import tcp from "@SignalRGB\/tcp";\s*/m, "")
	.replace(/\bexport function\b/g, "function");
source += "\nglobalThis.__bridgeTest = { DiscoveryService };\n";

const settings = new Map();
const entries = [];
const controllers = new Map();
const announced = [];
const suppressed = [];

function findEntry(id) {
	return entries.find((entry) => entry.id === id);
}

const service = {
	controllers: entries,
	getSetting(group, key) {
		return settings.get(group + ":" + key);
	},
	saveSetting(group, key, value) {
		settings.set(group + ":" + key, value);
	},
	getController(id) {
		return controllers.get(id);
	},
	addController(controller) {
		controllers.set(controller.id, controller);
		if (!findEntry(controller.id)) {
			entries.push({ id: controller.id, obj: controller });
		}
	},
	updateController(controller) {
		controllers.set(controller.id, controller);
		const entry = findEntry(controller.id);
		if (entry) {
			entry.obj = controller;
		}
	},
	removeController(controller) {
		const id = typeof controller === "string" ? controller : controller.id;
		const index = entries.findIndex((entry) => entry.id === id);
		if (index >= 0) {
			entries.splice(index, 1);
		}
		controllers.delete(id);
	},
	announceController(controller) {
		announced.push(controller.id);
		controllers.set(controller.id, controller);
		if (!findEntry(controller.id)) {
			entries.push({ id: controller.id, obj: controller });
		}
	},
	suppressController(controller) {
		suppressed.push(controller.id);
		const index = entries.findIndex((entry) => entry.id === controller.id);
		if (index >= 0) {
			entries.splice(index, 1);
		}
	},
	log() {}
};

const context = {
	console,
	Date,
	JSON,
	Math,
	Map,
	Set,
	Uint8Array,
	ArrayBuffer,
	TextDecoder,
	service,
	tcp: {},
	device: { log() {} }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: bridgePath });

const discovery = new context.__bridgeTest.DiscoveryService();
discovery.needsScan = false;

const gpu = {
	deviceId: "openrgb-test-gpu",
	id: "openrgb-test-gpu",
	name: "MSI RX 6800 Z Trio",
	vendor: "MSI",
	openrgbIndex: 0,
	openrgbHost: "127.0.0.1",
	openrgbPort: 6742,
	ledCount: 3,
	zoneCount: 1,
	type: 2,
	zones: [],
	leds: [],
	modes: [],
	colors: []
};

discovery.availableDevices = [gpu];
discovery.availableDeviceSummaries = [gpu];
discovery.selectedDevices = [];
discovery.requestControllerSync();

assert.equal(
	service.getController(gpu.deviceId),
	undefined,
	"QML-facing actions must not mutate service.controllers synchronously"
);

let catalogue = JSON.parse(discovery.statusController.bridgeDevicesJson);
assert.equal(catalogue.length, 1, "a discovered controller must be present in the UI catalogue");
assert.equal(catalogue[0].deviceId, gpu.deviceId);
assert.equal(catalogue[0].bridgeDeleted, true, "an unselected controller must be restorable");

discovery.Update();
assert.ok(service.getController(gpu.deviceId), "the service tick must register the controller");
assert.deepEqual(suppressed, [gpu.deviceId], "an unselected controller must stay suppressed");
assert.equal(
	findEntry(gpu.deviceId),
	undefined,
	"the test must reproduce SignalRGB hiding a suppressed controller from QML"
);
catalogue = JSON.parse(discovery.statusController.bridgeDevicesJson);
assert.equal(
	catalogue[0].bridgeDeleted,
	true,
	"the independent catalogue must retain a controller hidden from service.controllers"
);

discovery.restoreDevice(gpu.deviceId);
assert.deepEqual(
	announced,
	[],
	"restoring from QML must defer announcement until the service tick"
);
catalogue = JSON.parse(discovery.statusController.bridgeDevicesJson);
assert.equal(catalogue[0].bridgeDeleted, false, "restoring must immediately update the UI catalogue");

discovery.Update();
assert.deepEqual(announced, [gpu.deviceId], "the next service tick must announce the restored controller");
assert.ok(findEntry(gpu.deviceId), "announcing must make the controller visible to SignalRGB");

discovery.removeDevice(gpu.deviceId);
assert.deepEqual(
	suppressed,
	[gpu.deviceId],
	"deleting from QML must defer suppression until the service tick"
);
catalogue = JSON.parse(discovery.statusController.bridgeDevicesJson);
assert.equal(catalogue[0].bridgeDeleted, true, "deleting must leave a restorable catalogue row");

discovery.Update();
assert.deepEqual(
	suppressed,
	[gpu.deviceId, gpu.deviceId],
	"the next service tick must suppress the deleted controller"
);

discovery.availableDevices = [];
discovery.availableDeviceSummaries = [];
discovery.queueStaleControllers([gpu], []);
discovery.requestControllerSync();
assert.ok(
	service.getController(gpu.deviceId),
	"removing a stale hidden controller must also be deferred"
);
discovery.Update();
assert.equal(
	service.getController(gpu.deviceId),
	undefined,
	"the service tick must remove stale controllers even when QML cannot see them"
);
assert.deepEqual(
	JSON.parse(discovery.statusController.bridgeDevicesJson),
	[],
	"stale controllers must disappear from the independent catalogue"
);

console.log("OpenRGB device-state validation passed.");
