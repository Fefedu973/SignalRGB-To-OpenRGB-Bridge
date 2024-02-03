//import Client from "./openrgb.js";

export function Name() { return "OpenRGB Bridge"; }
export function Version() { return "1.1.0"; }
export function Type() { return "network"; }
export function Publisher() { return "Fefe_du_973"; }
export function Size() { return [3, 3]; }
export function DefaultPosition() {return [75, 70]; }
export function DefaultScale(){return 8.0;}
export function SubdeviceController(){ return true;}

export function ControllableParameters() {
}

export function Initialize() {
}


export function Render() {
}

export function Shutdown() {
}


export function DiscoveryService() {
	this.connect = function() {
		service.log("Connecting to OpenRGB");
	}
}

export function Image(){
	return "";
}
