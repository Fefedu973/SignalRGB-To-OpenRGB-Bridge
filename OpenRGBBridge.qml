Item {
    anchors.fill: parent

    property string statusText: "Connecting..."
    property bool busy: false
    // Best-effort counts computed from service.controllers. -1 means "unknown"
    // (iteration unsupported); the lists themselves never depend on these.
    property int activeCount: 0
    property int deletedCount: 0

    function logUi(message) {
        try {
            if (discovery && discovery.logUi) {
                discovery.logUi(message)
            }
        } catch (e) {
        }
    }

    function readStatus() {
        // Prefer service.getSetting because SignalRGB's QML bridge can cache the
        // return value of discovery.getStatus(); the setting store always reflects
        // the latest write from JS setStatus.
        try {
            var fromSetting = service.getSetting("General", "Status")
            if (fromSetting !== undefined && fromSetting !== null && String(fromSetting) !== "") {
                return String(fromSetting)
            }
        } catch (e) {
        }
        try {
            var value = discovery.getStatus()
            return value === undefined || value === null || value === "" ? "Connecting..." : String(value)
        } catch (e) {
            return "Connecting..."
        }
    }

    function readBusy() {
        try {
            return !!discovery.isBusy()
        } catch (e) {
            return false
        }
    }

    // Both device lists are filtered views of SignalRGB's reactive service.controllers
    // collection (the only reliable QML data channel). Counts are derived the same way.
    function recountControllers() {
        var active = 0
        var deleted = 0
        try {
            var controllers = service.controllers
            for (var i = 0; i < controllers.length; i++) {
                var obj = controllers[i] ? controllers[i].obj : null
                if (!obj) {
                    continue
                }
                if (obj.bridgeDeleted) {
                    deleted++
                } else {
                    active++
                }
            }
            activeCount = active
            deletedCount = deleted
        } catch (e) {
            activeCount = -1
            deletedCount = -1
        }
    }

    function refreshStatusOnly() {
        statusText = readStatus()
        busy = readBusy()
        recountControllers()
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
        refreshStatusOnly()
    }

    function deleteDevice(deviceId) {
        discovery.removeDevice(String(deviceId || ""))
        refreshStatusOnly()
    }

    function restoreDevice(deviceId) {
        discovery.restoreDevice(String(deviceId || ""))
        refreshStatusOnly()
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
        interval: 250
        running: true
        repeat: true
        onTriggered: refreshStatusOnly()
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
                            refreshStatusOnly()
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
                            refreshStatusOnly()
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
                model: service.controllers
                width: parent.width
                height: contentHeight
                interactive: false
                clip: false
                spacing: 0

                delegate: Item {
                    property var ctrl: model.modelData.obj
                    property bool isActive: ctrl ? !ctrl.bridgeDeleted : false

                    width: activeDeviceList.width
                    height: isActive ? 70 : 0
                    visible: isActive

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
                            source: ctrl ? String(ctrl.icon || ctrl.image || "") : ""
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
                                text: ctrl ? String(ctrl.name || "OpenRGB Device") : ""
                                font.pixelSize: 15
                                font.family: "Poppins"
                                font.bold: true
                                width: parent.width
                                elide: Text.ElideRight
                            }

                            Text {
                                color: "#cbd5e1"
                                text: ctrl ? ((ctrl.vendor ? ctrl.vendor + " | " : "") + "Index " + Number(ctrl.openrgbIndex || 0) + " | " + Number(ctrl.ledCount || 0) + " LEDs | " + Number(ctrl.zoneCount || 0) + " zone(s) | " + String(ctrl.deviceId || "")) : ""
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
                                onClicked: deleteDevice(ctrl ? (ctrl.deviceId || ctrl.id) : "")
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
                            refreshStatusOnly()
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
                model: service.controllers
                width: parent.width
                height: contentHeight
                interactive: false
                clip: false
                spacing: 0

                delegate: Item {
                    property var ctrl: model.modelData.obj
                    property bool isDeleted: ctrl ? !!ctrl.bridgeDeleted : false

                    width: deletedDeviceList.width
                    height: isDeleted ? 70 : 0
                    visible: isDeleted

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
                            source: ctrl ? String(ctrl.icon || ctrl.image || "") : ""
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
                                text: ctrl ? String(ctrl.name || "OpenRGB Device") : ""
                                font.pixelSize: 15
                                font.family: "Poppins"
                                font.bold: true
                                width: parent.width
                                elide: Text.ElideRight
                            }

                            Text {
                                color: "#94a3b8"
                                text: ctrl ? ((ctrl.vendor ? ctrl.vendor + " | " : "") + "Index " + Number(ctrl.openrgbIndex || 0) + " | " + Number(ctrl.ledCount || 0) + " LEDs | " + Number(ctrl.zoneCount || 0) + " zone(s) | " + String(ctrl.deviceId || "")) : ""
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
                                onClicked: restoreDevice(ctrl ? (ctrl.deviceId || ctrl.id) : "")
                            }
                        }
                    }
                }
            }
        }
    }
}
