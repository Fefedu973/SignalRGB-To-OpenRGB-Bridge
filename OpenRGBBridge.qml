Item {
    anchors.fill: parent

    property string statusText: "Idle"
    property int controllerCount: 0

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
                    width: 180
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
                    text: "Devices (" + controllerCount + ")"
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
                visible: controllerCount === 0
                color: theme.secondarytextcolor
                text: "No OpenRGB devices loaded yet. Click Connect / Refresh after starting the OpenRGB SDK server."
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

                    Column {
                        x: 12
                        y: 7
                        width: parent.width - 160
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
        }
    }
}
