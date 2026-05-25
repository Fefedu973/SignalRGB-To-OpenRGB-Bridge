Item {
    anchors.fill: parent

    property string statusText: "Idle"
    property int controllerCount: 0
    property int disabledDeviceCount: 0
    property string lastInactiveDevicesSignature: ""
    property string lastKnownDevicesJson: "[]"
    property string lastParseError: ""

    function safeJsonParse(value, fallback) {
        try {
            if (value === undefined || value === null || value === "") {
                return fallback
            }
            return JSON.parse(value)
        } catch (e) {
            var message = String(e)
            if (lastParseError !== message) {
                lastParseError = message
                logUi("Failed to parse disabled OpenRGB device list for UI: " + message)
            }
            return fallback
        }
    }

    function logUi(message) {
        try {
            if (discovery && discovery.logUi) {
                discovery.logUi(message)
            }
        } catch (e) {
        }
    }

    function loadSettings() {
        sdkServerIP.text = String(discovery.getHost() || "127.0.0.1")
        sdkServerPort.text = String(discovery.getPort() || "6742")
    }

    function saveSettings() {
        discovery.saveConnectionSettings(sdkServerIP.text, sdkServerPort.text)
    }

    function readStatus() {
        try {
            var value = discovery.getStatus()
            if (value === undefined || value === null || value === "") {
                return "Idle"
            }
            return String(value)
        } catch (e) {
            return "Idle"
        }
    }

    function refreshUi() {
        statusText = readStatus()
        controllerCount = controllerList.count
        refreshDisabledDevices()
    }

    function readAvailableDevicesJson() {
        try {
            var value = discovery.getAvailableDevicesJson()
            if (value === undefined || value === null || value === "") {
                return "[]"
            }
            return String(value)
        } catch (e) {
            logUi("Failed to read OpenRGB devices for inactive UI list: " + String(e))
            return "[]"
        }
    }

    function controllerObjectAt(index) {
        try {
            if (controllerList.itemAtIndex) {
                var row = controllerList.itemAtIndex(index)
                if (row && row.openRgbController) {
                    return row.openRgbController
                }
            }
        } catch (e) {
        }

        try {
            if (service.controllers && service.controllers.get) {
                var item = service.controllers.get(index)
                if (item && item.obj) {
                    return item.obj
                }
                return item
            }
        } catch (e) {
        }

        try {
            if (service.controllers && service.controllers[index]) {
                var indexed = service.controllers[index]
                if (indexed && indexed.obj) {
                    return indexed.obj
                }
                return indexed
            }
        } catch (e) {
        }

        return null
    }

    function activeDeviceIds() {
        var output = []

        for (var i = 0; i < controllerList.count; i++) {
            var item = controllerObjectAt(i)
            var deviceId = item ? String(item.deviceId || item.id || "") : ""
            if (deviceId !== "" && output.indexOf(deviceId) < 0) {
                output.push(deviceId)
            }
        }

        return output
    }

    function refreshDisabledDevices() {
        var devicesJson = readAvailableDevicesJson()
        var devices = safeJsonParse(devicesJson, [])
        if (devices.length > 0) {
            lastKnownDevicesJson = devicesJson
        } else {
            devicesJson = lastKnownDevicesJson
            devices = safeJsonParse(devicesJson, [])
        }

        var activeIds = activeDeviceIds()
        var signature = devicesJson + "|" + activeIds.join(",")
        if (signature === lastInactiveDevicesSignature) {
            return
        }

        lastInactiveDevicesSignature = signature
        clearInactiveDeviceRows()

        var inactiveCount = 0
        for (var i = 0; i < devices.length; i++) {
            var item = devices[i] || {}
            var deviceId = String(item.deviceId || "")
            if (deviceId === "" || activeIds.indexOf(deviceId) >= 0) {
                continue
            }

            var row = inactiveDeviceRowComponent.createObject(inactiveDeviceListColumn, {
                "deviceId": deviceId,
                "name": String(item.name || "OpenRGB Device"),
                "vendor": String(item.vendor || ""),
                "openrgbIndex": Number(item.openrgbIndex || 0),
                "ledCount": Number(item.ledCount || 0),
                "zoneCount": Number(item.zoneCount || 0),
                "iconSource": String(item.image || "")
            })

            if (row !== null) {
                inactiveCount++
            } else {
                logUi("Failed to create inactive OpenRGB device row " + i + ".")
            }
        }

        disabledDeviceCount = inactiveCount
        logUi("OpenRGB Bridge UI inactive model has " + disabledDeviceCount + " row(s) from " + devices.length + " known device(s) and " + activeIds.length + " active controller(s).")
    }

    function clearInactiveDeviceRows() {
        for (var i = inactiveDeviceListColumn.children.length - 1; i >= 0; i--) {
            inactiveDeviceListColumn.children[i].visible = false
            inactiveDeviceListColumn.children[i].destroy()
        }
    }

    function refreshDevices() {
        saveSettings()
        statusText = "Connect / Refresh clicked. Connecting to " + sdkServerIP.text + ":" + sdkServerPort.text + "..."
        logUi("Connect / Refresh clicked for OpenRGB at " + sdkServerIP.text + ":" + sdkServerPort.text + ".")
        discovery.refresh(sdkServerIP.text, sdkServerPort.text)
        refreshUi()
    }

    Component.onCompleted: {
        loadSettings()
        discovery.connectSelectedDevices()
        refreshDevices()
        refreshUi()
    }

    Timer {
        interval: 500
        running: true
        repeat: true
        onTriggered: refreshUi()
    }

    Component {
        id: inactiveDeviceRowComponent

        Rectangle {
            property string deviceId: ""
            property string name: "OpenRGB Device"
            property string vendor: ""
            property int openrgbIndex: 0
            property int ledCount: 0
            property int zoneCount: 0
            property string iconSource: ""

            width: inactiveDeviceListColumn.width
            height: 62
            radius: 4
            color: "#1c2530"
            border.color: "#3f4c5a"
            border.width: 1

            Image {
                x: 12
                y: 13
                width: 36
                height: 36
                source: iconSource
                fillMode: Image.PreserveAspectFit
                smooth: true
            }

            Column {
                x: 60
                y: 7
                width: parent.width - 220
                spacing: 2

                Text {
                    color: "#dbeafe"
                    text: String(name || "OpenRGB Device")
                    font.pixelSize: 15
                    font.family: "Poppins"
                    font.bold: true
                    width: parent.width
                    elide: Text.ElideRight
                }

                Text {
                    color: "#94a3b8"
                    text: (vendor ? String(vendor) + " | " : "") + "Index " + Number(openrgbIndex || 0) + " | " + Number(ledCount || 0) + " LEDs | " + Number(zoneCount || 0) + " zone(s) | " + String(deviceId || "")
                    font.pixelSize: 11
                    font.family: "Poppins"
                    width: parent.width
                    elide: Text.ElideRight
                }
            }

            Item {
                width: 90
                height: 30
                anchors.right: parent.right
                anchors.rightMargin: 12
                anchors.verticalCenter: parent.verticalCenter

                Rectangle {
                    anchors.fill: parent
                    color: "#15803d"
                    radius: 3
                }

                ToolButton {
                    anchors.fill: parent
                    text: "Restore"
                    font.family: "Poppins"
                    font.bold: true
                    onClicked: {
                        discovery.restoreDevice(String(deviceId || ""))
                        lastInactiveDevicesSignature = ""
                        refreshUi()
                    }
                }
            }
        }
    }

    Flickable {
        anchors.fill: parent
        contentHeight: mainColumn.height + 20
        clip: true

        ScrollBar.vertical: ScrollBar {
            width: 10
            visible: parent.height < parent.contentHeight
            policy: ScrollBar.AsNeeded
            contentItem: Rectangle {
                radius: parent.width / 2
                color: theme.scrollBar
            }
        }

        Column {
            id: mainColumn
            width: parent.width - 20
            spacing: 12

            Text {
                color: theme.primarytextcolor
                text: "OpenRGB Bridge adds OpenRGB SDK devices to SignalRGB and streams the current SignalRGB canvas directly to them."
                font.pixelSize: 16
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            Text {
                color: theme.secondarytextcolor
                text: "Start OpenRGB, enable Settings > General Settings > Start Server, then use Connect / Refresh to load the current OpenRGB device list. Rescan OpenRGB asks OpenRGB to detect hardware again and should only be used after hardware/layout changes."
                font.pixelSize: 13
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            Rectangle {
                width: parent.width
                height: 1
                color: "#444444"
            }

            Text {
                color: theme.primarytextcolor
                text: "OpenRGB SDK Server"
                font.pixelSize: 15
                font.family: "Poppins"
                font.bold: true
                width: parent.width
                wrapMode: Text.WordWrap
            }

            Row {
                spacing: 6

                Rectangle {
                    width: 220
                    height: 32
                    radius: 3
                    border.color: "#444444"
                    border.width: 2
                    color: "#141414"

                    TextField {
                        id: sdkServerIP
                        width: parent.width - 20
                        x: 10
                        y: -4
                        color: theme.primarytextcolor
                        font.family: "Poppins"
                        font.bold: true
                        font.pixelSize: 16
                        verticalAlignment: TextInput.AlignVCenter
                        placeholderText: "127.0.0.1"
                        validator: RegularExpressionValidator {
                            regularExpression: /^((?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.){0,3}(?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/
                        }
                        onTextEdited: saveSettings()
                        background: Item {}
                    }
                }

                Rectangle {
                    width: 140
                    height: 32
                    radius: 3
                    border.color: "#444444"
                    border.width: 2
                    color: "#141414"

                    TextField {
                        id: sdkServerPort
                        width: parent.width - 20
                        x: 10
                        y: -4
                        color: theme.primarytextcolor
                        font.family: "Poppins"
                        font.bold: true
                        font.pixelSize: 16
                        verticalAlignment: TextInput.AlignVCenter
                        placeholderText: "6742"
                        validator: RegularExpressionValidator {
                            regularExpression: /^([0-9]{1,5})$/
                        }
                        onTextEdited: saveSettings()
                        background: Item {}
                    }
                }

                Item {
                    width: 170
                    height: 32

                    Rectangle {
                        anchors.fill: parent
                        color: "#15803d"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        text: "Connect / Refresh"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: refreshDevices()
                    }
                }

                Item {
                    width: 150
                    height: 32

                    Rectangle {
                        anchors.fill: parent
                        color: "#1d4ed8"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        text: "Rescan OpenRGB"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.rescan()
                            refreshUi()
                        }
                    }
                }
            }

            Text {
                width: parent.width
                color: theme.secondarytextcolor
                text: "Status: " + statusText
                font.pixelSize: 12
                font.family: "Poppins"
                wrapMode: Text.WordWrap
            }

            Item {
                width: parent.width
                height: 34

                Text {
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    color: theme.primarytextcolor
                    text: "Devices (" + controllerCount + ")"
                    font.pixelSize: 15
                    font.family: "Poppins"
                    font.bold: true
                    width: 200
                    wrapMode: Text.WordWrap
                }

                Item {
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    width: 130
                    height: 30

                    Rectangle {
                        anchors.fill: parent
                        color: "#900000"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        text: "Delete All"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.removeAllDevices()
                            refreshUi()
                        }
                    }
                }
            }

            Text {
                visible: controllerCount === 0
                color: theme.secondarytextcolor
                text: "No active OpenRGB devices. Click Connect / Refresh after starting the OpenRGB SDK server, or restore a deleted device below."
                font.pixelSize: 13
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            ListView {
                id: controllerList
                model: service.controllers
                width: parent.width
                height: count * 70
                interactive: false
                clip: false
                spacing: 8
                onCountChanged: {
                    controllerCount = count
                    logUi("OpenRGB Bridge UI controller model has " + count + " row(s).")
                }

                delegate: Rectangle {
                    id: deviceRow
                    property var openRgbController: model.modelData.obj

                    width: controllerList.width
                    height: 62
                    radius: 4
                    color: "#212d3a"
                    border.color: "#2e3f4f"
                    border.width: 1

                    Image {
                        x: 12
                        y: 13
                        width: 36
                        height: 36
                        source: String(openRgbController.image || "")
                        fillMode: Image.PreserveAspectFit
                        smooth: true
                    }

                    Column {
                        x: 60
                        y: 7
                        width: parent.width - 220
                        spacing: 2

                        Text {
                            color: "white"
                            text: String(openRgbController.name || "OpenRGB Device")
                            font.pixelSize: 15
                            font.family: "Poppins"
                            font.bold: true
                            width: parent.width
                            elide: Text.ElideRight
                        }

                        Text {
                            color: "#cbd5e1"
                            text: (openRgbController.vendor ? String(openRgbController.vendor) + " | " : "") + "Index " + Number(openRgbController.openrgbIndex || 0) + " | " + Number(openRgbController.leds ? openRgbController.leds.length : 0) + " LEDs | " + Number(openRgbController.zones ? openRgbController.zones.length : 0) + " zone(s) | " + String(openRgbController.deviceId || openRgbController.id || "")
                            font.pixelSize: 11
                            font.family: "Poppins"
                            width: parent.width
                            elide: Text.ElideRight
                        }
                    }

                    Item {
                        width: 90
                        height: 30
                        anchors.right: parent.right
                        anchors.rightMargin: 12
                        anchors.verticalCenter: parent.verticalCenter

                        Rectangle {
                            anchors.fill: parent
                            color: "#900000"
                            radius: 3
                        }

                        ToolButton {
                            anchors.fill: parent
                            text: "Delete"
                            font.family: "Poppins"
                            font.bold: true
                            onClicked: {
                                discovery.removeDevice(String(openRgbController.deviceId || openRgbController.id || ""))
                                refreshUi()
                            }
                        }
                    }
                }
            }

            Item {
                width: parent.width
                height: 34

                Text {
                    anchors.left: parent.left
                    anchors.verticalCenter: parent.verticalCenter
                    color: theme.primarytextcolor
                    text: "Deleted Devices (" + disabledDeviceCount + ")"
                    font.pixelSize: 15
                    font.family: "Poppins"
                    font.bold: true
                    width: 260
                    wrapMode: Text.WordWrap
                }

                Item {
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    width: 130
                    height: 30

                    Rectangle {
                        anchors.fill: parent
                        color: "#15803d"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        text: "Restore All"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.restoreAllDevices()
                            lastInactiveDevicesSignature = ""
                            refreshUi()
                        }
                    }
                }
            }

            Text {
                visible: disabledDeviceCount === 0
                color: theme.secondarytextcolor
                text: "No deleted OpenRGB devices."
                font.pixelSize: 13
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            Column {
                id: inactiveDeviceListColumn
                width: parent.width
                spacing: 8
            }
        }
    }
}
