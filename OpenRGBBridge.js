export function Name() { return "Cololight"; }
export function Version() { return "1.1.2"; }
export function Type() { return "network"; }
export function Publisher() { return "SignalRGB"; }
export function Size() { return [1, 62]; }
export function DefaultPosition() {return [75, 70]; }
export function DefaultScale(){return 1.0;}

export function ControllableParameters(){
  return [
      {"property":"g_sMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas","Canvas Multi", "Forced", "Savasana", "Sunrise", "Unicorns", "Pensieve", "The Circus", "Instashare", "Eighties", "Cherry Blossoms", "Rainbow", "Christmas"], "default":"Canvas"},
      {"property":"g_iBrightness", "label":"Hardware Brightness","step":"1", "type":"number","min":"1", "max":"100","default":"50"},
      {"property":"forcedColor", "label":"Forced Color","min":"0","max":"360","type":"color","default":"#009bde"}      
  ];
}
/* global
controller:readonly
*/
const BIG_ENDIAN = 0;
const canStream = false;
let streamingAddress = "";
let streamingPort = "";
const lightcount = 0;
let positions;

// C'mon man - use change dtors for these.
let g_currentBrightness = 0;
let g_sCurrentMode = "";
let g_sCurrentForced = "";
let bInDynamicMode = false;


export function Initialize() {
	device.setName(controller.name);

	device.addFeature("udp");

	streamingAddress = controller.ip;
	streamingPort = 8900;

  // Set image.
  device.setImageFromUrl(controller.image);
  
  SetBrightness(g_iBrightness);  
  g_sCurrentMode = "None";  
}


function SyncBrightness()
{
  if (g_currentBrightness !== g_iBrightness)
  {
    SetBrightness(g_iBrightness);
  }
}

function SyncMode()
{
  if (g_sCurrentMode !== g_sMode)
  {
    g_sCurrentMode = g_sMode;
    if (g_sCurrentMode === "Canvas"){      
      SetDynamicLightMode();
    } else if (g_sCurrentMode === "Canvas Multi") {
      SetDynamicLightMode();
    } else if (g_sCurrentMode === "Forced"){
      // Set TL1 color.
      device.log("Forced: "+forcedColor);
      bInDynamicMode = false;
      g_sCurrentForced = "";
    } else {
      SetColorMode(g_sCurrentMode);
      bInDynamicMode = false;
    }
  }
}


function SetBrightness(aiBrightness)
{
    device.log("Setting brightness to "+aiBrightness);

    if (aiBrightness > 100) { aiBrightness = 100;}
    else if (aiBrightness < 0) { aiBrightness = 0; }
    
    const packet = [0x53, 0x5A,
      0x30, 0x30,
      0x00, 0x00, // 0x0001 = buffer mode
      0x00, 0x00, 0x00, 0x20, // size (of what follows)
  
      0x00, 0x00, 0x00, 0x00, //security 1
      0x00, 0x00, 0x00, 0x00, //security 2
      0x00, 0x00, 0x00, 0x00, //security 3
      0x00, 0x00, 0x00, 0x00, //security 4
  
      0x21, // SeqN
      0x00, 0x00, 0x00, 0x00, // DSTID
      0x00, 0x00, 0x00, 0x00, // SRCID
      0x00, // SEC
      0x04, // VERB
      0x21, // CTAG
      0x03, // LEN
  
      0x01,
      0xCF,
  
      aiBrightness
    ];
    
    g_currentBrightness = aiBrightness;

    udp.send(streamingAddress, streamingPort, packet);
}


function SetTL1Color(r,g,b)
{
    const packet = [0x53, 0x5A,
      0x30, 0x30,
      0x00, 0x01, // 0x0001 = buffer mode
      0x00, 0x00, 0x00, 0x20, // size (of what follows)
  
      0x00, 0x00, 0x00, 0x00, //security 1
      0x00, 0x00, 0x00, 0x00, //security 2
      0x00, 0x00, 0x00, 0x00, //security 3
      0x00, 0x00, 0x00, 0x00, //security 4
  
      0x21, // SeqN
      0x00, 0x00, 0x00, 0x00, // DSTID
      0x00, 0x00, 0x00, 0x00, // SRCID
      0x00, // SEC
      0x04, // VERB
      0x21, // CTAG
      0x05, // LEN
  
      0x02,
		  0xFF,

		  0x00, 0xFF, 0x00, 0xFF
    ];
    
    var len = packet.length - 10;
    packet[9] = len;    

    udp.send(streamingAddress, streamingPort, packet);
}


var modes = new Map();
modes.set("Off", [0x00,0x00,0x00,0x00]);
modes.set("Dynamic", [0x81,0x00,0x00,0x00]);
modes.set("Savasana", [0x04,0x97,0x04,0x00]);
modes.set("Sunrise",[0x01,0xc1,0x0a,0x00]);
modes.set("Unicorns",[0x04,0x97,0x04,0x00]);
modes.set("Pensieve",[0x01,0xc1,0x0a,0x00]);
modes.set("The Circus",[0x04,0x81,0x01,0x30]);
modes.set("Instashare",[0x03,0xbc,0x01,0x90]);
modes.set("Eighties",[0x04,0x9a,0x00,0x00]);
modes.set("Cherry Blossoms",[0x04,0x94,0x08,0x00]);
modes.set("Rainbow",[0x05,0xbd,0x06,0x90]);
modes.set("Christmas",[0x06,0x8B,0x09,0x00]);


var g_iPacketSeq = 0;
function SetSingleColorDynTL1()
{
  g_iPacketSeq++;
  if (g_iPacketSeq > 0xFF){g_iPacketSeq = 0;}
  //device.log("Setting dyn mode "+s);

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x00, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    g_iPacketSeq, // SeqN
    0x00, 0x00, 0x00, 0x00, // DSTID
    0x00, 0x00, 0x00, 0x00, // SRCID
    0x00, // SEC
    0x0B, // VERB
    0x21, // CTAG
    0x05, // LEN

		0x81,
    0x1,
    //0xFF,0x00,0xFF		
  ];

  packet = packet.concat(device.color(0, 0));


  var len = packet.length - 10;
  packet[9] = len;
  //device.log("Len: "+len);

  udp.send(streamingAddress, streamingPort, packet);
}


function SetSingleColorDynDir()
{
  // Not sure if they even do anything with this on the RX end...
  //g_iPacketSeq++;
  //if (g_iPacketSeq > 0xFF){g_iPacketSeq = 0;}

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x01, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    g_iPacketSeq, // SeqN

    0x1,    		
  ];


  packet = packet.concat(device.color(0, 0));


  var len = packet.length - 10;
  packet[9] = len;

  udp.send(streamingAddress, streamingPort, packet);
}


function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join(' ')
}
var prev = ""
function SendSegment2(offset, y)
{
  //g_iPacketSeq++;
  // Not sure if they even do anything with this on the RX end...
  if (g_iPacketSeq > 0xFF){g_iPacketSeq = 0;}
  //device.log("Sending: "+g_iPacketSeq);

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x00, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    g_iPacketSeq, // SeqN
    0x00, 0x00, 0x00, 0x00, // DSTID
    0x00, 0x00, 0x00, 0x00, // SRCID
    0x00, // SEC
    0x0B, // VERB
    0x21, // CTAG
    0x07, // LEN

		0x81,
    0x2,    		
  ];

  // LEN is packet position 38.
  let dtaLen = packet.length - 3;

  packet = packet.concat([offset,offset+19]);
  packet = packet.concat(device.color(0,y));    

  packet[dtaLen] = 8;

  var len = packet.length - 10;
  packet[9] = len;

  //device.log("PK: "+toHexString(packet));
  //device.log(packet)
  udp.send(streamingAddress, streamingPort, packet);
}

var arr;
var view;

function toBytesInt32 (num) {
  arr = new Uint8Array([
       (num & 0xff000000) >> 24,
       (num & 0x00ff0000) >> 16,
       (num & 0x0000ff00) >> 8,
       (num & 0x000000ff)
  ]);
  return arr.buffer;
}

var lastlen = 0;
function SendSegmentWholeHex()
{
  //g_iPacketSeq++;
  if (g_iPacketSeq > 0xFF){g_iPacketSeq = 0;}
  //device.log("Sending: "+g_iPacketSeq);

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x01, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    g_iPacketSeq, // SeqN

    0x2,    		
  ];

  // LEN is packet position 38.
  //let dtaLen = packet.length - 3;

  //packet = packet.concat([offset, offset+19]);
  //packet = packet.concat(device.color(2,y));    
  var pixels = 120;

  for(var iPacketIdx = 0; iPacketIdx < pixels; iPacketIdx++){
    var iStartIdx = iPacketIdx + 1;
    var iEndIdx = iStartIdx + 1;    
    var iYCoord = (iPacketIdx / pixels) * 60;
    packet = packet.concat([iStartIdx, iEndIdx]);    
    packet = packet.concat(device.color(0,iYCoord));  
    //var pk = [Math.random() * 254, Math.random() * 254, Math.random() * 254];
    //packet = packet.concat(pk);
  }

  //packet[dtaLen] = 8;

  var len = packet.length - 10;
  var lenArr = toBytesInt32(len);
  packet[8] = (len & 0x0000ff00) >> 8;
  packet[9] = (len & 0x000000ff);
  
  if (lastlen !== len){
    device.log("Packet len is: "+len);
    lastlen = len;
  }

  udp.send(streamingAddress, streamingPort, packet);
}

function SendSegmentDir(offset, y)
{
  if (offset <= 0) { device.log("LED indices are 1-based!!!"); }

  //g_iPacketSeq++;
  if (g_iPacketSeq > 0xFF){g_iPacketSeq = 0;}
  //device.log("Sending: "+g_iPacketSeq);

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x01, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    g_iPacketSeq, // SeqN

    0x2,    		
  ];

  // LEN is packet position 38.
  //let dtaLen = packet.length - 3;

  //packet = packet.concat([offset, offset+19]);
  //packet = packet.concat(device.color(2,y));    
  for(var iPacketIdx = 0; iPacketIdx < 5; iPacketIdx++){
    var iStartIdx = offset + (iPacketIdx * 4);
    var iEndIdx = iStartIdx + 5;    
    packet = packet.concat([iStartIdx, iEndIdx]);
    packet = packet.concat(device.color(0,y-5 + iPacketIdx));  
  }

  //packet[dtaLen] = 8;

  var len = packet.length - 10;
  packet[9] = len;

  //device.log("PK: "+toHexString(packet));
  //device.log(packet)
  udp.send(streamingAddress, streamingPort, packet);
}

function SendSegment(offset)
{
  //g_iPacketSeq++;
  if (g_iPacketSeq > 0xFF){g_iPacketSeq = 0;}
  device.log("Sending: "+g_iPacketSeq);

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x00, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    g_iPacketSeq, // SeqN
    0x00, 0x00, 0x00, 0x00, // DSTID
    0x00, 0x00, 0x00, 0x00, // SRCID
    0x00, // SEC
    0x0B, // VERB
    0x21, // CTAG
    0x07, // LEN

		0x81,
    0x2,    		
  ];

  // LEN is packet position 38.
  let dtaLen = packet.length - 3;

  let count = 4;
  for(var iIdx = 0; iIdx < count; iIdx++)
  {
    var start = offset + (iIdx * 10);
    var end = start + 9;
    var y = Math.floor(start / 4);
    packet = packet.concat([start,end]);
    packet = packet.concat(device.color(0,y));    
    //device.log("s: "+start+", e: "+end+", y: "+y);
  }

  packet[dtaLen] = 7 * count;

  var len = packet.length - 10;
  packet[9] = len;

  udp.send(streamingAddress, streamingPort, packet);
}


function SetColorMode(item)
{
  device.log("Setting color mode: "+item);

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x00, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    0x21, // SeqN
    0x00, 0x00, 0x00, 0x00, // DSTID
    0x00, 0x00, 0x00, 0x00, // SRCID
    0x00, // SEC
    0x04, // VERB
    0x21, // CTAG
    0x06, // LEN

		0x02,
		0xFF
  ];

  packet = packet.concat(modes.get(item));
  
  // Calc len.
  var len = packet.length - 10;
  packet[9] = len;
  device.log("Len: "+len);

  udp.send(streamingAddress, streamingPort, packet);
}

function SetDynamicLightMode()
{
  if (bInDynamicMode) return;

  g_iPacketSeq = 0x21;
  
  device.log("Enabling Dynamic Lighting Mode");

  let packet = [0x53, 0x5A,
    0x30, 0x30,
    0x00, 0x00, // 0x0001 = buffer mode
    0x00, 0x00, 0x00, 0x20, // size (of what follows)

    0x00, 0x00, 0x00, 0x00, //security 1
    0x00, 0x00, 0x00, 0x00, //security 2
    0x00, 0x00, 0x00, 0x00, //security 3
    0x00, 0x00, 0x00, 0x00, //security 4

    0x21, // SeqN
    0x00, 0x00, 0x00, 0x00, // DSTID
    0x00, 0x00, 0x00, 0x00, // SRCID
    0x00, // SEC
    0x04, // VERB
    0x21, // CTAG
    0x06, // LEN

		0x02,
		0xFF,
    0x81,0x00,0x00,0x00
  ];
  
  // Calc len.
  var len = packet.length - 10;
  packet[9] = len;
  
  bInDynamicMode = true;

  udp.send(streamingAddress, streamingPort, packet);
}


function MonocolorSend() 
{  
  SetSingleColorDynDir();  
}


function MultiTileSend()
{
  //device.log("M: "+JSON.stringify(controller.response));
  
  SendSegmentWholeHex();

  //var isStrip = controller.subkey === "HKC32";

/*
  if (!isStrip){
    SendSegmentDir(1, 30);
    SendSegmentDir(21, 25);
    SendSegmentDir(41, 20);
    SendSegmentDir(61, 15);
    SendSegmentDir(81, 10);  
    SendSegmentDir(101, 5);
  } else {
    
    SendSegmentWholeHex();
*/
    /*var startY = 30;
    for(var iHexLevel=0; iHexLevel < 6; iHexLevel++){
      var startOffset = 1 + (iHexLevel*19);
      var yOffset = startY - (iHexLevel * 5);
      SendSegmentWholeHex(startOffset, yOffset);
    } */     
}


function ForcedSend()
{  
  if (g_sCurrentForced !== forcedColor){
    SendSolidColor(Math.floor(forcedColor.r * 255),
                   Math.floor(forcedColor.g * 255),
                   Math.floor(forcedColor.b * 255));
    g_sCurrentForced = forcedColor;
    device.log("Sending forced: "+forcedColor);
  }  
}


export function Render() 
{
  SyncBrightness();

  SyncMode();

  if (g_sCurrentMode === "Canvas")
  {
    MonocolorSend();
  }
  else if (g_sCurrentMode === "Canvas Multi")
  {
    MultiTileSend();
  }	
  else if (g_sCurrentMode === "Forced")
  {
    ForcedSend();
  }
}

function SendSolidColor(r, g, b) {
	const packet = [0x53, 0x5A,
		0x30, 0x30,
		0x00, 0x00, // 0x0001 = buffer mode
		0x00, 0x00, 0x00, 0x23, // size
		0x00, 0x00, 0x00, 0x00, //security 1
		0x00, 0x00, 0x00, 0x00, //security 2
		0x00, 0x00, 0x00, 0x00, //security 3
		0x00, 0x00, 0x00, 0x00, //security 4

		0x22, // SN
		0x00, 0x00, 0x00, 0x00, //DSTID
		0x00, 0x00, 0x00, 0x00, //SRCID
		0x00, // SEC
		0x04, // VERB
		0x24, // CTAG
		0x06, // LEN

		0x02,
		0xFF,

		0x00, r, g, b //color
	];

	// Send three copies.  UDP disappears sometimes.
	udp.send(streamingAddress, streamingPort, packet);
}


function Blackout() {
	const packet = [0x53, 0x5A,
		0x30, 0x30,
		0x00, 0x00, // 0x0001 = buffer mode
		0x00, 0x00, 0x00, 0x23, // size
		0x00, 0x00, 0x00, 0x00, //security 1
		0x00, 0x00, 0x00, 0x00, //security 2
		0x00, 0x00, 0x00, 0x00, //security 3
		0x00, 0x00, 0x00, 0x00, //security 4

		0x22, // SN
		0x00, 0x00, 0x00, 0x00, //DSTID
		0x00, 0x00, 0x00, 0x00, //SRCID
		0x00, // SEC
		0x04, // VERB
		0x24, // CTAG
		0x06, // LEN

		0x02,
		0xFF,

		0x00, 0x00, 0x00, 0x00 //color
	];

	// Send three copies.  UDP disappears sometimes.
	udp.send(streamingAddress, streamingPort, packet);
}


export function Shutdown() {
	Blackout();
}

// -------------------------------------------<( Discovery Service )>--------------------------------------------------


export function DiscoveryService() {
	this.IconUrl = "https://assets.signalrgb.com/brands/custom/cololight/light_icon.png";

	// Listen to local broadcast address, on port 12345
	this.UdpBroadcastPort = 12345;
	this.UdpListenPort = 12345;
	this.UdpBroadcastAddress = "255.255.255.255";

	this.timeSinceLastReq = 0;

	this.Retries = 5;
	this.RetryCount = 0;

	this.Initialize = function() {

	};

	this.Update = function() {
		if (this.timeSinceLastReq <= 0) { //} && this.RetryCount < this.Retries){
			service.log("Requesting...");
			service.broadcast("Z-SEARCH * \r\n");
			this.timeSinceLastReq = 10;
			this.RetryCount++;
		}

		this.timeSinceLastReq--;
	};

	this.ResponseStringToObj = function(sResponse) {
		const response = {};
		const sResp = sResponse.toString().split("\r\n");

		for(const sLine of sResp){
			const vPair = sLine.split("=");

			if (vPair.length === 2) {
				response[vPair[0].toString().toLowerCase()] = vPair[1].toString();
			}
		}

		return response;
	};


	this.Discovered = function(value) {
		// Convert response to object.
		const response = this.ResponseStringToObj(value.response);

		service.log("DISC: "+JSON.stringify(response));
		const bIsCololight = response.subkey && (response.subkey === "C32" || response.subkey === "HC32" || response.subkey === "HKC32");

		if (bIsCololight) {
      value.response = response;
			const controller = service.getController(value.id);

			if (controller === undefined) {
				// Create and add new controller.
				const cont = new CololightSet(value);
				service.addController(cont);

				// Instantiate device in SignalRGB, and pass 'this' object to device.
				service.announceController(cont);

			} else {
				controller.updateWithValue(value);
			}
		}
	};

}


class CololightSet {
	constructor(value) 
  {
    this.updateWithValue(value, false);

		service.log("Constructed: "+this.name);
    service.log("Model is "+this.model);
    service.log("Image is "+this.image);
	}

  modelToName(model) {
    if (model === "C32"){
      return "Hexa";
    } else if (model === "HC32"){
      return "Hexa";
    } else if (model === "HKC32"){
      return "Strip";
    } else {
      return "Cololight";
    }
  }

  modelToImage(model) {
    if (model === "C32"){
      return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
    } else if (model === "HC32"){
      return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
    } else if (model === "HKC32"){
      return "https://assets.signalrgb.com/devices/brands/cololight/misc/strips.png";
    } else {
      return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
    }
  }

	updateWithValue(value, notify=true) {
		this.ip = value.ip;
		this.port = value.port;
		this.id = value.id;
    this.response = value.response;
    this.model = value.response.subkey;
    this.modelname = this.modelToName(this.model);
    this.image = this.modelToImage(this.model);
		this.name = this.modelname+" "+value.id.slice(-8);

		if (notify) { service.updateController(this); }
	}

	update() {

	}

}

export function ImageUrl()
{
  return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
}
