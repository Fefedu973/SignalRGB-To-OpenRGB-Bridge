Item {
    anchors.fill: parent

    property string statusText: "Idle"
    property int activeCount: 0
    property int deletedCount: 0
    property int lastRevision: -1
    property bool busy: false
    property string lastParseError: ""

    function logUi(message) {
        try {
            if (discovery && discovery.logUi) {
                discovery.logUi(message)
            }
        } catch (e) {
        }
    }

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
                logUi("Failed to parse OpenRGB Bridge device list: " + message)
            }
            return fallback
        }
    }

    function readStatus() {
        try {
            var value = discovery.getStatus()
            return value === undefined || value === null || value === "" ? "Idle" : String(value)
        } catch (e) {
            return "Idle"
        }
    }

    function readRevision() {
        try {
            return Number(discovery.getRevision() || 0)
        } catch (e) {
            return 0
        }
    }

    function readBusy() {
        try {
            return !!discovery.isBusy()
        } catch (e) {
            return false
        }
    }

    function readActiveDevicesJson() {
        try {
            return String(discovery.getActiveDevicesJson() || "[]")
        } catch (e) {
            logUi("Failed to read active OpenRGB devices: " + String(e))
            return "[]"
        }
    }

    function readDeletedDevicesJson() {
        try {
            return String(discovery.getDeletedDevicesJson() || "[]")
        } catch (e) {
            logUi("Failed to read deleted OpenRGB devices: " + String(e))
            return "[]"
        }
    }

    function appendDeviceRows(model, devices) {
        model.clear()
        for (var i = 0; i < devices.length; i++) {
            var item = devices[i] || {}
            var deviceId = String(item.deviceId || "")
            if (deviceId === "") {
                continue
            }

            model.append({
                "deviceId": deviceId,
                "name": String(item.name || "OpenRGB Device"),
                "vendor": String(item.vendor || ""),
                "openrgbIndex": Number(item.openrgbIndex || 0),
                "ledCount": Number(item.ledCount || 0),
                "zoneCount": Number(item.zoneCount || 0),
                "iconSource": String(item.icon || item.image || "")
            })
        }
    }

    function refreshDeviceLists(force) {
        var revision = readRevision()
        if (!force && revision === lastRevision) {
            statusText = readStatus()
            busy = readBusy()
            return
        }

        appendDeviceRows(activeDeviceModel, safeJsonParse(readActiveDevicesJson(), []))
        appendDeviceRows(deletedDeviceModel, safeJsonParse(readDeletedDevicesJson(), []))
        activeCount = activeDeviceModel.count
        deletedCount = deletedDeviceModel.count
        statusText = readStatus()
        busy = readBusy()
        lastRevision = revision
        logUi("OpenRGB Bridge UI active model has " + activeCount + " row(s); deleted model has " + deletedCount + " row(s).")
    }

    function refreshStatusOnly() {
        statusText = readStatus()
        busy = readBusy()
        lastRevision = readRevision()
    }

    function loadSettings() {
        sdkServerIP.text = String(discovery.getHost() || "127.0.0.1")
        sdkServerPort.text = String(discovery.getPort() || "6742")
    }

    function saveSettings() {
        discovery.saveConnectionSettings(sdkServerIP.text, sdkServerPort.text)
    }

    function refreshDevices() {
        saveSettings()
        statusText = "Connect / Refresh clicked. Connecting to " + sdkServerIP.text + ":" + sdkServerPort.text + "..."
        logUi("Connect / Refresh clicked for OpenRGB at " + sdkServerIP.text + ":" + sdkServerPort.text + ".")
        discovery.refresh(sdkServerIP.text, sdkServerPort.text)
        refreshStatusOnly()
    }

    function deleteDevice(deviceId) {
        discovery.removeDevice(String(deviceId || ""))
        refreshDeviceLists(true)
    }

    function restoreDevice(deviceId) {
        discovery.restoreDevice(String(deviceId || ""))
        refreshDeviceLists(true)
    }

    Component.onCompleted: {
        loadSettings()
        discovery.connectSelectedDevices()
        refreshDeviceLists(true)
        refreshDevices()
    }

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: refreshDeviceLists(false)
    }

    ListModel {
        id: activeDeviceModel
    }

    ListModel {
        id: deletedDeviceModel
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
                    opacity: busy ? 0.55 : 1

                    Rectangle {
                        anchors.fill: parent
                        color: "#15803d"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        enabled: !busy
                        text: "Connect / Refresh"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: refreshDevices()
                    }
                }

                Item {
                    width: 150
                    height: 32
                    opacity: busy ? 0.55 : 1

                    Rectangle {
                        anchors.fill: parent
                        color: "#1d4ed8"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        enabled: !busy
                        text: "Rescan OpenRGB"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.rescan()
                            refreshDeviceLists(true)
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
                    text: "Devices (" + activeDeviceModel.count + ")"
                    font.pixelSize: 15
                    font.family: "Poppins"
                    font.bold: true
                    width: 220
                    wrapMode: Text.WordWrap
                }

                Item {
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    width: 130
                    height: 30
                    opacity: busy || activeDeviceModel.count === 0 ? 0.55 : 1

                    Rectangle {
                        anchors.fill: parent
                        color: "#900000"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        enabled: !busy && activeDeviceModel.count > 0
                        text: "Delete All"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.removeAllDevices()
                            refreshDeviceLists(true)
                        }
                    }
                }
            }

            Text {
                visible: activeDeviceModel.count === 0
                color: theme.secondarytextcolor
                text: "No active OpenRGB devices. Click Connect / Refresh after starting the OpenRGB SDK server, or restore a deleted device below."
                font.pixelSize: 13
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            ListView {
                id: activeDeviceList
                model: activeDeviceModel
                width: parent.width
                height: count * 70
                interactive: false
                clip: false
                spacing: 8

                delegate: Rectangle {
                    property string rowDeviceId: String(deviceId || "")
                    property string rowName: String(name || "OpenRGB Device")
                    property string rowVendor: String(vendor || "")
                    property int rowOpenRgbIndex: Number(openrgbIndex || 0)
                    property int rowLedCount: Number(ledCount || 0)
                    property int rowZoneCount: Number(zoneCount || 0)
                    property string rowIconSource: String(iconSource || "")

                    width: activeDeviceList.width
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
                        source: rowIconSource
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
                            text: rowName
                            font.pixelSize: 15
                            font.family: "Poppins"
                            font.bold: true
                            width: parent.width
                            elide: Text.ElideRight
                        }

                        Text {
                            color: "#cbd5e1"
                            text: (rowVendor ? rowVendor + " | " : "") + "Index " + rowOpenRgbIndex + " | " + rowLedCount + " LEDs | " + rowZoneCount + " zone(s) | " + rowDeviceId
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
                        opacity: busy ? 0.55 : 1

                        Rectangle {
                            anchors.fill: parent
                            color: "#900000"
                            radius: 3
                        }

                        ToolButton {
                            anchors.fill: parent
                            enabled: !busy
                            text: "Delete"
                            font.family: "Poppins"
                            font.bold: true
                            onClicked: deleteDevice(rowDeviceId)
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
                    text: "Deleted Devices (" + deletedDeviceModel.count + ")"
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
                    opacity: busy || deletedDeviceModel.count === 0 ? 0.55 : 1

                    Rectangle {
                        anchors.fill: parent
                        color: "#15803d"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        enabled: !busy && deletedDeviceModel.count > 0
                        text: "Restore All"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.restoreAllDevices()
                            refreshDeviceLists(true)
                        }
                    }
                }
            }

            Text {
                visible: deletedDeviceModel.count === 0
                color: theme.secondarytextcolor
                text: "No deleted OpenRGB devices."
                font.pixelSize: 13
                font.family: "Poppins"
                width: parent.width
                wrapMode: Text.WordWrap
            }

            ListView {
                id: deletedDeviceList
                model: deletedDeviceModel
                width: parent.width
                height: count * 70
                interactive: false
                clip: false
                spacing: 8

                delegate: Rectangle {
                    property string rowDeviceId: String(deviceId || "")
                    property string rowName: String(name || "OpenRGB Device")
                    property string rowVendor: String(vendor || "")
                    property int rowOpenRgbIndex: Number(openrgbIndex || 0)
                    property int rowLedCount: Number(ledCount || 0)
                    property int rowZoneCount: Number(zoneCount || 0)
                    property string rowIconSource: String(iconSource || "")

                    width: deletedDeviceList.width
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
                        source: rowIconSource
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
                            text: rowName
                            font.pixelSize: 15
                            font.family: "Poppins"
                            font.bold: true
                            width: parent.width
                            elide: Text.ElideRight
                        }

                        Text {
                            color: "#94a3b8"
                            text: (rowVendor ? rowVendor + " | " : "") + "Index " + rowOpenRgbIndex + " | " + rowLedCount + " LEDs | " + rowZoneCount + " zone(s) | " + rowDeviceId
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
                        opacity: busy ? 0.55 : 1

                        Rectangle {
                            anchors.fill: parent
                            color: "#15803d"
                            radius: 3
                        }

                        ToolButton {
                            anchors.fill: parent
                            enabled: !busy
                            text: "Restore"
                            font.family: "Poppins"
                            font.bold: true
                            onClicked: restoreDevice(rowDeviceId)
                        }
                    }
                }
            }
        }
    }
}
