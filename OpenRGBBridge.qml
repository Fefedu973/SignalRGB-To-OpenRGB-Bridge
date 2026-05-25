Item {
    anchors.fill: parent

    property var availableDevices: []
    property var selectedDevices: []
    property string statusText: "Idle"
    property string lastDevicesJson: ""
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
                logUi("Failed to parse OpenRGB device list for UI: " + message)
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

    function refreshUi() {
        statusText = discovery.getStatus()
        var devicesJson = discovery.getAvailableDevicesJson()
        availableDevices = safeJsonParse(devicesJson, [])
        selectedDevices = safeJsonParse(discovery.getSelectedDeviceIdsJson(), [])

        if (devicesJson !== lastDevicesJson) {
            lastDevicesJson = devicesJson
            rebuildDeviceModel(availableDevices)
            logUi("OpenRGB Bridge UI loaded " + availableDevices.length + " device row(s).")
        }
    }

    function rebuildDeviceModel(devices) {
        deviceListModel.clear()
        for (var i = 0; i < devices.length; i++) {
            var item = devices[i] || {}
            deviceListModel.append({
                deviceId: String(item.deviceId || ""),
                name: String(item.name || "OpenRGB Device"),
                vendor: String(item.vendor || ""),
                description: String(item.description || ""),
                serial: String(item.serial || ""),
                location: String(item.location || ""),
                openrgbIndex: Number(item.openrgbIndex || 0),
                ledCount: Number(item.ledCount || 0),
                zoneCount: Number(item.zoneCount || 0)
            })
        }
    }

    function isSelected(deviceId) {
        for (var i = 0; i < selectedDevices.length; i++) {
            var item = selectedDevices[i]
            if (item === deviceId || (item && item.deviceId === deviceId)) {
                return true
            }
        }
        return false
    }

    function refreshDevices() {
        saveSettings()
        statusText = "Connect / Refresh clicked. Connecting to " + sdkServerIP.text + ":" + sdkServerPort.text + "..."
        logUi("Connect / Refresh clicked for OpenRGB at " + sdkServerIP.text + ":" + sdkServerPort.text + ".")
        discovery.refresh(sdkServerIP.text, sdkServerPort.text)
        refreshUi()
    }

    ListModel {
        id: deviceListModel
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
                    width: 130
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
            }

            Row {
                spacing: 6

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

            Rectangle {
                width: parent.width
                height: statusTextContainer.height + 18
                radius: 4
                color: "#18212b"

                Text {
                    id: statusTextContainer
                    x: 10
                    y: 9
                    width: parent.width - 20
                    color: theme.primarytextcolor
                    text: "Status: " + statusText
                    font.pixelSize: 13
                    font.family: "Poppins"
                    wrapMode: Text.WordWrap
                }
            }

            Row {
                spacing: 8

                Text {
                    color: theme.primarytextcolor
                    text: "Devices (" + deviceListModel.count + ")"
                    font.pixelSize: 15
                    font.family: "Poppins"
                    font.bold: true
                    width: 200
                    wrapMode: Text.WordWrap
                }

                Item {
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
                visible: deviceListModel.count === 0
                color: theme.secondarytextcolor
                text: "No OpenRGB devices loaded yet. Click Connect / Refresh after starting the OpenRGB SDK server."
                font.pixelSize: 13
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            Repeater {
                id: deviceRepeater
                model: deviceListModel

                Rectangle {
                    width: parent.width
                    height: 54
                    radius: 4
                    color: isSelected(deviceId) ? "#209e20" : "#212d3a"
                    border.color: "#2e3f4f"
                    border.width: 1

                    Column {
                        x: 12
                        y: 7
                        width: parent.width - 24
                        spacing: 2

                        Text {
                            color: "white"
                            text: name || "OpenRGB Device"
                            font.pixelSize: 15
                            font.family: "Poppins"
                            font.bold: true
                            width: parent.width
                            elide: Text.ElideRight
                        }

                        Text {
                            color: "#cbd5e1"
                            text: (vendor ? vendor + " | " : "") + "Index " + openrgbIndex + " | " + ledCount + " LEDs | " + zoneCount + " zone(s) | " + deviceId
                            font.pixelSize: 11
                            font.family: "Poppins"
                            width: parent.width
                            elide: Text.ElideRight
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        hoverEnabled: true
                        onEntered: parent.opacity = 0.85
                        onExited: parent.opacity = 1.0
                        onClicked: {
                            discovery.toggleDevice(deviceId)
                            refreshUi()
                        }
                    }
                }
            }
        }
    }
}
