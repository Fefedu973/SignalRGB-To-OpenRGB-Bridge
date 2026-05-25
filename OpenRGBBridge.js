import tcp from "@SignalRGB/tcp";

export function Name() { return "OpenRGB Bridge"; }
export function Version() { return "2.0.0"; }
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
const DISABLED_DEVICE_IDS_SETTING = "DisabledDeviceIds";
const DISABLED_DEVICE_SUMMARIES_SETTING = "DisabledDeviceSummaries";
const LAST_DEVICES_SETTING = "LastDevices";
const STATUS_SETTING = "Status";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 6742;
const CLIENT_PROTOCOL_VERSION = 5;
const CLIENT_NAME = "SignalRGB OpenRGB Bridge";
const ICON_URL = "https://raw.githubusercontent.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge/main/signalbridge.png";
const DEVICE_ICON_BASE_URL = "https://raw.githubusercontent.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge/main/icons/openrgb_white/";
const BRIDGE_DEVICE_ICON_BASE_URL = "https://raw.githubusercontent.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge/main/icons/openrgb_bridge/";
const REQUEST_TIMEOUT_MS = 3000;

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
	requestProfileList: 150,
	saveProfile: 151,
	loadProfile: 152,
	deleteProfile: 153,
	resizeZone: 1000,
	clearSegments: 1001,
	addSegment: 1002,
	updateLeds: 1050,
	updateZoneLeds: 1051,
	updateSingleLed: 1052,
	setCustomMode: 1100,
	updateMode: 1101,
	saveMode: 1102
};

let protocol;
let ledPositions = [];
let subdeviceMaps = [];
let lastFrameSignature = "";

export function Initialize() {
	ledPositions = [];
	subdeviceMaps = [];
	lastFrameSignature = "";

	device.setName(controller.name || "OpenRGB Device");
	device.setImageFromUrl(controller.image || ICON_URL);
	buildSignalRgbLayout(controller);

	protocol = new OpenRGBClient({
		host: controller.openrgbHost || readSetting(HOST_SETTING, DEFAULT_HOST),
		port: controller.openrgbPort || readNumberSetting(PORT_SETTING, DEFAULT_PORT),
		logger: logFromDevice,
		onReady: function (client) {
			client.setCustomMode(controller.openrgbIndex);
		},
		onDeviceListUpdated: function () {
			logFromDevice("OpenRGB device list changed; refresh the addon device list if colors stop matching.");
		}
	});
	protocol.connect();
}

export function Render() {
	if (!protocol) {
		return;
	}

	protocol.ensureConnected();

	const colors = collectFrameColors();
	const signature = makeFrameSignature(colors);

	if (signature !== lastFrameSignature) {
		protocol.updateLeds(controller.openrgbIndex, colors);
		lastFrameSignature = signature;
	}

	device.pause(16);
}

export function Shutdown() {
	if (!protocol) {
		return;
	}

	const rgb = hexToRgb(shutdownColor);
	const count = getControllerLedCount(controller);
	protocol.updateLeds(controller.openrgbIndex, fillColors(count, rgb));
	protocol.close();
}

export function DiscoveryService() {
	this.IconUrl = ICON_URL;
	this.availableDevices = [];
	this.availableDeviceSummaries = buildDeviceSummaries(safeJsonParse(readSetting(LAST_DEVICES_SETTING, "[]"), []));
	this.selectedDevices = readSelectedDevices();
	this.status = readSetting(STATUS_SETTING, "Idle");
	this.client = undefined;
	this.firstUpdate = true;
	this.refreshId = 0;

	this.Initialize = function () {
		this.connectSelectedDevices();
	};

	this.Update = function () {
		if (this.client) {
			this.client.checkRequestTimeouts();
		}

		if (this.firstUpdate) {
			this.firstUpdate = false;
			this.connectSelectedDevices();
		}
	};

	this.refresh = function (host, port) {
		host = normalizeHost(host);
		port = normalizePort(port);
		const refreshId = ++this.refreshId;
		saveSetting(HOST_SETTING, host);
		saveSetting(PORT_SETTING, String(port));
		this.setStatus("Connect / Refresh requested. Connecting to OpenRGB at " + host + ":" + port + "...");

		if (this.client) {
			this.client.close();
		}

		const self = this;
		const client = new OpenRGBClient({
			host: host,
			port: port,
			logger: logFromService,
			onReady: function (client) {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus("Connected. Reading OpenRGB controllers...");
				client.getAllControllers(function (devices, error) {
					if (self.refreshId !== refreshId || self.client !== client) {
						return;
					}

					if (error) {
						self.setStatus(error);
						return;
					}

					self.availableDevices = assignStableDeviceIds(devices, host, port);
					self.availableDeviceSummaries = buildDeviceSummaries(self.availableDevices);
					saveSetting(LAST_DEVICES_SETTING, JSON.stringify(self.availableDeviceSummaries));
					const disabledDeviceIds = readDisabledDeviceIds();
					saveDisabledDeviceSummaries(mergeDisabledDeviceSummaries(disabledDeviceIds, self.availableDeviceSummaries));
					removeStaleControllers(readSelectedDevices(), self.availableDevices);
					self.selectedDevices = filterEnabledDevices(self.availableDevices, disabledDeviceIds);
					saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(self.selectedDevices));
					self.connectSelectedDevices();
					self.setStatus("Found " + self.availableDevices.length + " OpenRGB device(s). SignalRGB controllers updated.");
				});
			},
			onError: function (message) {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus(message);
			},
			onProgress: function (message) {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus(message);
			},
			onDisconnected: function () {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus("Disconnected from OpenRGB.");
			},
			onDeviceListUpdated: function () {
				if (self.refreshId !== refreshId || self.client !== client) {
					return;
				}

				self.setStatus("OpenRGB device list changed. Click Connect / Refresh to reload it.");
			}
		});

		this.client = client;
		client.connect();
		return this.status;
	};

	this.rescan = function () {
		if (this.client && this.client.isReady()) {
			this.client.requestRescanDevices();
			this.setStatus("Requested an OpenRGB device rescan. Wait a moment, then click Connect / Refresh.");
			return this.status;
		}

		this.setStatus("Connect to OpenRGB before requesting a rescan.");
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

		return String(this.status || readSetting(STATUS_SETTING, "Idle"));
	};

	this.getAvailableDevicesJson = function () {
		if (!this.availableDeviceSummaries || this.availableDeviceSummaries.length === 0) {
			const cachedDevices = safeJsonParse(readSetting(LAST_DEVICES_SETTING, "[]"), []);
			this.availableDeviceSummaries = buildDeviceSummaries(cachedDevices);
		}

		return JSON.stringify(this.availableDeviceSummaries || []);
	};

	this.getSelectedDevicesJson = function () {
		this.selectedDevices = readSelectedDevices();
		return JSON.stringify(this.selectedDevices);
	};

	this.getSelectedDeviceIdsJson = function () {
		this.selectedDevices = readSelectedDevices();
		const deviceIds = [];
		for (let i = 0; i < this.selectedDevices.length; i++) {
			if (this.selectedDevices[i] && this.selectedDevices[i].deviceId) {
				deviceIds.push(String(this.selectedDevices[i].deviceId));
			}
		}
		return JSON.stringify(deviceIds);
	};

	this.getDisabledDevicesJson = function () {
		return JSON.stringify(getDisabledDeviceSummaries(this.availableDevices, this.availableDeviceSummaries));
	};

	this.isDeviceSelected = function (deviceId) {
		deviceId = String(deviceId || "");
		this.selectedDevices = readSelectedDevices();
		for (let i = 0; i < this.selectedDevices.length; i++) {
			if (this.selectedDevices[i] && this.selectedDevices[i].deviceId === deviceId) {
				return true;
			}
		}
		return false;
	};

	this.toggleDevice = function (deviceId) {
		this.selectedDevices = readSelectedDevices();
		const selectedIndex = this.selectedDevices.findIndex(function (item) {
			return item.deviceId === deviceId;
		});

		if (selectedIndex >= 0) {
			this.removeDevice(deviceId);
			return this.status;
		}

		const devices = this.availableDevices || [];
		if (devices.length === 0) {
			this.setStatus("Click Connect / Refresh before adding new OpenRGB devices.");
			return this.status;
		}

		const deviceData = devices.find(function (item) {
			return item.deviceId === deviceId;
		});

		if (!deviceData) {
			this.setStatus("Could not find selected OpenRGB device.");
			return this.status;
		}

		this.selectedDevices.push(deviceData);
		removeDisabledDeviceId(deviceData.deviceId);
		saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(this.selectedDevices));
		this.addOrUpdateController(deviceData);
		this.setStatus("Added " + deviceData.name + ".");
		return this.status;
	};

	this.removeDevice = function (deviceId) {
		deviceId = String(deviceId || "");
		const deviceSummary = findDeviceSummaryById(
			(this.availableDeviceSummaries || [])
				.concat(buildDeviceSummaries(this.availableDevices || []))
				.concat(buildDeviceSummaries(readSelectedDevices())),
			deviceId
		);
		if (deviceSummary) {
			upsertDisabledDeviceSummary(deviceSummary);
		}

		const controllerToRemove = service.getController(deviceId);
		if (controllerToRemove !== undefined) {
			service.removeController(controllerToRemove);
		}

		this.selectedDevices = readSelectedDevices().filter(function (item) {
			return item.deviceId !== deviceId;
		});
		addDisabledDeviceId(deviceId);
		saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(this.selectedDevices));
		this.setStatus("Disabled device. " + readDisabledDeviceIds().length + " deleted device(s) saved.");
		return this.status;
	};

	this.removeAllDevices = function () {
		const devicesToDisable = this.availableDevices && this.availableDevices.length > 0 ? this.availableDevices : readSelectedDevices();
		addDisabledDeviceIds(getDeviceIds(devicesToDisable));
		saveDisabledDeviceSummaries(mergeDisabledDeviceSummaries(readDisabledDeviceIds(), buildDeviceSummaries(devicesToDisable)));
		this.selectedDevices = readSelectedDevices();
		for (let i = 0; i < this.selectedDevices.length; i++) {
			const controllerToRemove = service.getController(this.selectedDevices[i].deviceId);
			if (controllerToRemove !== undefined) {
				service.removeController(controllerToRemove);
			}
		}

		this.selectedDevices = [];
		saveSetting(SELECTED_DEVICES_SETTING, "[]");
		this.setStatus("Disabled all OpenRGB devices.");
		return this.status;
	};

	this.restoreDevice = function (deviceId) {
		deviceId = String(deviceId || "");
		removeDisabledDeviceId(deviceId);
		removeDisabledDeviceSummary(deviceId);

		const deviceData = findDeviceById(this.availableDevices, deviceId);
		if (!deviceData) {
			this.setStatus("Device re-enabled. Click Connect / Refresh to restore it.");
			return this.status;
		}

		this.selectedDevices = readSelectedDevices().filter(function (item) {
			return item.deviceId !== deviceId;
		});
		this.selectedDevices.push(deviceData);
		saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(this.selectedDevices));
		this.addOrUpdateController(deviceData);
		this.setStatus("Restored " + deviceData.name + ".");
		return this.status;
	};

	this.restoreAllDevices = function () {
		saveDisabledDeviceIds([]);
		saveDisabledDeviceSummaries([]);
		const devices = this.availableDevices || [];
		if (devices.length === 0) {
			this.setStatus("Devices re-enabled. Click Connect / Refresh to restore them.");
			return this.status;
		}

		this.selectedDevices = devices.slice(0);
		saveSetting(SELECTED_DEVICES_SETTING, JSON.stringify(this.selectedDevices));
		this.connectSelectedDevices();
		this.setStatus("Restored all OpenRGB devices.");
		return this.status;
	};

	this.connectSelectedDevices = function () {
		this.selectedDevices = readSelectedDevices();
		for (let i = 0; i < this.selectedDevices.length; i++) {
			this.addOrUpdateController(this.selectedDevices[i]);
		}
		return String(this.selectedDevices.length);
	};

	this.addOrUpdateController = function (deviceData) {
		if (!deviceData || !deviceData.deviceId) {
			return "";
		}

		const openRgbController = new OpenRGBController(deviceData);
		if (typeof service.hasController === "function" && service.hasController(deviceData.deviceId)) {
			service.updateController(openRgbController);
			return deviceData.deviceId;
		}

		const existing = service.getController(deviceData.deviceId);
		if (existing !== undefined) {
			service.updateController(openRgbController);
			return deviceData.deviceId;
		}

		service.addController(openRgbController);
		service.announceController(openRgbController);
		return deviceData.deviceId;
	};

	this.setStatus = function (message) {
		this.status = message;
		saveSetting(STATUS_SETTING, message);
		logFromService(message);
		return this.status;
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
		this.icon = getDeviceIconUrl(this.type);
		this.image = getBridgeDeviceIconUrl(this.type);
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
		service.updateController(this);
	}
}

class OpenRGBClient {
	constructor(options) {
		this.host = normalizeHost(options.host);
		this.port = normalizePort(options.port);
		this.logger = options.logger || function () {};
		this.onReady = options.onReady || function () {};
		this.onError = options.onError || function () {};
		this.onProgress = options.onProgress || this.logger;
		this.onDisconnected = options.onDisconnected || function () {};
		this.onDeviceListUpdated = options.onDeviceListUpdated || function () {};
		this.socket = undefined;
		this.connected = false;
		this.ready = false;
		this.connecting = false;
		this.protocolVersion = CLIENT_PROTOCOL_VERSION;
		this.rxBuffer = [];
		this.pending = [];
		this.lastError = "";
	}

	connect() {
		if (this.connected || this.connecting) {
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
			this.socket.on("connection", this.handleConnected.bind(this));
			this.socket.on("message", this.handleMessage.bind(this));
			this.socket.on("error", this.handleError.bind(this));
			this.socket.connect(this.host, this.port);
		} catch (error) {
			this.connecting = false;
			this.reportError("Could not create TCP socket: " + error);
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
		this.ready = false;
		this.connected = false;
		this.connecting = false;
		this.pending = [];

		if (!this.socket) {
			return;
		}

		try {
			this.socket.close();
		} catch (error) {
			try {
				this.socket.disconnect();
			} catch (_) {
				// Some SignalRGB socket versions expose close(), others disconnect().
			}
		}
	}

	handleConnected() {
		if (this.connected) {
			return;
		}

		this.connecting = false;
		this.connected = true;
		this.logger("Connected to OpenRGB SDK server.");

		const self = this;
		this.request(Command.requestProtocolVersion, u32(CLIENT_PROTOCOL_VERSION), 0, function (packet, error) {
			if (error) {
				self.reportError(error);
				return;
			}

			if (packet && packet.payload.length >= 4) {
				self.protocolVersion = Math.min(readU32(packet.payload, 0), CLIENT_PROTOCOL_VERSION);
			}

			self.sendPacket(Command.setClientName, stringBytes(CLIENT_NAME), 0);
			self.ready = true;
			self.logger("OpenRGB protocol v" + self.protocolVersion + " ready.");
			self.onReady(self);
		});
	}

	handleDisconnected() {
		const wasConnected = this.connected || this.connecting;
		this.connected = false;
		this.connecting = false;
		this.ready = false;
		this.pending = [];

		if (wasConnected) {
			this.onDisconnected();
		}
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

	request(commandId, payload, deviceId, callback) {
		if (!this.connected) {
			this.reportError("Cannot write to OpenRGB while disconnected.");
			return;
		}

		const request = {
			commandId: commandId,
			deviceId: deviceId || 0,
			timeoutAt: Date.now() + REQUEST_TIMEOUT_MS,
			callback: callback || function () {}
		};

		if (typeof setTimeout === "function") {
			const self = this;
			request.timeoutId = setTimeout(function () {
				const pendingIndex = self.pending.indexOf(request);
				if (pendingIndex < 0) {
					return;
				}

				self.pending.splice(pendingIndex, 1);
				request.callback(undefined, "OpenRGB request timed out: command " + commandId + " device " + (deviceId || 0));
			}, REQUEST_TIMEOUT_MS);
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

	getControllerData(index, callback) {
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
		});
	}

	getAllControllers(callback) {
		const self = this;
		this.getControllerCount(function (count, countError) {
			if (countError) {
				callback([], countError);
				return;
			}

			const devices = [];
			self.onProgress("OpenRGB reported " + count + " controller(s).");
			const loadNext = function (index) {
				if (index >= count) {
					callback(devices);
					return;
				}

				self.onProgress("Reading OpenRGB controller " + (index + 1) + "/" + count + "...");
				self.getControllerData(index, function (controllerData, error) {
					if (error) {
						self.logger("Skipping OpenRGB controller " + index + ": " + error);
						loadNext(index + 1);
						return;
					}

					devices.push(controllerData);
					loadNext(index + 1);
				});
			};

			loadNext(0);
		});
	}

	getProfileList(callback) {
		this.request(Command.requestProfileList, [], 0, function (packet) {
			try {
				callback(parseProfileList(packet.payload));
			} catch (error) {
				callback([], "Failed to parse OpenRGB profiles: " + error);
			}
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

function buildSignalRgbLayout(controllerData) {
	const zones = controllerData.zones || [];

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
			device.setSubdeviceLeds(subdeviceId, map.names, map.x, map.y);
			subdeviceMaps.push({
				id: subdeviceId,
				positions: map.positions
			});
		}

		device.SetIsSubdeviceController(true);
		return;
	}

	const zone = zones.length === 1 ? zones[0] : { type: 1, ledsCount: getControllerLedCount(controllerData) };
	const map = buildZoneLedMap(controllerData, zone, 0);
	ledPositions = map.positions;
	device.setSize([map.width, map.height]);
	device.setControllableLeds(map.names, map.positions);
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
		for (let localIndex = 0; localIndex < count; localIndex++) {
			const position = findMatrixPosition(matrix.keys, localIndex);
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

function collectFrameColors() {
	let colors = [];

	if (subdeviceMaps.length > 0) {
		for (let i = 0; i < subdeviceMaps.length; i++) {
			const map = subdeviceMaps[i];
			for (let j = 0; j < map.positions.length; j++) {
				colors.push(resolveColor(function () {
					return device.subdeviceColor(map.id, map.positions[j][0], map.positions[j][1]);
				}));
			}
		}
	} else {
		for (let i = 0; i < ledPositions.length; i++) {
			const position = ledPositions[i];
			colors.push(resolveColor(function () {
				return device.color(position[0], position[1]);
			}));
		}
	}

	const targetCount = getControllerLedCount(controller);
	if (targetCount > 0) {
		colors = normalizeColorCount(colors, targetCount);
	}

	return colors;
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

function parseProfileList(payload) {
	const reader = new ByteReader(payload);
	reader.u32();
	const count = reader.u16();
	const profiles = [];
	for (let i = 0; i < count; i++) {
		profiles.push(reader.string());
	}
	return profiles;
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

function getDisabledDeviceSummaries(availableDevices, availableDeviceSummaries) {
	const disabledIds = readDisabledDeviceIds();
	const output = [];

	if (disabledIds.length === 0) {
		return output;
	}

	const knownSummaries = getKnownDeviceSummaries(availableDevices, availableDeviceSummaries);
	const disabledSummaries = mergeDisabledDeviceSummaries(disabledIds, knownSummaries);
	saveDisabledDeviceSummaries(disabledSummaries);

	for (let i = 0; i < disabledIds.length; i++) {
		const item = findDeviceSummaryById(disabledSummaries, disabledIds[i]);
		if (item) {
			output.push(item);
		}
	}

	return output;
}

function getKnownDeviceSummaries(availableDevices, availableDeviceSummaries) {
	const output = [];
	appendDeviceSummaries(output, availableDeviceSummaries || []);
	appendDeviceSummaries(output, buildDeviceSummaries(availableDevices || []));
	appendDeviceSummaries(output, safeJsonParse(readSetting(LAST_DEVICES_SETTING, "[]"), []));
	appendDeviceSummaries(output, buildDeviceSummaries(readSelectedDevices()));
	appendDeviceSummaries(output, readDisabledDeviceSummaries());
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

function mergeDisabledDeviceSummaries(disabledIds, knownSummaries) {
	const output = [];
	const known = [];
	appendDeviceSummaries(known, knownSummaries || []);
	appendDeviceSummaries(known, readDisabledDeviceSummaries());

	for (let i = 0; i < disabledIds.length; i++) {
		const deviceId = String(disabledIds[i] || "");
		if (!deviceId) {
			continue;
		}

		const summary = findDeviceSummaryById(known, deviceId) || {
			deviceId: deviceId,
			name: "OpenRGB Device",
			vendor: "",
			description: "",
			serial: "",
			location: "",
			openrgbIndex: 0,
			openrgbHost: DEFAULT_HOST,
			openrgbPort: DEFAULT_PORT,
			ledCount: 0,
			zoneCount: 0,
			type: 19,
			icon: getDeviceIconUrl(19),
			image: getBridgeDeviceIconUrl(19)
		};

		if (!findDeviceSummaryById(output, deviceId)) {
			output.push(summary);
		}
	}

	return output;
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

function filterEnabledDevices(devices, disabledIds) {
	const output = [];
	for (let i = 0; i < devices.length; i++) {
		const deviceData = devices[i];
		if (deviceData && disabledIds.indexOf(deviceData.deviceId) < 0) {
			output.push(deviceData);
		}
	}
	return output;
}

function pruneDisabledDeviceIds(disabledIds, devices) {
	const availableIds = getDeviceIds(devices);
	const output = [];
	for (let i = 0; i < disabledIds.length; i++) {
		if (availableIds.indexOf(disabledIds[i]) >= 0) {
			output.push(disabledIds[i]);
		}
	}
	return output;
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

function readDisabledDeviceIds() {
	const parsed = safeJsonParse(readSetting(DISABLED_DEVICE_IDS_SETTING, "[]"), []);
	const output = [];
	for (let i = 0; i < parsed.length; i++) {
		const deviceId = String(parsed[i] || "");
		if (deviceId && output.indexOf(deviceId) < 0) {
			output.push(deviceId);
		}
	}
	return output;
}

function readDisabledDeviceSummaries() {
	const parsed = safeJsonParse(readSetting(DISABLED_DEVICE_SUMMARIES_SETTING, "[]"), []);
	const output = [];
	appendDeviceSummaries(output, parsed);
	return output;
}

function saveDisabledDeviceSummaries(devices) {
	const output = [];
	appendDeviceSummaries(output, devices || []);
	const value = JSON.stringify(output);
	if (readSetting(DISABLED_DEVICE_SUMMARIES_SETTING, "[]") !== value) {
		saveSetting(DISABLED_DEVICE_SUMMARIES_SETTING, value);
	}
}

function upsertDisabledDeviceSummary(deviceData) {
	const summary = normalizeDeviceSummary(deviceData);
	if (!summary) {
		return;
	}

	const devices = readDisabledDeviceSummaries().filter(function (item) {
		return item.deviceId !== summary.deviceId;
	});
	devices.push(summary);
	saveDisabledDeviceSummaries(devices);
}

function removeDisabledDeviceSummary(deviceId) {
	deviceId = String(deviceId || "");
	const devices = readDisabledDeviceSummaries().filter(function (item) {
		return item.deviceId !== deviceId;
	});
	saveDisabledDeviceSummaries(devices);
}

function saveDisabledDeviceIds(deviceIds) {
	saveSetting(DISABLED_DEVICE_IDS_SETTING, JSON.stringify(deviceIds || []));
}

function addDisabledDeviceId(deviceId) {
	if (!deviceId) {
		return;
	}

	addDisabledDeviceIds([deviceId]);
}

function addDisabledDeviceIds(deviceIds) {
	const disabledIds = readDisabledDeviceIds();
	for (let i = 0; i < deviceIds.length; i++) {
		const deviceId = String(deviceIds[i] || "");
		if (deviceId && disabledIds.indexOf(deviceId) < 0) {
			disabledIds.push(deviceId);
		}
	}
	saveDisabledDeviceIds(disabledIds);
}

function removeDisabledDeviceId(deviceId) {
	deviceId = String(deviceId || "");
	const disabledIds = readDisabledDeviceIds().filter(function (item) {
		return item !== deviceId;
	});
	saveDisabledDeviceIds(disabledIds);
}

function removeStaleControllers(previousDevices, currentDevices) {
	const currentIds = {};
	for (let i = 0; i < currentDevices.length; i++) {
		if (currentDevices[i] && currentDevices[i].deviceId) {
			currentIds[currentDevices[i].deviceId] = true;
		}
	}

	for (let i = 0; i < previousDevices.length; i++) {
		const previousDevice = previousDevices[i] || {};
		if (!previousDevice.deviceId || currentIds[previousDevice.deviceId]) {
			continue;
		}

		const controllerToRemove = service.getController(previousDevice.deviceId);
		if (controllerToRemove !== undefined) {
			service.removeController(controllerToRemove);
		}
	}
}

function findMatrixPosition(matrix, ledIndex) {
	for (let row = 0; row < matrix.length; row++) {
		for (let col = 0; col < matrix[row].length; col++) {
			if (matrix[row][col] === ledIndex) {
				return [col, row];
			}
		}
	}

	return [ledIndex, 0];
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
		return Array.from(new Uint8Array(value.buffer));
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
