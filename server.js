const ConsoleWindow = require("node-hide-console-window");
ConsoleWindow.hideConsole();
setTimeout(() => {
var AutoLaunch = require('auto-launch');
const express = require("express");
const { Client } = require("openrgb-sdk");
const crypto = require('crypto');
const path = require("path");
const app = express();

let port = 9730; // Default port

let portMatch = false;
let consoleMode = false;
let fileName = path.basename(process.execPath);

if (fileName.includes("node.exe")) {
    fileName = __filename.split("\\").pop().split("/").pop();
    console.log("Starting js version server: ", fileName, "on port", port);
    portMatch = fileName.match(/--port=\${(\d+)}/);
    consoleMode = fileName.includes("--console");
} else {
    console.log("Starting exe version server: ", fileName, "on port", port);
    portMatch = fileName.match(/--port=\${(\d+)}/);
    consoleMode = fileName.includes("--console");
    noautostart = fileName.includes("--no-startup");
    console.log(process.execPath)
    var autoLauncher = new AutoLaunch({
        name: 'OpenRGBBridge',
        path: process.execPath,
    });
    if (!noautostart) {
        autoLauncher.enable();
        autoLauncher.isEnabled()
            .then(function (isEnabled) {
                if (isEnabled) {
                    return;
                }
                autoLauncher.enable();
            })
            .catch(function (err) {
                console.error(err);
            });
    }
    else {
        autoLauncher.disable();
    }
}

if (consoleMode) {
    ConsoleWindow.showConsole();
    console.log("Console mode enabled");
}

if (portMatch) {
    const newPort = parseInt(portMatch[1], 10);
    console.log("Port number detected in the file name:", newPort);
    port = newPort;
}

    let client;
    let hostSDK;
    let portSDK;

    //create an array of the id and the hash of the device
    let deviceHashesWithId = [];

app.use(express.json());

app.get("/connect", async (req, res) => {
    try {
        const { host, port } = req.query;
        //make the host and port global so we can use it in the other functions and reconnect if the connection is lost

        if (!host || !port) {
            return res.status(400).send("Both host and port parameters are required.");
        }

        console.log("Connecting to", host, "on port", port + "and the client ask for the device list:");
        if (client) {
            await client.disconnect();
            client = undefined;
            console.log("Disconnected successfully");
        }

        hostSDK = host;
        portSDK = port;

        client = new Client("OpenRGBBridge", parseInt(port), host);
        await client.connect();

        const controllerCount = await client.getControllerCount();
        let deviceList = [];
        deviceHashesWithId = [];
        for (let deviceId = 0; deviceId < controllerCount; deviceId++) {
            //for each device edit the device id to be a hash of the string combining the device name,vendor,description,version,serial and location
            //this will be used to identify the device in the frontend because the device id can change if the device is disconnected and reconnected and the device id given by the sdk is not unique to the device it"s just the order in which the device was connected
            const deviceData = await client.getControllerData(deviceId);
            let deviceOldId = deviceData.deviceId;

            // Combine device properties into a string
            const deviceInfoString = `${deviceData.deviceId}${deviceData.name}${deviceData.vendor}${deviceData.description}${deviceData.version}${deviceData.serial}${deviceData.location}`;
            console.log("Device Info String:", deviceInfoString);
            // Create a hash of the combined string
            const hash = crypto.createHash('md5').update(deviceInfoString).digest('hex');
            console.log("Device Info Hash:", hash);

            // Add the hash to the device data
            deviceData.deviceId = hash;

            let deviceNewId = deviceData.deviceId;

            // Push the modified device data to the list
            deviceList.push(deviceData);

            let deviceArray = [deviceOldId, deviceNewId];
            deviceHashesWithId.push(deviceArray);
        }
        console.log("Device list Retrived Sucessfully. There are", deviceList.length, "devices available");

        res.status(200).json(deviceList);
        return;
    } catch (error) {
        console.error("Error connecting:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/disconnect", async (req, res) => {
    try {
        await client.disconnect();
        client = undefined;
        res.status(200).send("Disconnected successfully");
        console.log("Disconnected successfully");
    } catch (error) {
        console.error("Error disconnecting:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/GetAvalaibleDevices", async (req, res) => {
    try {
        const controllerCount = await client.getControllerCount();

        let deviceList = [];
        deviceHashesWithId = [];
        for (let deviceId = 0; deviceId < controllerCount; deviceId++) {
            deviceList.push(await client.getControllerData(deviceId));
        }

        res.status(200).json(deviceList);
        console.log("Device list Retrived Sucessfully. There are", deviceList.length, "devices available");
    } catch (error) {
        console.error("Error getting device list:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/setColors", async (req, res) => {
    try {
        let { colors, deviceId } = req.query;

        colors = JSON.parse(colors);

        //console.log("Changing colors of device", deviceId, "to", colors);

        if (!colors || !deviceId) {
            return res.status(400).send("Both colors and deviceId parameters are required.");
        }

        const controllerCount = await client.getControllerCount();

        //match the hash to the device id and set the mode of the old device id and not the new one
        for (let i = 0; i < deviceHashesWithId.length; i++) {
            if (deviceHashesWithId[i][1] === deviceId) {
                deviceId = deviceHashesWithId[i][0];
                break;
            }
        }

        if (deviceId < 0 || deviceId >= controllerCount) {
            return res.status(400).send("Invalid deviceId.");
        }

        await client.updateLeds(deviceId, colors);

        res.status(200).send("Colors updated successfully");
        //console.log("Colors updated successfully");
    } catch (error) {
        console.error("Error setting colors:", error);
        res.status(500).send("Internal Server Error");
        //try to reconnect
        //make this a try catch block so we don't get an unhandled promise rejection
        try {
            if (client) {
                await client.disconnect();
                client = undefined;
                console.log("Disconnected successfully");
            }
            //try to reconnect using the last known host and port

            client = new Client("OpenRGBBridge", parseInt(portSDK), hostSDK);
            await client.connect();
        } catch (error) {
            console.error("Error reconnecting:", error);
        }
        
    }
});

app.get("/setMode", async (req, res) => {
    try {
        let { mode, deviceId } = req.query;

        mode = parseInt(mode);

        console.log("Changing mode of device", deviceId, "to", mode);

        if (!mode || !deviceId) {
            return res.status(400).send("Both mode and deviceId parameters are required.");
        }

        const controllerCount = await client.getControllerCount();

        //match the hash to the device id and set the mode of the old device id and not the new one
        for (let i = 0; i < deviceHashesWithId.length; i++) {
            if (deviceHashesWithId[i][1] === deviceId) {
                deviceId = deviceHashesWithId[i][0];
                break;
            }
        }

        if (deviceId < 0 || deviceId >= controllerCount) {
            return res.status(400).send("Invalid deviceId.");
        }



        await client.updateMode(deviceId, mode);

        res.status(200).send("Mode updated successfully");
        console.log("Mode updated successfully");
    } catch (error) {
        console.error("Error setting mode:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT signal. Disconnecting from the server...');
    await disconnectAndExit();
});

if (process.platform === 'win32') {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('SIGINT', () => {
        process.emit('SIGINT');
    });
}

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM signal. Disconnecting from the server...');
    await disconnectAndExit();
});

async function disconnectAndExit() {
    try {
        if (client) {
            //wait 10 seconds for the client to disconnect
                await client.disconnect();
                client = undefined;
                console.log('Disconnected successfully');
        }
        server.close(() => {
            console.log('Server closed. Exiting...');
            process.exit(0);
        });
    } catch (error) {
        console.error('Error disconnecting:', error);
        process.exit(1);
    }
}
}, 5000);