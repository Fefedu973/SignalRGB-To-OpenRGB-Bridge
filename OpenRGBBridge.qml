Item {
    anchors.fill: parent

    readonly property string statusControllerId: "openrgb-bridge-status"
    property string statusText: "Connecting..."
    property bool busy: false
    property int activeCount: 0
    property int deletedCount: 0
    property string deviceCatalogJson: ""
    property int pollRevision: 0

    ListModel {
        id: activeDeviceModel
    }

    ListModel {
        id: deletedDeviceModel
    }

    function logUi(message) {
        try {
            if (discovery && discovery.logUi) {
                discovery.logUi(message)
            }
        } catch (e) {
        }
    }

    function updateDeviceModels(json) {
        json = String(json || "[]")
        if (json === deviceCatalogJson) {
            return
        }

        var devices = []
        try {
            devices = JSON.parse(json)
        } catch (e) {
            logUi("Failed to parse OpenRGB Bridge device catalogue: " + String(e))
            return
        }

        activeDeviceModel.clear()
        deletedDeviceModel.clear()
        for (var i = 0; i < devices.length; i++) {
            var item = devices[i] || {}
            var deviceId = String(item.deviceId || "")
            if (deviceId === "") {
                continue
            }

            var row = {
                "rowDeviceId": deviceId,
                "rowName": String(item.name || "OpenRGB Device"),
                "rowVendor": String(item.vendor || ""),
                "rowOpenrgbIndex": Number(item.openrgbIndex || 0),
                "rowLedCount": Number(item.ledCount || 0),
                "rowZoneCount": Number(item.zoneCount || 0),
                "rowIconSource": String(item.icon || item.image || "")
            }
            if (item.bridgeDeleted) {
                deletedDeviceModel.append(row)
            } else {
                activeDeviceModel.append(row)
            }
        }

        deviceCatalogJson = json
        activeCount = activeDeviceModel.count
        deletedCount = deletedDeviceModel.count
    }

    // Poll a cache-busted, atomic state snapshot. The stable status carrier below is
    // only a compatibility fallback and is never removed/re-added by the service.
    function refreshTransientState() {
        pollRevision++
        try {
            var liveState = JSON.parse(String(discovery.getUiState(pollRevision) || "{}"))
            if (String(liveState.pollToken || "") === String(pollRevision)) {
                if (String(liveState.status || "") !== "") {
                    statusText = String(liveState.status)
                }
                updateDeviceModels(String(liveState.devicesJson || "[]"))
                busy = !!liveState.busy
                return
            }
        } catch (e) {
        }

        var foundStatus = ""
        var foundDeviceCatalog = ""
        var haveStatusBus = false
        var statusBusBusy = false
        try {
            var controllers = service.controllers
            for (var i = 0; i < controllers.length; i++) {
                var obj = controllers[i] ? controllers[i].obj : null
                if (!obj) {
                    continue
                }
                if (String(obj.id || "") === statusControllerId || obj.bridgeStatusBus) {
                    haveStatusBus = true
                    foundStatus = String(obj.bridgeStatus || "")
                    foundDeviceCatalog = String(obj.bridgeDevicesJson || "[]")
                    statusBusBusy = !!obj.bridgeBusy
                }
            }
        } catch (e) {
            busy = readBusy()
            return
        }
        if (foundStatus !== "") {
            statusText = foundStatus
        }
        if (haveStatusBus) {
            updateDeviceModels(foundDeviceCatalog)
        }
        busy = haveStatusBus ? statusBusBusy : readBusy()
    }

    function readBusy() {
        try {
            return !!discovery.isBusy()
        } catch (e) {
            return false
        }
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
        statusText = "Connecting to OpenRGB at " + sdkServerIP.text + ":" + sdkServerPort.text + "..."
        logUi("Connect / Refresh clicked for OpenRGB at " + sdkServerIP.text + ":" + sdkServerPort.text + ".")
        discovery.refresh(sdkServerIP.text, sdkServerPort.text)
        refreshTransientState()
    }

    function deleteDevice(deviceId) {
        discovery.removeDevice(String(deviceId || ""))
        refreshTransientState()
    }

    function restoreDevice(deviceId) {
        discovery.restoreDevice(String(deviceId || ""))
        refreshTransientState()
    }

    function countLabel(value) {
        return value >= 0 ? " (" + value + ")" : ""
    }

    Component.onCompleted: {
        loadSettings()
        discovery.connectSelectedDevices()
        refreshDevices()
    }

    Timer {
        interval: 500
        running: true
        repeat: true
        onTriggered: refreshTransientState()
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
                            refreshTransientState()
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
                    text: "Devices" + countLabel(activeCount)
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
                    opacity: busy || activeCount === 0 ? 0.55 : 1

                    Rectangle {
                        anchors.fill: parent
                        color: "#900000"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        enabled: !busy && activeCount !== 0
                        text: "Delete All"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.removeAllDevices()
                            refreshTransientState()
                        }
                    }
                }
            }

            Text {
                visible: activeCount === 0
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
                height: contentHeight
                interactive: false
                clip: false
                spacing: 0

                delegate: Item {
                    width: activeDeviceList.width
                    height: 70

                    Rectangle {
                        width: parent.width
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
                            source: String(model.rowIconSource || "")
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
                                text: String(model.rowName || "OpenRGB Device")
                                font.pixelSize: 15
                                font.family: "Poppins"
                                font.bold: true
                                width: parent.width
                                elide: Text.ElideRight
                            }

                            Text {
                                color: "#cbd5e1"
                                text: (model.rowVendor ? model.rowVendor + " | " : "") + "Index " + Number(model.rowOpenrgbIndex || 0) + " | " + Number(model.rowLedCount || 0) + " LEDs | " + Number(model.rowZoneCount || 0) + " zone(s) | " + String(model.rowDeviceId || "")
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
                                onClicked: deleteDevice(model.rowDeviceId)
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
                    text: "Deleted Devices" + countLabel(deletedCount)
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
                    opacity: busy || deletedCount === 0 ? 0.55 : 1

                    Rectangle {
                        anchors.fill: parent
                        color: "#15803d"
                        radius: 3
                    }

                    ToolButton {
                        anchors.fill: parent
                        enabled: !busy && deletedCount !== 0
                        text: "Restore All"
                        font.family: "Poppins"
                        font.bold: true
                        onClicked: {
                            discovery.restoreAllDevices()
                            refreshTransientState()
                        }
                    }
                }
            }

            Text {
                visible: deletedCount === 0
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
                height: contentHeight
                interactive: false
                clip: false
                spacing: 0

                delegate: Item {
                    width: deletedDeviceList.width
                    height: 70

                    Rectangle {
                        width: parent.width
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
                            source: String(model.rowIconSource || "")
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
                                text: String(model.rowName || "OpenRGB Device")
                                font.pixelSize: 15
                                font.family: "Poppins"
                                font.bold: true
                                width: parent.width
                                elide: Text.ElideRight
                            }

                            Text {
                                color: "#94a3b8"
                                text: (model.rowVendor ? model.rowVendor + " | " : "") + "Index " + Number(model.rowOpenrgbIndex || 0) + " | " + Number(model.rowLedCount || 0) + " LEDs | " + Number(model.rowZoneCount || 0) + " zone(s) | " + String(model.rowDeviceId || "")
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
                                onClicked: restoreDevice(model.rowDeviceId)
                            }
                        }
                    }
                }
            }
        }
    }
}
