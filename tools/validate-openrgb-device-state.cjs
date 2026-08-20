const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const bridgePath = path.join(__dirname, "..", "OpenRGBBridge.js");
const qmlPath = path.join(__dirname, "..", "OpenRGBBridge.qml");
const rawSource = fs.readFileSync(bridgePath, "utf8");
let source = rawSource;
const qmlSource = fs.readFileSync(qmlPath, "utf8");
source = source
	.replace(/^import\s+tcp\s+from\s+"@SignalRGB\/tcp";\s*/m, "")
	.replace(/\bexport function\b/g, "function");
source += "\nglobalThis.__bridgeTest = { DiscoveryService, OpenRGBClient, Initialize };\n";

const settings = new Map();
const entries = [];
const controllers = new Map();
const announced = [];
const announcedControllers = [];
const suppressed = [];
const added = [];
const removed = [];
const sockets = [];

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
		added.push(controller.id);
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
		removed.push(id);
		const index = entries.findIndex((entry) => entry.id === id);
		if (index >= 0) {
			entries.splice(index, 1);
		}
		controllers.delete(id);
	},
	announceController(controller) {
		announced.push(controller.id);
		announcedControllers.push(controller);
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
	tcp: {
		createSocket() {
			const socket = {
				handlers: {},
				sent: [],
				on(eventName, callback) {
					this.handlers[eventName] = callback;
				},
				connect(host, port) {
					this.host = host;
					this.port = port;
				},
				send(data) {
					this.sent.push(data);
				},
				close() {
					this.closed = true;
					if (this.handlers.close) {
						this.handlers.close();
					}
				}
			};
			sockets.push(socket);
			return socket;
		}
	},
	device: {
		log() {},
		setName(name) {
			this.name = name;
		},
		setImageFromUrl(image) {
			this.image = image;
		},
		setSize(size) {
			this.size = size;
		},
		setControllableLeds(names, positions) {
			this.ledNames = names;
			this.ledPositions = positions;
		}
	}
};
vm.createContext(context);
vm.runInContext(source, context, { filename: bridgePath });

assert.match(qmlSource, /discovery\.getUiState\(pollRevision\)/, "QML must poll the live cache-busted state method");
assert.match(qmlSource, /service\.getSetting\("General", "UiState"\)/, "QML must read the persisted cross-thread UI state");
assert.match(
	rawSource,
	/^import tcp from "@SignalRGB\/tcp";/m,
	"the plugin must use SignalRGB 2.5.76's default TCP export"
);
assert.doesNotMatch(source, /statusController\s*=/, "the discovery service must not register a synthetic status controller");
assert.match(rawSource, /setSubdeviceLeds\(subdeviceId, map\.names, map\.positions\)/, "subdevice LEDs must use SignalRGB's three-argument API");

const discovery = new context.__bridgeTest.DiscoveryService();
discovery.needsScan = false;
const statusControllerId = "openrgb-bridge-status";
assert.equal(
	added.filter((id) => id === statusControllerId).length,
	0,
	"service construction must not add a synthetic status controller"
);

for (let i = 0; i < 5; i++) {
	discovery.setStatus("Status update " + i);
	discovery.Update();
}
assert.equal(
	added.filter((id) => id === statusControllerId).length,
	0,
	"status changes must not add a synthetic status controller"
);
assert.equal(
	removed.filter((id) => id === statusControllerId).length,
	0,
	"status changes must not remove a synthetic status controller"
);

let uiState = JSON.parse(discovery.getUiState(42));
assert.equal(uiState.pollToken, "42", "the UI snapshot must echo its cache-busting poll token");
assert.equal(uiState.status, "Status update 4", "the UI snapshot must expose the latest status");

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

uiState = JSON.parse(discovery.getUiState(43));
assert.equal(JSON.parse(uiState.devicesJson)[0].deviceId, gpu.deviceId, "the live UI snapshot must expose the device catalogue");

assert.equal(
	service.getController(gpu.deviceId),
	undefined,
	"QML-facing actions must not mutate service.controllers synchronously"
);

let catalogue = JSON.parse(discovery.deviceCatalogJson);
assert.equal(catalogue.length, 1, "a discovered controller must be present in the UI catalogue");
assert.equal(catalogue[0].deviceId, gpu.deviceId);
assert.equal(catalogue[0].bridgeDeleted, true, "an unselected controller must be restorable");

discovery.Update();
assert.equal(
	service.getController(gpu.deviceId),
	undefined,
	"an unselected controller must remain outside SignalRGB's controller registry"
);
assert.deepEqual(suppressed, [], "an unselected controller must not create a shell just to suppress it");
assert.equal(
	findEntry(gpu.deviceId),
	undefined,
	"the independent catalogue must not require an inactive service.controllers entry"
);
catalogue = JSON.parse(discovery.deviceCatalogJson);
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
catalogue = JSON.parse(discovery.deviceCatalogJson);
assert.equal(catalogue[0].bridgeDeleted, false, "restoring must immediately update the UI catalogue");

discovery.Update();
assert.deepEqual(announced, [gpu.deviceId], "the next service tick must announce the restored controller");
assert.ok(findEntry(gpu.deviceId), "announcing must make the controller visible to SignalRGB");
assert.equal(announcedControllers[0].name, gpu.name, "the announced controller must retain its OpenRGB name");
assert.equal(announcedControllers[0].ledCount, gpu.ledCount, "the announced controller must retain its LED count");

discovery.removeDevice(gpu.deviceId);
assert.deepEqual(
	suppressed,
	[],
	"deleting from QML must defer suppression until the service tick"
);
catalogue = JSON.parse(discovery.deviceCatalogJson);
assert.equal(catalogue[0].bridgeDeleted, true, "deleting must leave a restorable catalogue row");

discovery.Update();
assert.deepEqual(
	suppressed,
	[gpu.deviceId],
	"the next service tick must suppress the deleted controller"
);
assert.equal(
	service.getController(gpu.deviceId),
	undefined,
	"a deleted controller must not leave a stale shell in SignalRGB's registry"
);

const staleControllerShell = {
	id: gpu.deviceId,
	deviceId: gpu.deviceId,
	bridgeDeleted: true
};
controllers.set(gpu.deviceId, staleControllerShell);

discovery.restoreDevice(gpu.deviceId);
discovery.Update();

assert.deepEqual(
	announced,
	[gpu.deviceId, gpu.deviceId],
	"restoring must announce a controller even when SignalRGB retained a stale shell"
);
assert.notEqual(
	announcedControllers[1],
	staleControllerShell,
	"a stale SignalRGB shell must never be announced as the restored device"
);
assert.equal(announcedControllers[1].name, gpu.name, "the replacement controller must have the OpenRGB name");
assert.equal(announcedControllers[1].ledCount, gpu.ledCount, "the replacement controller must have its LEDs");

context.controller = announcedControllers[1];
context.__bridgeTest.Initialize();
assert.equal(context.device.name, gpu.name, "device initialization must expose the real OpenRGB name");
assert.equal(context.device.ledNames.length, gpu.ledCount, "device initialization must expose every OpenRGB LED");

const protocolClient = new context.__bridgeTest.OpenRGBClient({
	host: "127.0.0.1",
	port: 6742,
	connectTimeoutMs: 0
});
protocolClient.connect();
const protocolSocket = sockets[sockets.length - 1];
assert.equal(typeof protocolSocket.handlers.connection, "function", "the client must bind SignalRGB 2.5.76's connection event");
assert.equal(typeof protocolSocket.handlers.close, "function", "the client must bind SignalRGB 2.5.76's close event");
assert.equal(protocolSocket.handlers.connected, undefined, "the client must not bind an event rejected by SignalRGB 2.5.76");
assert.equal(protocolSocket.handlers.disconnected, undefined, "the client must not bind an event rejected by SignalRGB 2.5.76");
protocolSocket.handlers.connection();
assert.equal(protocolClient.connected, true, "the SignalRGB 2.5.76 connection event must complete the TCP connection");
assert.equal(protocolSocket.sent.length, 1, "connecting must send the OpenRGB protocol-version request");
protocolSocket.handlers.close();
assert.equal(protocolClient.connected, false, "the SignalRGB 2.5.76 close event must tear down the connection");
assert.equal(protocolSocket.closed, true, "the close event must close its socket without recursive overflow");
protocolClient.close();

const backoffClient = new context.__bridgeTest.OpenRGBClient({
	host: "127.0.0.1",
	port: 6742,
	connectTimeoutMs: 0,
	reconnectDelayMs: 5000
});
backoffClient.connect();
const socketsBeforeRenderFailure = sockets.length;
backoffClient.handleError("connection refused");
for (let i = 0; i < 100; i++) {
	backoffClient.ensureConnected();
}
assert.equal(
	sockets.length,
	socketsBeforeRenderFailure,
	"render frames must not create a tight TCP reconnect loop after an SDK failure"
);

discovery.refresh("127.0.0.1", 6742);
const failedSocketCount = sockets.length;
discovery.client.handleError("connection refused");
assert.equal(discovery.needsScan, false, "a failed SDK connection must wait for an explicit user retry");
for (let i = 0; i < 10; i++) {
	discovery.Update();
}
assert.equal(sockets.length, failedSocketCount, "Update must not create an endless socket retry loop after failure");
assert.equal(
	removed.filter((id) => id === statusControllerId).length,
	0,
	"connection failures must not touch a synthetic status controller"
);

discovery.selectedDevices = [];
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
	JSON.parse(discovery.deviceCatalogJson),
	[],
	"stale controllers must disappear from the independent catalogue"
);

console.log("OpenRGB device-state validation passed.");
