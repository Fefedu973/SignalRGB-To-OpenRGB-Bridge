const express = require("express");
const { Client } = require("openrgb-sdk");

const app = express();
const port = 9730; // You can change the port number as needed

app.use(express.json());

app.get("/getDeviceList", async (req, res) => {
    try {
        const { host, port } = req.query;
        console.log("Host:", host);
        console.log("Port:", port);

        // Validate if host and port are provided
        if (!host || !port) {
            return res.status(400).send("Both host and port parameters are required.");
        }

        const client = new Client("Example", parseInt(port), host);
        await client.connect();

        const controllerCount = await client.getControllerCount();

        let deviceList = [];
        for (let deviceId = 0; deviceId < controllerCount; deviceId++) {
            deviceList.push(await client.getControllerData(deviceId));
        }

        await client.disconnect();

        res.status(200).json(deviceList);
    } catch (error) {
        console.error("Error getting device list:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
