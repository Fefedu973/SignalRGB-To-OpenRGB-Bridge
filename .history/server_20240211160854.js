const ConsoleWindow = require("node-hide-console-window");
ConsoleWindow.hideConsole();
var AutoLaunch = require('auto-launch');
const express = require("express");
const { Client } = require("openrgb-sdk");
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

app.use(express.json());

app.get("/connect", async (req, res) => {
    try {
        const { host, port } = req.query;

        if (!host || !port) {
            return res.status(400).send("Both host and port parameters are required.");
        }

        console.log("Connecting to", host, "on port", port + "and the client ask for the device list:");
        if (client) {
            await client.disconnect();
            client = undefined;
            console.log("Disconnected successfully");
        }

        client = new Client("OpenRGBBridge", parseInt(port), host);
        await client.connect();

        const controllerCount = await client.getControllerCount();
        let deviceList = [];
        for (let deviceId = 0; deviceId < controllerCount; deviceId++) {
            deviceList.push(await client.getControllerData(deviceId));
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

        console.log("Changing colors of device", deviceId, "to", colors);

        if (!colors || !deviceId) {
            return res.status(400).send("Both colors and deviceId parameters are required.");
        }

        const controllerCount = await client.getControllerCount();

        if (deviceId < 0 || deviceId >= controllerCount) {
            return res.status(400).send("Invalid deviceId.");
        }

        await client.updateLeds(deviceId, colors);

        res.status(200).send("Colors updated successfully");
        console.log("Colors updated successfully");
    } catch (error) {
        console.error("Error setting colors:", error);
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
