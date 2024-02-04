export function Name() { return "OpenRGB Bridge"; }
export function Version() { return "1.1.0"; }
export function Type() { return "network"; }
export function Publisher() { return "Fefe_du_973"; }
export function Size() { return [3, 3]; }
export function DefaultPosition() {return [75, 70]; }
export function DefaultScale(){return 8.0;}
export function SubdeviceController(){ return true;}

export function ControllableParameters() {
	retrun [
		{ "property": "shutdownColor", "group": "lighting", "label": "Shutdown Color", "min": "0", "max": "360", "type": "color", "default": "#009bde" },
		{ "property": "LightingMode", "group": "lighting", "label": "Lighting Mode", "type": "combobox", "values": ["Canvas", "Forced"], "default": "Canvas" },
		{ "property": "forcedColor", "group": "lighting", "label": "Forced Color", "min": "0", "max": "360", "type": "color", "default": "#009bde" }
	];
}

export function Initialize() {
}


export function Render() {
}

export function Shutdown() {
}
  
  export function Image() {
	return "";
  }

// ... (Your existing code)

export function DiscoveryService() {


    this.deviceList = [];
	this.valid = false;
	this.selectedDevices = [];
	
	// Private variables
	let serverURL = "http://localhost:9730"; // Replace with your Node.js server URL
  
	// Public methods
	this.connect = function () {
		service.log(discovery.deviceList.length);
	};

	this.updateDevices = function () {
		service.log(discovery.selectedDevices);
		for (let i = 0; i < discovery.selectedDevices.length; i++) {
			let deviceId = discovery.selectedDevices[i].deviceId;
			let colors = Array(discovery.selectedDevices[i].colors.length).fill({
				red: 0xFF,
				green: 0x00,
				blue: 0x00
			})
			let host = '127.0.0.1'
			let port = 6742
			

			service.log(deviceId);
			service.log(colors);

			const xhr = new XMLHttpRequest();

			xhr.open("GET", `http://localhost:9730/setColors?host=${host}&port=${port}&colors=${JSON.stringify(colors)}&deviceId=${deviceId}`, true);


			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4 && xhr.status === 200) {
					service.log(xhr.responseText);
				}
			};
			xhr.send();
		}

		

	}
	

  
	this.Update = function () {
	  // Implement Update logic if needed
	};

}