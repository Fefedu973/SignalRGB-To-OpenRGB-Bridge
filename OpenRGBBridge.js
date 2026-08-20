import tcp from "@SignalRGB/tcp";

export function Name() { return "OpenRGB Bridge"; }
export function Version() { return "2.0.2"; }
export function Type() { return "network"; }
export function Publisher() { return "Fefe_du_973"; }
export function Size() { return [1, 1]; }
export function DefaultPosition() { return [0, 70]; }
export function DefaultScale() { return 1.0; }

export function ControllableParameters() {
	return [
		{ property: "shutdownColor", group: "lighting", label: "Shutdown Color", min: "0", max: "360", type: "color", default: "#009bde" },
		{ property: "LightingMode", group: "lighting", label: "Lighting Mode", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
		{ property: "forcedColor", group: "lighting", label: "Forced Color", min: "0", max: "360", type: "color", default: "#009bde" }
	];
}

const SETTINGS_GROUP = "General";
const HOST_SETTING = "SDKServerIP";
const PORT_SETTING = "SDKServerPort";
const SELECTED_DEVICES_SETTING = "SelectedDevices";
const LAST_DEVICES_SETTING = "LastDevices";
const UI_STATE_SETTING = "UiState";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 6742;
const CLIENT_PROTOCOL_VERSION = 5;
const CLIENT_NAME = "SignalRGB OpenRGB Bridge";
const BRIDGE_CONTROLLER_ID = "openrgb-bridge";
// Stable fallback carrier for SignalRGB builds whose QML bridge cannot invoke the live
// discovery state method. Never remove/re-add this controller: doing that from Update()
// mutates SignalRGB's network-controller model and can crash the native application.
const STATUS_CONTROLLER_ID = "openrgb-bridge-status";
const ICON_URL = "https://raw.githubusercontent.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge/main/signalbridge.png";
const DEVICE_ICON_BASE_URL = "https://raw.githubusercontent.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge/main/icons/openrgb_white/";
const BRIDGE_DEVICE_ICON_BASE_URL = "https://raw.githubusercontent.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge/main/icons/openrgb_bridge/";
const REQUEST_TIMEOUT_MS = 10000;
const DISCOVERY_REQUEST_TIMEOUT_MS = 10000;
const CONNECT_TIMEOUT_MS = 5000;
const AUTO_CONNECT_INTERVAL_MS = 4000;

const DeviceTypeIcon = {
	0: "mainboard",
	1: "dram",
	2: "gpu",
	3: "cooler",
	4: "ledstrip",
	5: "keyboard",
	6: "mouse",
	7: "mousemat",
	8: "headset",
	9: "headsetstand",
	10: "gamepad",
	11: "bulb",
	12: "music_speaker",
	13: "controller",
	14: "drive",
	15: "pc_case",
	16: "mic",
	17: "usb",
	18: "keypad",
	19: "unknown",
	20: "laptop",
	21: "monitor"
};

const Command = {
	requestControllerCount: 0,
	requestControllerData: 1,
	requestProtocolVersion: 40,
	setClientName: 50,
	deviceListUpdated: 100,
	requestRescanDevices: 140,
	updateLeds: 1050,
	setCustomMode: 1100
};

let renderClient;
let renderClientKey = "";
let renderStates = {};

export function Initialize() {
	device.setName(controller.name || "OpenRGB Device");
	device.setImageFromUrl(controller.image || ICON_URL);

	const stateKey = getRenderStateKey(controller);
	renderStates[stateKey] = buildSignalRgbLayout(controller);
	ensureRenderClient(controller, logFromDevice);
}

export function Render() {
	const client = ensureRenderClient(controller, logFromDevice);
	if (!client) {
		return;
	}

	client.ensureConnected();

	const stateKey = getRenderStateKey(controller);
	const state = renderStates[stateKey] || buildSignalRgbLayout(controller);
	renderStates[stateKey] = state;

	if (client.isReady()) {
		setCustomModesForState(client, state);
	}

	const frames = collectFrameColors(state);
	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i];
		const signature = makeFrameSignature(frame.colors);
		const signatureKey = String(frame.openrgbIndex);

		if (signature !== state.lastFrameSignatures[signatureKey]) {
			client.updateLeds(frame.openrgbIndex, frame.colors);
			state.lastFrameSignatures[signatureKey] = signature;
		}
	}

	device.pause(16);
}

export function Shutdown() {
	const stateKey = getRenderStateKey(controller);
	delete renderStates[stateKey];

	if (!renderClient) {
		return;
	}

	const rgb = hexToRgb(shutdownColor);
	const devices = controller.devices || [controller];
	for (let i = 0; i < devices.length; i++) {
		renderClient.updateLeds(devices[i].openrgbIndex, fillColors(getControllerLedCount(devices[i]), rgb));
	}
	closeRenderClientIfIdle();
}

export function DiscoveryService() {
	this.IconUrl = ICON_URL;
	this.availableDevices = [];
	this.availableDeviceSummaries = readLastDeviceSummaries();
	this.selectedDevices = readSelectedDevices();
	this.hasStoredSelectedDevices = hasStoredSelectedDevices();
	if (!this.hasStoredSelectedDevices && this.availableDeviceSummaries.length > 0) {
		this.selectedDevices = this.availableDeviceSummaries.slice(0);
	}
	this.status = buildLookingForStatus();
	this.client = undefined;
	this.refreshId = 0;
	this.busy = false;
	// Controller registration is processed from Update(), never directly from a QML
	// button handler or a TCP callback. Mutating service.controllers while QML is
	// rendering it is unsafe in current SignalRGB builds and caused refresh crashes.
	this.controllersDirty = true;
	this.controllerSyncTimer = undefined;
	this.syncingControllers = false;
	this.pendingControllerRemovals = [];
	// Keep UI-only state on the discovery service. Registering a synthetic controller
	// during service construction can stop the discovery thread in SignalRGB 2.5.76.
	this.deviceCatalogJson = "[]";
	this.uiStateRevision = 0;
	// Make one automatic discovery attempt on startup. A failed SDK connection is left
	// idle until the user explicitly retries, avoiding an endless create/timeout/close
	// socket loop when OpenRGB is installed but its SDK server is disabled.
	this.needsScan = true;
	this.lastAutoAttemptAt = 0;

	this.Initialize = function () {
		this.connectSelectedDevices();
		// A discovery service with no registered controller is not guaranteed to receive
		// Update() ticks in SignalRGB 2.5.76. Start the initial SDK discovery here so a
		// fresh installation can bootstrap its first OpenRGB controllers.
		const host = normalizeHost(readSetting(HOST_SETTING, DEFAULT_HOST));
		const port = readNumberSetting(PORT_SETTING, DEFAULT_PORT);
		this.refresh(host, port);
	};

	this.Update = function () {
		this.flushControllerSync();
		if (this.client) {
			this.client.checkRequestTimeouts();
			return;
		}

		if (!this.needsScan || this.busy) {
			return;
		}

		const now = Date.now();
		if (now - this.lastAutoAttemptAt < AUTO_CONNECT_INTERVAL_MS) {
			return;
		}
		this.lastAutoAttemptAt = now;

		const host = normalizeHost(readSetting(HOST_SETTING, DEFAULT_HOST));
		const port = readNumberSetting(PORT_SETTING, DEFAULT_PORT);
		this.refresh(host, port);
	};

	this.refresh = function (host, port) {
		host = normalizeHost(host);
		port = normalizePort(port);
		const refreshId = ++this.refreshId;
		this.busy = true;
		this.lastAutoAttemptAt = Date.now();
		saveSetting(HOST_SETTING, host);
		saveSetting(PORT_SETTING, String(port));
		this.setStatus("Connecting to OpenRGB at " + host + ":" + port + "...");

		if (this.client) {
			this.client.close();
		}

		const self = this;
		const client = new OpenRGBClient({
			host: host,
			port: port,
			clientName: CLIENT_NAME + " (Discovery)",
			logger: logFromService,
			onReady: function (client) {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus("Connected to OpenRGB at " + host + ":" + port + ". Reading controllers...");
				client.getAllControllers(function (devices, error) {
					if (self.refreshId !== refreshId || self.client !== client) {
						return;
					}

					if (error) {
						self.setStatus(error + " Click Connect / Refresh to retry.");
						self.needsScan = false;
						self.finishRefresh(client);
						return;
					}

					const knownBeforeRefresh = self.getAllKnownDevices();
					self.availableDevices = assignStableDeviceIds(devices, host, port);
					self.availableDeviceSummaries = buildDeviceSummaries(self.availableDevices);
					self.queueStaleControllers(knownBeforeRefresh, self.availableDevices);
					saveSetting(LAST_DEVICES_SETTING, JSON.stringify(self.availableDeviceSummaries));
					const selectedBeforeRefresh = self.selectedDevices.length > 0 ? self.selectedDevices : readSelectedDevices();
					self.hasStoredSelectedDevices = self.hasStoredSelectedDevices || hasStoredSelectedDevices();
					self.selectedDevices = self.hasStoredSelectedDevices
						? getSelectedDevicesById(self.availableDevices, selectedBeforeRefresh)
						: self.availableDeviceSummaries.slice(0);
					saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(self.selectedDevices));
					self.hasStoredSelectedDevices = true;
					self.requestControllerSync();
					self.needsScan = false;
					self.finishRefresh(client);
					self.setStatus("Connected to OpenRGB at " + host + ":" + port + ". Found " + self.availableDevices.length + " device(s).");
				});
			},
			onError: function (message) {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus("Could not reach OpenRGB at " + host + ":" + port + " (" + message + "). Start OpenRGB, enable the SDK server, then click Connect / Refresh.");
				self.needsScan = false;
				self.finishRefresh(client);
			},
			onProgress: function (message) {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus(message);
			},
			onDeviceListUpdated: function () {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.needsScan = true;
				self.setStatus("OpenRGB device list changed. Reloading...");
			}
		});

		this.client = client;
		client.connect();
		return this.status;
	};

	this.rescan = function () {
		const host = normalizeHost(readSetting(HOST_SETTING, DEFAULT_HOST));
		const port = readNumberSetting(PORT_SETTING, DEFAULT_PORT);
		this.busy = true;
		this.lastAutoAttemptAt = Date.now();
		this.setStatus("Requesting OpenRGB hardware rescan at " + host + ":" + port + "...");

		const self = this;
		const client = new OpenRGBClient({
			host: host,
			port: port,
			clientName: CLIENT_NAME + " (Rescan)",
			logger: logFromService,
			onReady: function (readyClient) {
				readyClient.requestRescanDevices();
				self.finishRefresh(readyClient);
				// Give OpenRGB a moment to finish the rescan, then auto-reload the list.
				self.needsScan = true;
				self.lastAutoAttemptAt = Date.now() - AUTO_CONNECT_INTERVAL_MS + 1500;
				self.setStatus("Requested an OpenRGB device rescan. Reloading shortly...");
			},
			onError: function (message) {
				self.finishRefresh(client);
				self.needsScan = false;
				self.setStatus("Could not request OpenRGB rescan: " + message + " Click Connect / Refresh to retry.");
			}
		});

		try {
			client.connect();
		} catch (error) {
			this.finishRefresh(client);
			this.needsScan = false;
			this.setStatus("Could not request OpenRGB rescan: " + error);
		}
		return this.status;
	};

	this.getHost = function () {
		return normalizeHost(readSetting(HOST_SETTING, DEFAULT_HOST));
	};

	this.getPort = function () {
		return String(readNumberSetting(PORT_SETTING, DEFAULT_PORT));
	};

	this.saveConnectionSettings = function (host, port) {
		host = normalizeHost(host);
		port = normalizePort(port);
		saveSetting(HOST_SETTING, host);
		saveSetting(PORT_SETTING, String(port));
		return host + ":" + port;
	};

	this.logUi = function (message) {
		logFromService(String(message || ""));
		return "";
	};

	this.getStatus = function () {
		if (this.client) {
			this.client.checkRequestTimeouts();
		}

		return String(this.status || buildLookingForStatus());
	};

	// The changing poll token prevents SignalRGB's QML bridge from reusing a cached
	// no-argument method result. Returning one JSON primitive keeps status, busy state,
	// and the independent device catalogue consistent within a single UI refresh.
	this.getUiState = function (pollToken) {
		return JSON.stringify({
			pollToken: String(pollToken === undefined ? "" : pollToken),
			status: String(this.status || buildLookingForStatus()),
			busy: !!this.busy,
			devicesJson: String(this.deviceCatalogJson || "[]")
		});
	};

	this.isBusy = function () {
		return !!this.busy;
	};

	this.removeDevice = function (deviceId) {
		deviceId = String(deviceId || "");
		// Keep the device known so it stays listed under "deleted" and can be restored.
		const deviceData = findDeviceById(this.selectedDevices, deviceId) || findDeviceById(this.getAllKnownDevices(), deviceId);
		if (deviceData) {
			this.rememberAvailable(deviceData);
		}
		this.selectedDevices = this.selectedDevices.filter(function (item) {
			return item.deviceId !== deviceId;
		});
		this.saveSelection();
		this.requestControllerSync();
		this.setStatus("Deleted device.");
		return this.status;
	};

	this.removeAllDevices = function () {
		const previouslySelected = this.selectedDevices || [];
		for (let i = 0; i < previouslySelected.length; i++) {
			this.rememberAvailable(previouslySelected[i]);
		}
		this.selectedDevices = [];
		this.saveSelection();
		this.requestControllerSync();
		this.setStatus("Deleted all OpenRGB devices.");
		return this.status;
	};

	this.restoreDevice = function (deviceId) {
		deviceId = String(deviceId || "");
		const deviceData = findDeviceById(this.getAllKnownDevices(), deviceId);
		if (!deviceData) {
			this.setStatus("Could not restore device. Click Connect / Refresh to reload OpenRGB devices.");
			return this.status;
		}

		this.selectedDevices = getSelectedDevicesById(this.availableDevices, this.selectedDevices.concat([deviceData]));
		this.saveSelection();
		this.requestControllerSync();
		this.setStatus("Restored " + deviceData.name + ".");
		return this.status;
	};

	this.restoreAllDevices = function () {
		this.selectedDevices = this.getAllKnownDevices().slice(0);
		this.saveSelection();
		this.requestControllerSync();
		this.setStatus("Restored all OpenRGB devices.");
		return this.status;
	};

	this.connectSelectedDevices = function () {
		this.selectedDevices = readSelectedDevices();
		this.requestControllerSync();
		return String(this.selectedDevices.length);
	};

	this.saveSelection = function () {
		this.selectedDevices = getSelectedDevicesById(this.availableDevices, this.selectedDevices);
		saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(this.selectedDevices));
		this.hasStoredSelectedDevices = true;
	};

	// Every OpenRGB device we have ever seen (current scan, persisted selection and
	// persisted summaries), de-duplicated by deviceId, preferring full data first.
	this.getAllKnownDevices = function () {
		const output = [];
		const seen = {};
		const push = function (device) {
			if (!device || !device.deviceId || seen[device.deviceId]) {
				return;
			}
			seen[device.deviceId] = true;
			output.push(device);
		};

		const lists = [this.availableDevices, this.selectedDevices, this.availableDeviceSummaries];
		for (let i = 0; i < lists.length; i++) {
			const list = lists[i] || [];
			for (let j = 0; j < list.length; j++) {
				push(list[j]);
			}
		}
		return output;
	};

	// Keep a device in the known/available set so it can still be listed (and restored)
	// after it is deleted, even when no fresh scan happened this session.
	this.rememberAvailable = function (deviceData) {
		if (!deviceData || !deviceData.deviceId) {
			return;
		}
		if (!findDeviceById(this.availableDevices, deviceData.deviceId)) {
			this.availableDevices = (this.availableDevices || []).concat([deviceData]);
		}
	};

	this.queueStaleControllers = function (previousDevices, currentDevices) {
		const currentIds = getDeviceIds(currentDevices);
		for (let i = 0; i < (previousDevices || []).length; i++) {
			const deviceId = previousDevices[i] && previousDevices[i].deviceId;
			if (!deviceId || currentIds.indexOf(deviceId) >= 0 || this.pendingControllerRemovals.indexOf(deviceId) >= 0) {
				continue;
			}
			this.pendingControllerRemovals.push(deviceId);
		}
	};

	// QML receives a stable catalogue directly from the discovery service instead of
	// deriving it from service.controllers. A suppressed controller remains visible
	// here and can always be restored.
	this.updateDeviceCatalog = function () {
		const selectedIds = getDeviceIds(this.selectedDevices);
		const rows = buildDeviceSummaries(this.getAllKnownDevices());
		for (let i = 0; i < rows.length; i++) {
			rows[i].bridgeDeleted = selectedIds.indexOf(rows[i].deviceId) < 0;
		}

		const json = JSON.stringify(rows);
		if (this.deviceCatalogJson === json) {
			return;
		}

		this.deviceCatalogJson = json;
		this.persistUiState();
	};

	this.requestControllerSync = function () {
		this.controllersDirty = true;
		this.updateDeviceCatalog();

		// SignalRGB 2.5.76 does not tick Update() while a discovery service has no
		// registered controllers. Defer the mutation out of the TCP/QML callback so the
		// first discovered (or restored) controllers can bootstrap normal Update ticks.
		if (typeof setTimeout === "function") {
			if (this.controllerSyncTimer !== undefined && typeof clearTimeout === "function") {
				clearTimeout(this.controllerSyncTimer);
			}
			const self = this;
			this.controllerSyncTimer = setTimeout(function () {
				self.controllerSyncTimer = undefined;
				self.flushControllerSync();
			}, 50);
		}
	};

	this.flushControllerSync = function () {
		if (this.controllerSyncTimer !== undefined && typeof clearTimeout === "function") {
			clearTimeout(this.controllerSyncTimer);
			this.controllerSyncTimer = undefined;
		}
		if (!this.controllersDirty || this.syncingControllers) {
			return;
		}

		this.controllersDirty = false;
		this.syncingControllers = true;
		try {
			this.syncControllers();
		} finally {
			this.syncingControllers = false;
		}
	};

	this.syncControllers = function () {
		// Drop the legacy single "OpenRGB Bridge" controller from the merged-subdevice era.
		closeRenderState(BRIDGE_CONTROLLER_ID);
		const bridgeToRemove = service.getController(BRIDGE_CONTROLLER_ID);
		if (bridgeToRemove !== undefined) {
			service.removeController(bridgeToRemove);
		}

		const selectedIds = getDeviceIds(this.selectedDevices);
		const allKnown = this.getAllKnownDevices();
		const knownIds = {};

		// Register only selected devices with SignalRGB. The QML list is driven by the
		// independent status-carrier catalogue, so inactive devices do not need to leave
		// behind suppressed controller shells in SignalRGB's internal registry.
		for (let i = 0; i < allKnown.length; i++) {
			const device = allKnown[i];
			if (!device.deviceId) {
				continue;
			}
			knownIds[device.deviceId] = true;
			this.applyController(device, selectedIds.indexOf(device.deviceId) >= 0);
		}

		const pendingRemovals = this.pendingControllerRemovals;
		this.pendingControllerRemovals = [];
		for (let i = 0; i < pendingRemovals.length; i++) {
			const id = pendingRemovals[i];
			if (knownIds[id]) {
				continue;
			}
			closeRenderState(id);
			const controllerToRemove = service.getController(id);
			if (controllerToRemove !== undefined) {
				service.removeController(controllerToRemove);
			}
		}

		// Drop controllers that are no longer known at all (e.g. stale/legacy ids).
		const existing = service.controllers || [];
		for (let i = existing.length - 1; i >= 0; i--) {
			const entry = existing[i];
			const id = entry ? (entry.id || (entry.obj && entry.obj.deviceId)) : undefined;
			if (!id || id === BRIDGE_CONTROLLER_ID || id === STATUS_CONTROLLER_ID || knownIds[id]) {
				continue;
			}

			closeRenderState(id);
			const controllerToRemove = service.getController(id);
			if (controllerToRemove !== undefined) {
				service.removeController(controllerToRemove);
			}
		}
	};

	this.applyController = function (deviceData, active) {
		if (!deviceData || !deviceData.deviceId) {
			return "";
		}

		const deviceId = deviceData.deviceId;
		let controller = service.getController(deviceId);

		if (!active) {
			deviceData.bridgeDeleted = true;
			closeRenderState(deviceId);
			if (controller !== undefined) {
				if (typeof service.suppressController === "function") {
					service.suppressController(controller);
				}
				service.removeController(controller);
			}
			return deviceId;
		}

		deviceData.bridgeDeleted = false;
		const isReusable = controller !== undefined &&
			typeof controller.updateWithValue === "function" &&
			!controller.bridgeDeleted;

		if (isReusable) {
			// Refresh metadata without re-announcing an already active device. Re-announcing
			// spawns duplicate render contexts and makes streaming increasingly laggy.
			controller.updateWithValue(deviceData);
			return deviceId;
		}

		if (controller !== undefined) {
			// SignalRGB can retain a lightweight shell after suppressing a controller. Such
			// a shell has no OpenRGB metadata and is displayed as "Thirdparty Plugin" with
			// zero LEDs if it is announced again. Always replace it with a complete instance.
			if (typeof service.suppressController === "function") {
				service.suppressController(controller);
			}
			service.removeController(controller);
		}

		controller = new OpenRGBController(deviceData);
		service.addController(controller);
		service.announceController(controller);

		return deviceId;
	};

	this.setStatus = function (message) {
		this.status = String(message || "");
		this.persistUiState();
		logFromService(this.status);
		return this.status;
	};

	this.persistUiState = function () {
		this.uiStateRevision++;
		saveSetting(UI_STATE_SETTING, JSON.stringify({
			revision: this.uiStateRevision,
			status: String(this.status || buildLookingForStatus()),
			busy: !!this.busy,
			devicesJson: String(this.deviceCatalogJson || "[]")
		}));
	};

	this.finishRefresh = function (client) {
		this.busy = false;
		if (this.client === client) {
			this.client = undefined;
		}
		if (client) {
			client.close();
		}
		this.persistUiState();
	};
}

class OpenRGBController {
	constructor(deviceData) {
		this.id = deviceData.deviceId;
		this.deviceId = deviceData.deviceId;
		this.openrgbIndex = deviceData.openrgbIndex;
		this.openrgbHost = deviceData.openrgbHost || DEFAULT_HOST;
		this.openrgbPort = deviceData.openrgbPort || DEFAULT_PORT;
		this.name = deviceData.name || "OpenRGB Device";
		this.vendor = deviceData.vendor || "";
		this.description = deviceData.description || "";
		this.version = deviceData.version || "";
		this.serial = deviceData.serial || "";
		this.location = deviceData.location || "";
		this.type = deviceData.type !== undefined ? deviceData.type : 19;
		this.activeMode = deviceData.activeMode || 0;
		this.modes = deviceData.modes || [];
		this.zones = deviceData.zones || [];
		this.leds = deviceData.leds || [];
		this.colors = deviceData.colors || [];
		this.ledCount = getControllerLedCount(deviceData);
		this.zoneCount = this.zones ? this.zones.length : 0;
		this.icon = getDeviceIconUrl(this.type);
		this.image = getBridgeDeviceIconUrl(this.type);
		// Tracks whether SignalRGB should announce or suppress this controller. QML gets
		// its independent active/deleted snapshot from the status-carrier catalogue.
		this.bridgeDeleted = !!deviceData.bridgeDeleted;
	}

	updateWithValue(deviceData) {
		this.openrgbIndex = deviceData.openrgbIndex;
		this.openrgbHost = deviceData.openrgbHost || this.openrgbHost;
		this.openrgbPort = deviceData.openrgbPort || this.openrgbPort;
		this.name = deviceData.name || this.name;
		this.vendor = deviceData.vendor || this.vendor;
		this.description = deviceData.description || this.description;
		this.version = deviceData.version || this.version;
		this.serial = deviceData.serial || this.serial;
		this.location = deviceData.location || this.location;
		this.type = deviceData.type !== undefined ? deviceData.type : this.type;
		this.icon = getDeviceIconUrl(this.type);
		this.image = getBridgeDeviceIconUrl(this.type);
		this.activeMode = deviceData.activeMode || this.activeMode;
		this.modes = deviceData.modes || this.modes;
		this.zones = deviceData.zones || this.zones;
		this.leds = deviceData.leds || this.leds;
		this.colors = deviceData.colors || this.colors;
		this.ledCount = getControllerLedCount(this);
		this.zoneCount = this.zones ? this.zones.length : 0;
		if (deviceData.bridgeDeleted !== undefined) {
			this.bridgeDeleted = !!deviceData.bridgeDeleted;
		}
		service.updateController(this);
	}
}

class OpenRGBClient {
	constructor(options) {
		this.host = normalizeHost(options.host);
		this.port = normalizePort(options.port);
		this.clientName = options.clientName || CLIENT_NAME;
		this.logger = options.logger || function () {};
		this.onReady = options.onReady || function () {};
		this.onError = options.onError || function () {};
		this.onProgress = options.onProgress || this.logger;
		this.onDisconnected = options.onDisconnected || function () {};
		this.onDeviceListUpdated = options.onDeviceListUpdated || function () {};
		this.connectTimeoutMs = options.connectTimeoutMs !== undefined ? options.connectTimeoutMs : CONNECT_TIMEOUT_MS;
		this.baseReconnectDelayMs = options.reconnectDelayMs !== undefined ? Math.max(0, options.reconnectDelayMs) : 5000;
		this.maxReconnectDelayMs = options.maxReconnectDelayMs !== undefined ? Math.max(this.baseReconnectDelayMs, options.maxReconnectDelayMs) : 60000;
		this.reconnectDelayMs = this.baseReconnectDelayMs;
		this.nextConnectAt = 0;
		this.socket = undefined;
		this.connected = false;
		this.ready = false;
		this.connecting = false;
		this.connectTimeoutId = undefined;
		this.protocolVersion = CLIENT_PROTOCOL_VERSION;
		this.rxBuffer = [];
		this.pending = [];
		this.lastError = "";
	}

	connect() {
		if (this.connected || this.connecting) {
			return;
		}
		if (Date.now() < this.nextConnectAt) {
			return;
		}

		if (!tcp || typeof tcp.createSocket !== "function") {
			this.reportError("SignalRGB TCP module is unavailable. Please update SignalRGB or install a build that supports network TCP addons.");
			return;
		}

		this.connecting = true;
		this.ready = false;
		this.rxBuffer = [];
		this.pending = [];

		try {
			this.socket = tcp.createSocket();
			// SignalRGB 2.5.76 exposes "connection" and reports documented aliases such as
			// "connected" as errors, so bind only the runtime's verified event names.
			if (!bindSocketEvent(this.socket, "connection", this.handleConnected.bind(this))) {
				throw new Error("SignalRGB TCP socket exposes no connection event");
			}
			if (!bindSocketEvent(this.socket, "close", this.handleDisconnected.bind(this)) ||
				!bindSocketEvent(this.socket, "message", this.handleMessage.bind(this)) ||
				!bindSocketEvent(this.socket, "error", this.handleError.bind(this))) {
				throw new Error("SignalRGB TCP socket exposes incomplete event support");
			}
			this.socket.connect(this.host, this.port);
			this.armConnectTimeout();
		} catch (error) {
			this.connecting = false;
			this.reportError("Could not create TCP socket: " + error);
			this.deferReconnect();
		}
	}

	armConnectTimeout() {
		// SignalRGB's TCP socket does not always emit "error" when the destination has
		// no listener (the connect attempt can sit silently for a long time). Time the
		// attempt out ourselves so the discovery flow can fail fast and retry.
		if (typeof setTimeout !== "function" || this.connectTimeoutMs <= 0) {
			return;
		}

		this.clearConnectTimeout();
		const self = this;
		this.connectTimeoutId = setTimeout(function () {
			self.connectTimeoutId = undefined;
			if (!self.connecting || self.connected) {
				return;
			}
			self.reportError("connection timed out");
			self.handleDisconnected();
		}, this.connectTimeoutMs);
	}

	clearConnectTimeout() {
		if (this.connectTimeoutId !== undefined) {
			clearTimeout(this.connectTimeoutId);
			this.connectTimeoutId = undefined;
		}
	}

	ensureConnected() {
		if (!this.connected && !this.connecting) {
			this.connect();
		}
	}

	isReady() {
		return this.connected && this.ready;
	}

	close() {
		this.clearConnectTimeout();
		this.ready = false;
		this.connected = false;
		this.connecting = false;
		this.pending = [];

		if (!this.socket) {
			return;
		}

		// SignalRGB emits "close" synchronously from socket.close(). Detach first so
		// the close handler cannot recursively close the same socket.
		const socket = this.socket;
		this.socket = undefined;
		try {
			socket.close();
		} catch (error) {
			try {
				socket.disconnect();
			} catch (_) {
				// Some SignalRGB socket versions expose close(), others disconnect().
			}
		}
	}

	handleConnected() {
		if (this.connected) {
			return;
		}

		this.clearConnectTimeout();
		this.connecting = false;
		this.connected = true;
		this.reconnectDelayMs = this.baseReconnectDelayMs;
		this.nextConnectAt = 0;
		this.logger("Connected to OpenRGB SDK server.");

		const self = this;
		this.request(Command.requestProtocolVersion, u32(CLIENT_PROTOCOL_VERSION), 0, function (packet, error) {
			if (error) {
				self.reportError(error);
				self.handleDisconnected();
				return;
			}

			if (packet && packet.payload.length >= 4) {
				self.protocolVersion = Math.min(readU32(packet.payload, 0), CLIENT_PROTOCOL_VERSION);
			}

			self.sendPacket(Command.setClientName, stringBytes(self.clientName), 0);
			self.ready = true;
			self.logger("OpenRGB protocol v" + self.protocolVersion + " ready.");
			self.onReady(self);
		});
	}

	handleDisconnected() {
		const wasConnected = this.connected || this.connecting;
		this.clearConnectTimeout();
		this.connected = false;
		this.connecting = false;
		this.ready = false;
		this.pending = [];
		this.deferReconnect();

		// Tear down the underlying socket so the next connect() attempt starts from a
		// clean slate; without this a half-open socket from a timed-out attempt keeps
		// resources around and can confuse SignalRGB's TCP module on reconnect.
		if (this.socket) {
			// SignalRGB's close event is synchronous. Clear our reference before closing
			// to make a re-entrant handleDisconnected() call a harmless no-op.
			const socket = this.socket;
			this.socket = undefined;
			try {
				socket.close();
			} catch (_) {
				try {
					socket.disconnect();
				} catch (_) {
				}
			}
		}

		if (wasConnected) {
			this.onDisconnected();
		}
	}

	deferReconnect() {
		this.nextConnectAt = Date.now() + this.reconnectDelayMs;
		this.reconnectDelayMs = Math.min(this.maxReconnectDelayMs, Math.max(this.baseReconnectDelayMs, this.reconnectDelayMs * 2));
	}

	handleError(error) {
		this.reportError("OpenRGB TCP error: " + error);
		this.handleDisconnected();
	}

	handleMessage(message) {
		this.rxBuffer = this.rxBuffer.concat(normalizeBytes(message));

		while (this.rxBuffer.length >= 16) {
			if (!hasMagic(this.rxBuffer, 0)) {
				this.rxBuffer.shift();
				continue;
			}

			const payloadLength = readU32(this.rxBuffer, 12);
			const packetLength = 16 + payloadLength;
			if (this.rxBuffer.length < packetLength) {
				return;
			}

			const packetBytes = this.rxBuffer.slice(0, packetLength);
			this.rxBuffer = this.rxBuffer.slice(packetLength);
			this.dispatchPacket(decodePacket(packetBytes));
		}
	}

	dispatchPacket(packet) {
		if (packet.commandId === Command.deviceListUpdated) {
			this.onDeviceListUpdated();
			return;
		}

		const pendingIndex = this.pending.findIndex(function (request) {
			return request.commandId === packet.commandId && request.deviceId === packet.deviceId;
		});

		if (pendingIndex < 0) {
			return;
		}

		const pendingRequest = this.pending.splice(pendingIndex, 1)[0];
		if (pendingRequest.timeoutId !== undefined) {
			clearTimeout(pendingRequest.timeoutId);
		}
		pendingRequest.callback(packet);
	}

	request(commandId, payload, deviceId, callback, timeoutMs) {
		if (!this.connected) {
			this.reportError("Cannot write to OpenRGB while disconnected.");
			return;
		}

		timeoutMs = timeoutMs === undefined ? REQUEST_TIMEOUT_MS : timeoutMs;
		const hasTimeout = timeoutMs > 0;
		const request = {
			commandId: commandId,
			deviceId: deviceId || 0,
			timeoutAt: hasTimeout ? Date.now() + timeoutMs : 0,
			callback: callback || function () {}
		};

		if (hasTimeout && typeof setTimeout === "function") {
			const self = this;
			request.timeoutId = setTimeout(function () {
				const pendingIndex = self.pending.indexOf(request);
				if (pendingIndex < 0) {
					return;
				}

				self.pending.splice(pendingIndex, 1);
				request.callback(undefined, "OpenRGB request timed out: command " + commandId + " device " + (deviceId || 0));
			}, timeoutMs);
		}

		this.pending.push(request);
		this.sendPacket(commandId, payload || [], deviceId || 0);
	}

	checkRequestTimeouts() {
		if (!this.pending || this.pending.length === 0) {
			return;
		}

		const now = Date.now();
		for (let i = this.pending.length - 1; i >= 0; i--) {
			const request = this.pending[i];
			if (!request.timeoutAt) {
				continue;
			}
			if (request.timeoutAt > now) {
				continue;
			}

			this.pending.splice(i, 1);
			if (request.timeoutId !== undefined) {
				clearTimeout(request.timeoutId);
			}
			request.callback(undefined, "OpenRGB request timed out: command " + request.commandId + " device " + request.deviceId);
		}
	}

	sendPacket(commandId, payload, deviceId) {
		if (!this.connected || !this.socket) {
			return false;
		}

		try {
			this.socket.send(encodePacket(commandId, payload || [], deviceId || 0));
			return true;
		} catch (error) {
			this.reportError("Failed to send OpenRGB packet: " + error);
			return false;
		}
	}

	getControllerCount(callback) {
		this.request(Command.requestControllerCount, [], 0, function (packet, error) {
			if (error) {
				callback(0, error);
				return;
			}

			if (!packet || packet.payload.length < 4) {
				callback(0, "OpenRGB returned an invalid controller count.");
				return;
			}

			callback(readU32(packet.payload, 0));
		});
	}

	getControllerData(index, callback, timeoutMs) {
		const payload = this.protocolVersion > 0 ? u32(this.protocolVersion) : [];
		const self = this;
		this.request(Command.requestControllerData, payload, index, function (packet, error) {
			if (error) {
				callback(undefined, error);
				return;
			}

			try {
				callback(parseControllerData(packet.payload, index, self.protocolVersion));
			} catch (error) {
				callback(undefined, "Failed to parse OpenRGB controller " + index + ": " + error);
			}
		}, timeoutMs);
	}

	getAllControllers(callback) {
		const self = this;
		this.getControllerCount(function (count, countError) {
			if (countError) {
				callback([], countError);
				return;
			}

			const devices = [];
			const failed = [];
			let received = 0;
			self.onProgress("OpenRGB reported " + count + " controller(s).");

			if (count === 0) {
				callback([]);
				return;
			}

			const finish = function () {
				if (failed.length > 0) {
					self.logger("Gave up on " + failed.length + " OpenRGB controller(s): " + failed.join(", "));
				}

				devices.sort(function (a, b) {
					return (a.openrgbIndex || 0) - (b.openrgbIndex || 0);
				});
				callback(devices);
			};

			const readNext = function (index) {
				if (index >= count) {
					finish();
					return;
				}

				self.onProgress("Reading OpenRGB controller " + (index + 1) + "/" + count + "...");
				self.getControllerData(index, function (controllerData, error) {
					if (error) {
						self.logger("OpenRGB controller " + index + " read failed: " + error);
						failed.push(index);
					} else {
						devices.push(controllerData);
						received++;
						self.onProgress("Read OpenRGB controller " + (index + 1) + "/" + count + " (" + received + "/" + count + " received)...");
					}
					readNext(index + 1);
				}, DISCOVERY_REQUEST_TIMEOUT_MS);
			};

			readNext(0);
		});
	}

	requestRescanDevices() {
		this.sendPacket(Command.requestRescanDevices, [], 0);
	}

	setCustomMode(deviceIndex) {
		this.sendPacket(Command.setCustomMode, [], deviceIndex);
	}

	updateLeds(deviceIndex, colors) {
		if (!this.isReady()) {
			return false;
		}

		const payload = encodeUpdateLedsPayload(colors);
		return this.sendPacket(Command.updateLeds, payload, deviceIndex);
	}

	reportError(message) {
		if (message === this.lastError) {
			return;
		}

		this.lastError = message;
		this.logger(message);
		this.onError(message);
	}
}

function bindSocketEvent(socket, eventName, handler) {
	try {
		socket.on(eventName, handler);
		return true;
	} catch (_) {
		return false;
	}
}

function getRenderStateKey(controllerData) {
	return String(controllerData.deviceId || controllerData.id || controllerData.name || "openrgb-device");
}

function ensureRenderClient(controllerData, logger) {
	const host = normalizeHost(controllerData.openrgbHost || readSetting(HOST_SETTING, DEFAULT_HOST));
	const port = normalizePort(controllerData.openrgbPort || readNumberSetting(PORT_SETTING, DEFAULT_PORT));
	const key = host + ":" + port;

	if (renderClient && renderClientKey === key) {
		return renderClient;
	}

	if (renderClient) {
		renderClient.close();
	}

	const deviceLabel = controllerData.name || controllerData.deviceId || "device";

	renderClientKey = key;
	renderClient = new OpenRGBClient({
		host: host,
		port: port,
		clientName: CLIENT_NAME + " - " + deviceLabel,
		logger: logger || logFromDevice,
		onReady: function (client) {
			for (const stateKey in renderStates) {
				if (!Object.prototype.hasOwnProperty.call(renderStates, stateKey)) {
					continue;
				}

				setCustomModesForState(client, renderStates[stateKey]);
			}
		},
		onDeviceListUpdated: function () {
			(logger || logFromDevice)("OpenRGB device list changed; refresh the addon device list if colors stop matching.");
		}
	});
	renderClient.connect();
	return renderClient;
}

function closeRenderState(deviceId) {
	delete renderStates[String(deviceId || "")];
	closeRenderClientIfIdle();
}

function closeRenderClientIfIdle() {
	for (const key in renderStates) {
		if (Object.prototype.hasOwnProperty.call(renderStates, key)) {
			return;
		}
	}

	if (renderClient) {
		renderClient.close();
		renderClient = undefined;
		renderClientKey = "";
	}
}

function setCustomModesForState(client, state) {
	if (!client || !client.isReady() || !state) {
		return;
	}

	if (state.frames && state.frames.length > 0) {
		for (let i = 0; i < state.frames.length; i++) {
			const frame = state.frames[i];
			if (!frame.customModeSet && frame.openrgbIndex !== undefined) {
				client.setCustomMode(frame.openrgbIndex);
				frame.customModeSet = true;
			}
		}
		return;
	}

	if (!state.customModeSet && state.openrgbIndex !== undefined) {
		client.setCustomMode(state.openrgbIndex);
		state.customModeSet = true;
	}
}

function buildSignalRgbLayout(controllerData) {
	const zones = controllerData.zones || [];
	logFromDevice("Layout for " + (controllerData.name || controllerData.id) + ": " + zones.length + " zone(s) [" + zones.map(function (z) {
		return (z.name || "?") + " type" + z.type + (z.matrix && z.matrix.width > 0 ? " matrix " + z.matrix.width + "x" + z.matrix.height : " linear");
	}).join(", ") + "]");
	const state = {
		openrgbIndex: controllerData.openrgbIndex,
		customModeSet: false,
		ledPositions: [],
		subdeviceMaps: [],
		lastFrameSignatures: {},
		lastFrameSignature: ""
	};

	if (zones.length > 1) {
		let ledOffset = 0;
		for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
			const zone = zones[zoneIndex];
			const map = buildZoneLedMap(controllerData, zone, ledOffset);
			ledOffset += map.count;

			if (map.count <= 0) {
				continue;
			}

			const subdeviceId = controllerData.id + "_" + sanitizeId(zone.name || ("Zone " + zoneIndex));
			device.createSubdevice(subdeviceId);
			device.setSubdeviceName(subdeviceId, zone.name || ("Zone " + (zoneIndex + 1)));
			device.setSubdeviceSize(subdeviceId, map.width, map.height);
			device.setSubdeviceLeds(subdeviceId, map.names, map.positions);
			state.subdeviceMaps.push({
				id: subdeviceId,
				positions: map.positions
			});
		}

		device.SetIsSubdeviceController(true);
		return state;
	}

	const zone = zones.length === 1 ? zones[0] : { type: 1, ledsCount: getControllerLedCount(controllerData) };
	const map = buildZoneLedMap(controllerData, zone, 0);
	state.ledPositions = map.positions;
	device.setSize([map.width, map.height]);
	device.setControllableLeds(map.names, map.positions);
	return state;
}

function buildZoneLedMap(controllerData, zone, ledOffset) {
	const leds = controllerData.leds || [];
	const matrix = zone ? zone.matrix : undefined;
	const count = getZoneLedCount(zone);
	const names = [];
	const x = [];
	const y = [];
	const positions = [];
	let width = Math.max(1, count);
	let height = 1;

	if (matrix && matrix.keys && matrix.width > 0 && matrix.height > 0) {
		width = matrix.width;
		height = matrix.height;

		// Map each OpenRGB LED (stored in the matrix as its zone-local index) to its grid
		// cell. Building value -> cell up front handles matrices whose values are not a
		// contiguous 0..n-1 run (which broke the previous "search for index" approach and
		// silently fell back to a flat strip), and avoids an O(n * cells) scan per zone.
		const cellByLed = {};
		for (let row = 0; row < matrix.keys.length; row++) {
			const cols = matrix.keys[row] || [];
			for (let col = 0; col < cols.length; col++) {
				const value = cols[col];
				if (value === null || value === undefined) {
					continue;
				}
				if (cellByLed[value] === undefined) {
					cellByLed[value] = [col, row];
				}
			}
		}

		for (let localIndex = 0; localIndex < count; localIndex++) {
			const position = cellByLed[localIndex] || [localIndex % width, Math.floor(localIndex / width)];
			const led = leds[ledOffset + localIndex];
			names.push(led ? led.name : ("LED " + (ledOffset + localIndex + 1)));
			x.push(position[0]);
			y.push(position[1]);
			positions.push(position);
		}
		return { count: count, names: names, x: x, y: y, positions: positions, width: width, height: height };
	}

	for (let localIndex = 0; localIndex < count; localIndex++) {
		const led = leds[ledOffset + localIndex];
		names.push(led ? led.name : ("LED " + (ledOffset + localIndex + 1)));
		x.push(localIndex);
		y.push(0);
		positions.push([localIndex, 0]);
	}

	return { count: count, names: names, x: x, y: y, positions: positions, width: width, height: height };
}

function collectFrameColors(state) {
	const renderState = state || { ledPositions: [], subdeviceMaps: [] };

	if (renderState.frames && renderState.frames.length > 0) {
		const frames = [];
		for (let frameIndex = 0; frameIndex < renderState.frames.length; frameIndex++) {
			const frame = renderState.frames[frameIndex];
			let frameColors = [];
			for (let mapIndex = 0; mapIndex < frame.maps.length; mapIndex++) {
				const map = frame.maps[mapIndex];
				for (let positionIndex = 0; positionIndex < map.positions.length; positionIndex++) {
					const position = map.positions[positionIndex];
					frameColors.push(resolveColor(function () {
						return device.subdeviceColor(map.id, position[0], position[1]);
					}));
				}
			}

			if (frame.ledCount > 0) {
				frameColors = normalizeColorCount(frameColors, frame.ledCount);
			}
			frames.push({ openrgbIndex: frame.openrgbIndex, colors: frameColors });
		}
		return frames;
	}

	let colors = [];
	if (renderState.subdeviceMaps.length > 0) {
		for (let i = 0; i < renderState.subdeviceMaps.length; i++) {
			const map = renderState.subdeviceMaps[i];
			for (let j = 0; j < map.positions.length; j++) {
				colors.push(resolveColor(function () {
					return device.subdeviceColor(map.id, map.positions[j][0], map.positions[j][1]);
				}));
			}
		}
	} else {
		for (let i = 0; i < renderState.ledPositions.length; i++) {
			const position = renderState.ledPositions[i];
			colors.push(resolveColor(function () {
				return device.color(position[0], position[1]);
			}));
		}
	}

	const targetCount = getControllerLedCount(controller);
	if (targetCount > 0) {
		colors = normalizeColorCount(colors, targetCount);
	}

	return [{ openrgbIndex: controller.openrgbIndex, colors: colors }];
}

function resolveColor(canvasReader) {
	if (LightingMode === "Forced") {
		return hexToRgb(forcedColor);
	}

	return normalizeColor(canvasReader());
}

function normalizeColor(color) {
	if (Array.isArray(color)) {
		return [
			clampByte(color[0]),
			clampByte(color[1]),
			clampByte(color[2])
		];
	}

	if (color && typeof color === "object") {
		return [
			clampByte(color.red !== undefined ? color.red : color.r),
			clampByte(color.green !== undefined ? color.green : color.g),
			clampByte(color.blue !== undefined ? color.blue : color.b)
		];
	}

	return [0, 0, 0];
}

function normalizeColorCount(colors, targetCount) {
	const normalized = colors.slice(0, targetCount);
	const fill = normalized.length > 0 ? normalized[normalized.length - 1] : [0, 0, 0];

	while (normalized.length < targetCount) {
		normalized.push(fill);
	}

	return normalized;
}

function encodeUpdateLedsPayload(colors) {
	const dataSize = 4 + 2 + (4 * colors.length);
	let payload = u32(dataSize).concat(u16(colors.length));

	for (let i = 0; i < colors.length; i++) {
		const color = normalizeColor(colors[i]);
		const value = clampByte(color[0]) | (clampByte(color[1]) << 8) | (clampByte(color[2]) << 16);
		payload = payload.concat(u32(value));
	}

	return payload;
}

function parseControllerData(payload, deviceIndex, protocolVersion) {
	const reader = new ByteReader(payload);
	const controllerData = {
		openrgbIndex: deviceIndex,
		type: 19,
		name: "",
		vendor: "",
		description: "",
		version: "",
		serial: "",
		location: "",
		activeMode: 0,
		modes: [],
		zones: [],
		leds: [],
		colors: [],
		ledAltNames: [],
		flags: 0
	};

	reader.u32();
	controllerData.type = reader.i32();
	controllerData.name = reader.string();
	if (protocolVersion >= 1) {
		controllerData.vendor = reader.string();
	}
	controllerData.description = reader.string();
	controllerData.version = reader.string();
	controllerData.serial = reader.string();
	controllerData.location = reader.string();

	const modeCount = reader.u16();
	controllerData.activeMode = reader.i32();
	for (let i = 0; i < modeCount; i++) {
		controllerData.modes.push(parseMode(reader, i, protocolVersion));
	}

	const zoneCount = reader.u16();
	for (let i = 0; i < zoneCount; i++) {
		controllerData.zones.push(parseZone(reader, i, protocolVersion));
	}

	const ledCount = reader.u16();
	for (let i = 0; i < ledCount; i++) {
		controllerData.leds.push({
			name: reader.string(),
			value: reader.u32()
		});
	}

	const colorCount = reader.u16();
	for (let i = 0; i < colorCount; i++) {
		controllerData.colors.push(reader.color());
	}

	if (protocolVersion >= 5 && reader.remaining() >= 2) {
		const altNameCount = reader.u16();
		for (let i = 0; i < altNameCount; i++) {
			controllerData.ledAltNames.push(reader.string());
		}

		if (reader.remaining() >= 4) {
			controllerData.flags = reader.u32();
		}
	}

	return controllerData;
}

function parseMode(reader, index, protocolVersion) {
	const mode = {
		id: index,
		name: reader.string(),
		value: reader.i32(),
		flags: reader.u32(),
		speedMin: reader.u32(),
		speedMax: reader.u32(),
		brightnessMin: 0,
		brightnessMax: 0,
		colorMin: 0,
		colorMax: 0,
		speed: 0,
		brightness: 0,
		direction: 0,
		colorMode: 0,
		colors: []
	};

	if (protocolVersion >= 3) {
		mode.brightnessMin = reader.u32();
		mode.brightnessMax = reader.u32();
	}

	mode.colorMin = reader.u32();
	mode.colorMax = reader.u32();
	mode.speed = reader.u32();

	if (protocolVersion >= 3) {
		mode.brightness = reader.u32();
	}

	mode.direction = reader.u32();
	mode.colorMode = reader.u32();

	const colorCount = reader.u16();
	for (let i = 0; i < colorCount; i++) {
		mode.colors.push(reader.color());
	}

	return mode;
}

function parseZone(reader, index, protocolVersion) {
	const zone = {
		id: index,
		name: reader.string(),
		type: reader.i32(),
		ledsMin: reader.u32(),
		ledsMax: reader.u32(),
		ledsCount: reader.u32(),
		matrix: undefined,
		segments: [],
		flags: 0
	};

	const matrixLength = reader.u16();
	if (matrixLength > 0) {
		const height = reader.u32();
		const width = reader.u32();
		const keys = [];
		for (let row = 0; row < height; row++) {
			keys[row] = [];
			for (let col = 0; col < width; col++) {
				const value = reader.u32();
				keys[row][col] = value === 0xFFFFFFFF ? null : value;
			}
		}
		zone.matrix = { size: matrixLength, height: height, width: width, keys: keys };
	}

	if (protocolVersion >= 4 && reader.remaining() >= 2) {
		const segmentCount = reader.u16();
		for (let i = 0; i < segmentCount; i++) {
			zone.segments.push({
				name: reader.string(),
				type: reader.i32(),
				startIndex: reader.u32(),
				ledsCount: reader.u32()
			});
		}
	}

	if (protocolVersion >= 5 && reader.remaining() >= 4) {
		zone.flags = reader.u32();
	}

	return zone;
}

class ByteReader {
	constructor(bytes) {
		this.bytes = normalizeBytes(bytes);
		this.offset = 0;
	}

	remaining() {
		return this.bytes.length - this.offset;
	}

	u16() {
		const value = readU16(this.bytes, this.offset);
		this.offset += 2;
		return value;
	}

	u32() {
		const value = readU32(this.bytes, this.offset);
		this.offset += 4;
		return value;
	}

	i32() {
		const value = this.u32();
		return value > 0x7FFFFFFF ? value - 0x100000000 : value;
	}

	string() {
		const length = this.u16();
		if (length <= 0) {
			return "";
		}

		const bytes = this.bytes.slice(this.offset, this.offset + length);
		this.offset += length;

		if (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
			bytes.pop();
		}

		return bytesToString(bytes);
	}

	color() {
		const red = this.bytes[this.offset] || 0;
		const green = this.bytes[this.offset + 1] || 0;
		const blue = this.bytes[this.offset + 2] || 0;
		this.offset += 4;
		return { red: red, green: green, blue: blue };
	}
}

function encodePacket(commandId, payload, deviceId) {
	const bytes = normalizeBytes(payload);
	return [0x4F, 0x52, 0x47, 0x42]
		.concat(u32(deviceId || 0))
		.concat(u32(commandId))
		.concat(u32(bytes.length))
		.concat(bytes);
}

function decodePacket(packetBytes) {
	return {
		deviceId: readU32(packetBytes, 4),
		commandId: readU32(packetBytes, 8),
		length: readU32(packetBytes, 12),
		payload: packetBytes.slice(16)
	};
}

function assignStableDeviceIds(devices, host, port) {
	const seen = {};
	const output = [];

	for (let i = 0; i < devices.length; i++) {
		const item = devices[i];
		let stableId = "openrgb-" + fnv1a([
			item.vendor || "",
			item.name || "",
			item.serial || "",
			item.location || "",
			item.description || "",
			item.version || ""
		].join("|"));

		if (seen[stableId]) {
			stableId = stableId + "-" + item.openrgbIndex;
		}

		seen[stableId] = true;
		item.deviceId = stableId;
		item.id = stableId;
		item.openrgbHost = host;
		item.openrgbPort = port;
		item.icon = getDeviceIconUrl(item.type);
		item.image = getBridgeDeviceIconUrl(item.type);
		output.push(item);
	}

	return output;
}

function buildDeviceSummaries(devices) {
	const output = [];
	if (!devices || !devices.length) {
		return output;
	}

	for (let i = 0; i < devices.length; i++) {
		const item = devices[i] || {};
		output.push({
			deviceId: item.deviceId || item.id || "",
			name: item.name || "OpenRGB Device",
			vendor: item.vendor || "",
			description: item.description || "",
			serial: item.serial || "",
			location: item.location || "",
			openrgbIndex: item.openrgbIndex || 0,
			openrgbHost: item.openrgbHost || DEFAULT_HOST,
			openrgbPort: item.openrgbPort || DEFAULT_PORT,
			ledCount: item.ledCount !== undefined ? Number(item.ledCount || 0) : getControllerLedCount(item),
			zoneCount: item.zones ? item.zones.length : 0,
			type: item.type !== undefined ? item.type : 19,
			icon: item.icon || getDeviceIconUrl(item.type),
			image: item.image || getBridgeDeviceIconUrl(item.type)
		});
	}

	return output;
}

function getDeviceIconUrl(deviceType) {
	const iconName = DeviceTypeIcon[Number(deviceType)] || "unknown";
	return DEVICE_ICON_BASE_URL + iconName + ".png";
}

function getBridgeDeviceIconUrl(deviceType) {
	const iconName = DeviceTypeIcon[Number(deviceType)] || "unknown";
	return BRIDGE_DEVICE_ICON_BASE_URL + iconName + ".png";
}

function readLastDeviceSummaries() {
	const output = [];
	appendDeviceSummaries(output, safeJsonParse(readSetting(LAST_DEVICES_SETTING, "[]"), []));
	return output;
}

function getSelectedDevicesById(availableDevices, selectedDevices) {
	const selectedIds = getDeviceIds(selectedDevices || []);
	if (selectedIds.length === 0) {
		return [];
	}

	if (!availableDevices || availableDevices.length === 0) {
		// No fresh scan available: keep whatever the selected entries already carry
		// (full zone/LED data when persisted) instead of reducing them to summaries.
		return (selectedDevices || []).slice();
	}

	const output = [];
	for (let i = 0; i < availableDevices.length; i++) {
		const item = availableDevices[i];
		if (item && selectedIds.indexOf(item.deviceId) >= 0) {
			output.push(item);
		}
	}
	return output;
}

function appendDeviceSummaries(output, devices) {
	for (let i = 0; i < devices.length; i++) {
		const summary = normalizeDeviceSummary(devices[i]);
		if (!summary || findDeviceSummaryById(output, summary.deviceId)) {
			continue;
		}

		output.push(summary);
	}
}

function normalizeDeviceSummary(item) {
	if (!item || !item.deviceId && !item.id) {
		return undefined;
	}

	const type = item.type !== undefined ? item.type : 19;
	return {
		deviceId: item.deviceId || item.id || "",
		name: item.name || "OpenRGB Device",
		vendor: item.vendor || "",
		description: item.description || "",
		serial: item.serial || "",
		location: item.location || "",
		openrgbIndex: item.openrgbIndex || 0,
		openrgbHost: item.openrgbHost || DEFAULT_HOST,
		openrgbPort: item.openrgbPort || DEFAULT_PORT,
		ledCount: item.ledCount !== undefined ? Number(item.ledCount || 0) : getControllerLedCount(item),
		zoneCount: item.zoneCount !== undefined ? Number(item.zoneCount || 0) : (item.zones ? item.zones.length : 0),
		type: type,
		icon: item.icon || getDeviceIconUrl(type),
		image: item.image || getBridgeDeviceIconUrl(type)
	};
}

function findDeviceSummaryById(devices, deviceId) {
	deviceId = String(deviceId || "");
	for (let i = 0; i < (devices || []).length; i++) {
		const item = devices[i] || {};
		if (String(item.deviceId || item.id || "") === deviceId) {
			return normalizeDeviceSummary(item);
		}
	}
	return undefined;
}

function getDeviceIds(devices) {
	const output = [];
	if (!devices) {
		return output;
	}

	for (let i = 0; i < devices.length; i++) {
		if (devices[i] && devices[i].deviceId) {
			output.push(devices[i].deviceId);
		}
	}
	return output;
}

function findDeviceById(devices, deviceId) {
	if (!devices) {
		return undefined;
	}

	for (let i = 0; i < devices.length; i++) {
		if (devices[i] && devices[i].deviceId === deviceId) {
			return devices[i];
		}
	}
	return undefined;
}

function getZoneLedCount(zone) {
	if (!zone) {
		return 0;
	}

	if (zone.matrix && zone.matrix.keys) {
		let count = 0;
		for (let row = 0; row < zone.matrix.keys.length; row++) {
			for (let col = 0; col < zone.matrix.keys[row].length; col++) {
				if (zone.matrix.keys[row][col] !== null && zone.matrix.keys[row][col] !== undefined) {
					count++;
				}
			}
		}
		return count;
	}

	return zone.ledsCount || 0;
}

function getControllerLedCount(controllerData) {
	if (controllerData.ledCount !== undefined) {
		return Number(controllerData.ledCount || 0);
	}

	if (controllerData.colors && controllerData.colors.length > 0) {
		return controllerData.colors.length;
	}

	if (controllerData.leds && controllerData.leds.length > 0) {
		return controllerData.leds.length;
	}

	return 0;
}

function makeFrameSignature(colors) {
	let hash = 2166136261;
	for (let i = 0; i < colors.length; i++) {
		hash ^= clampByte(colors[i][0]);
		hash = Math.imul(hash, 16777619);
		hash ^= clampByte(colors[i][1]);
		hash = Math.imul(hash, 16777619);
		hash ^= clampByte(colors[i][2]);
		hash = Math.imul(hash, 16777619);
	}
	return String(hash >>> 0);
}

function fillColors(count, rgb) {
	const colors = [];
	for (let i = 0; i < count; i++) {
		colors.push(rgb);
	}
	return colors;
}

function hexToRgb(hex) {
	if (typeof hex === "object" && hex !== null) {
		return normalizeColor(hex);
	}

	const value = String(hex || "#000000");
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);
	if (!result) {
		return [0, 0, 0];
	}

	return [
		parseInt(result[1], 16),
		parseInt(result[2], 16),
		parseInt(result[3], 16)
	];
}

function normalizeBytes(value) {
	if (!value) {
		return [];
	}

	if (Array.isArray(value)) {
		return value.map(clampByte);
	}

	if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
		return Array.from(new Uint8Array(value));
	}

	if (typeof ArrayBuffer !== "undefined" && value.buffer instanceof ArrayBuffer) {
		const offset = value.byteOffset || 0;
		const length = value.byteLength !== undefined ? value.byteLength : value.length;
		return Array.from(new Uint8Array(value.buffer, offset, length));
	}

	if (typeof value === "string") {
		const bytes = [];
		for (let i = 0; i < value.length; i++) {
			bytes.push(value.charCodeAt(i) & 0xFF);
		}
		return bytes;
	}

	if (typeof value.length === "number") {
		const bytes = [];
		for (let i = 0; i < value.length; i++) {
			bytes.push(clampByte(value[i]));
		}
		return bytes;
	}

	return [];
}

function hasMagic(bytes, offset) {
	return bytes[offset] === 0x4F
		&& bytes[offset + 1] === 0x52
		&& bytes[offset + 2] === 0x47
		&& bytes[offset + 3] === 0x42;
}

function readU16(bytes, offset) {
	return (bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8);
}

function readU32(bytes, offset) {
	return ((bytes[offset] || 0)
		| ((bytes[offset + 1] || 0) << 8)
		| ((bytes[offset + 2] || 0) << 16)
		| ((bytes[offset + 3] || 0) << 24)) >>> 0;
}

function u16(value) {
	value = value >>> 0;
	return [value & 0xFF, (value >>> 8) & 0xFF];
}

function u32(value) {
	value = value >>> 0;
	return [
		value & 0xFF,
		(value >>> 8) & 0xFF,
		(value >>> 16) & 0xFF,
		(value >>> 24) & 0xFF
	];
}

function stringBytes(value) {
	const text = String(value || "");
	const bytes = [];
	for (let i = 0; i < text.length; i++) {
		bytes.push(text.charCodeAt(i) & 0x7F);
	}
	bytes.push(0);
	return bytes;
}

function bytesToString(bytes) {
	let text = "";
	for (let i = 0; i < bytes.length; i++) {
		text += String.fromCharCode(bytes[i]);
	}
	return text;
}

function fnv1a(value) {
	let hash = 2166136261;
	const text = String(value || "");
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

function safeJsonParse(value, fallback) {
	try {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		return JSON.parse(value);
	} catch (_) {
		return fallback;
	}
}

function readSelectedDevices() {
	return safeJsonParse(readSetting(SELECTED_DEVICES_SETTING, "[]"), []);
}

function hasStoredSelectedDevices() {
	const value = readSetting(SELECTED_DEVICES_SETTING, undefined);
	return value !== undefined && value !== null && value !== "";
}

function buildLookingForStatus() {
	const host = normalizeHost(readSetting(HOST_SETTING, DEFAULT_HOST));
	const port = readNumberSetting(PORT_SETTING, DEFAULT_PORT);
	return "Looking for OpenRGB at " + host + ":" + port + "...";
}

function readSetting(key, fallback) {
	const value = service.getSetting(SETTINGS_GROUP, key);
	if (value === undefined || value === null || value === "") {
		return fallback;
	}
	return value;
}

function readNumberSetting(key, fallback) {
	return normalizePort(readSetting(key, fallback));
}

function saveSetting(key, value) {
	service.saveSetting(SETTINGS_GROUP, key, value);
}

function normalizeHost(host) {
	const value = String(host || DEFAULT_HOST).trim();
	return value.length > 0 ? value : DEFAULT_HOST;
}

function normalizePort(port) {
	const parsed = parseInt(port, 10);
	if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
		return DEFAULT_PORT;
	}
	return parsed;
}

function sanitizeId(value) {
	return String(value || "zone").replace(/[^a-z0-9_-]/gi, "_");
}

function clampByte(value) {
	const parsed = Number(value);
	if (isNaN(parsed) || parsed < 0) {
		return 0;
	}
	if (parsed > 255) {
		return 255;
	}
	return Math.floor(parsed);
}

function logFromDevice(message) {
	if (typeof device !== "undefined" && device.log) {
		device.log(message);
	}
}

function logFromService(message) {
	if (typeof service !== "undefined" && service.log) {
		service.log(message);
	}
}

export function ImageUrl() {
	return ICON_URL;
}
