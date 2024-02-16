Item {
    anchors.fill : parent
    property var selectedDevices: []
    property var deviceList: []
    Component.onCompleted: {
    useCustomPort.checked = service.getSetting("General", "UseCustomPort") === "true"
    customPortContainer.active = useCustomPort.checked
    selectedDevices = JSON.parse(service.getSetting("General", "SelectedDevices")) || []
    if (useCustomPort.checked)
    {
        customPortContainer.item.children[0].text = service.getSetting("General", "CustomPort") || "9730"
    }
    sdkServerIP.text = service.getSetting("General", "SDKServerIP") || "127.0.0.1"
    sdkServerPort.text = service.getSetting("General", "SDKServerPort") || "6742"
    if (sdkServerIP.text !== "" && sdkServerPort.text !== "")
    {
        connectButton.clicked();
    }
}
Connections {
    target: useCustomPort
    function onCheckedChanged()
    {
        service.saveSetting("General", "UseCustomPort", useCustomPort.checked.toString())
        if (useCustomPort.checked)
        {
            customPortContainer.item.children[0].onTextEdited.connect(onCustomPortTextEdited)
        }
    }
}
function onCustomPortTextEdited()
{
    if (useCustomPort.checked)
    {
        service.saveSetting("General", "CustomPort", customPortContainer.item.children[0].text)
    }
}
Connections {
    target : sdkServerIP
    function onTextEdited()
    {
        service.saveSetting("General", "SDKServerIP", sdkServerIP.text)
    }
}

Connections {
    target : sdkServerPort
    function onTextEdited()
    {
        service.saveSetting("General", "SDKServerPort", sdkServerPort.text)
    }
}
    Flickable {
        anchors.fill: parent
        contentHeight: headerColumn.height

        		ScrollBar.vertical: ScrollBar {
			id: controllerListScrollBar
			anchors.right: parent.right
			width: 10
			visible: true //parent.height < parent.contentHeight
			policy: ScrollBar.AlwaysOn
			height: parent.availableHeight
			contentItem: Rectangle {
				radius: parent.width / 2
				color: theme.scrollBar
			}
		}
Column {
    id : headerColumn
    y : 0
    width : parent.width - 20
    spacing : 0
    Text {
        color : theme.primarytextcolor
        text : "This plugin allows you to control devices that may be supported by OpenRGB but not by SignalRGB right now and sync them with your current layout and effects."
        font.pixelSize : 16
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
    }
    Text {
        color : theme.primarytextcolor
        text : 'To make this plugin work make sure you have OpenRGB installed and running on your system. You can download it from the <html><a href="https://openrgb.org/">official website</a></html>. Don\'t forget to start the SDK server by goind to the SDK server tab and clicking on "Start Server". Then under The Settings tab in "General Settings" make sure to enable "Start at login", "Start Minimized" and "Start Server". And make sure the device you want to controll is supported by OpenRGB. For further led position customization you can install the OpenRGB Visual Map Plugin and use it to customize the led position in 2d space to match the real position of your leds of your devices.'
        font.pixelSize : 13
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
        onLinkActivated : Qt.openUrlExternally('https://openrgb.org')
    }
    Text {
        color : theme.primarytextcolor
        text : 'You also need to download an intermediate server binary <html><a href="https://github.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge">here</a></html> or if you prefer install node.js and download the bare node.js file and run it using the following command: "node server.js." If you use the EXE file it will be automatically runned on windows startup the next time (you can disable this behavior by adding "--no-startup" to the filename)."'
        font.pixelSize : 13
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
        onLinkActivated : Qt.openUrlExternally('https://github.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge')
    }
    Text {
        color : theme.primarytextcolor
        text : 'The intermediate server will be running on port 9730 by default, if you want to change the port you can do that by modifying the server.js file directly or by renameing your js/exe file by adding "--port=${THE PORT YOU WANT}" depending on what file you picked. You can also show the console window if you want by adding "--console" to the filename. And then don\'t forget to tick the "Use a custom port for the intermediate server" checkbox and enter the port you choosed in the input that will appear.'
        font.pixelSize : 13
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
    }
    Text {
        color : theme.primarytextcolor
        text : 'Then after everything is up and running you can connect to the OpenRGB SDK server by entering the Ip and the Port displayed in the OpenRGB SDK server tab (it should be "127.0.0.1" and "9730" by default) and clicking on "Connect". Then you can select the devices you want to control that are not directly supported by SignalRGB. Thoses devices will be synced with your current layout and effects and will automatically be added on next signalRGB startup.'
        font.pixelSize : 13
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
    }
        Text {
        color : theme.primarytextcolor
        text : 'Make sure to configure averything in OpenRGB before connecting your devices. If new devices are discovered/added or if their order is modified in OpenRGB in the future you will need to reconnect to Click on the "Delete All" button to remove all the devices and reconnect each device one by one to make them work again.'
        
        font.pixelSize : 13
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
    }
    Text {
        color : theme.primarytextcolor
        text : 'Use a custom port for the intermediate server (default is 9730):'
        font.pixelSize : 15
        font.family : "Poppins"
        font.bold : true
        topPadding : 10
        width : parent.width
        wrapMode : Text.WordWrap
    }
    Row {
        bottomPadding : 10
        spacing : 5
        CheckBox {
            id : useCustomPort
            checked : false
            onCheckedChanged: {
                if (checked) {
                customPortContainer.active = true
            } else {
            customPortContainer.active = false
        }
    }
}
Loader {
    id : customPortContainer
    active : false
    sourceComponent : Component {
        Rectangle {
            x : 0
            y : 9
            width : 60
            height : 30
            radius : 2
            border.color : "#444444"
            border.width : 2
            color : "#141414"
            id : customPort
            TextField {
                width : 50
                leftPadding : 0
                rightPadding : 10
                x : 10
                y : -5
                color : theme.primarytextcolor
                font.family : "Poppins"
                font.bold : true
                font.pixelSize : 16
                verticalAlignment : TextInput.AlignVCenter
                placeholderText : "9730"
                validator : RegularExpressionValidator {
                    regularExpression : /^([0-9]{1,4})$/
                }
                background : Item {
                    width : parent.width
                    height : parent.height
                    Rectangle {
                        color : "transparent"
                        height : 1
                        width : parent.width
                        anchors.bottom : parent.bottom
                    }
                }
            }
        }
    }
}
}
Rectangle {
    width : parent.width
    height : 1
    color : "#444444"
}
Row {
    topPadding : 20
    spacing : 5
    Rectangle {
        x : 0
        y : 0
        width : 200
        height : 30
        radius : 2
        border.color : "#444444"
        border.width : 2
        color : "#141414"
        TextField {
            width : 180
            leftPadding : 0
            rightPadding : 10
            id : sdkServerIP
            x : 10
            y : -5
            color : theme.primarytextcolor
            font.family : "Poppins"
            font.bold : true
            font.pixelSize : 16
            verticalAlignment : TextInput.AlignVCenter
            placeholderText : "SDK Server IP"
            validator : RegularExpressionValidator {
                regularExpression : /^((?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.){0,3}(?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/
            }
            background : Item {
                width : parent.width
                height : parent.height
                Rectangle {
                    color : "transparent"
                    height : 1
                    width : parent.width
                    anchors.bottom : parent.bottom
                }
            }
        }
    }
    Rectangle {
        x : 0
        y : 0
        width : 60
        height : 30
        radius : 2
        border.color : "#444444"
        border.width : 2
        color : "#141414"
        TextField {
            width : 50
            leftPadding : 0
            rightPadding : 10
            id : sdkServerPort
            x : 10
            y : -5
            color : theme.primarytextcolor
            font.family : "Poppins"
            font.bold : true
            font.pixelSize : 16
            verticalAlignment : TextInput.AlignVCenter
            placeholderText : "Port"
            validator : RegularExpressionValidator {
                regularExpression : /^([0-9]{1,4})$/
            }
            background : Item {
                width : parent.width
                height : parent.height
                Rectangle {
                    color : "transparent"
                    height : 1
                    width : parent.width
                    anchors.bottom : parent.bottom
                }
            }
        }
    }
    Item {
        Rectangle {
            width : 130
            height : 30
            color : "#009000"
            radius : 2
        }
        width : 135
        height : 30
        ToolButton {
            id: connectButton
            height : 30
            width : 130
            anchors.verticalCenter : parent.verticalCenter
            font.family : "Poppins"
            font.bold : true
            icon.source : "data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAV0lEQVQ4jWP8//8/A0UAnwH///3r+P/vXwdevQQMuPv/37+7+AxgItaluMAwMIARGpIdDAwMoVjklaD0PSxyqxkYGSsodsFoNFLBABYC8qsJGcBIaXYGAFjoNxCMz3axAAAAAElFTkSuQmCC"
            text : "Connect"
            anchors.right : parent.center
            onClicked: {
                deviceList = []
                deviceRepeater.model = deviceList
                const xhr = new XMLHttpRequest()
                const sdkhost = sdkServerIP.text
                const sdkport = sdkServerPort.text
                if (useCustomPort.checked)
                {
                    const customport = customPortContainer.item.children[0].text
                    if (customport.length > 0)
                    {
                        xhr.open("GET", `http://localhost:${customport}/connect?host=${sdkhost}&port=${sdkport}`, true)
                        xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200)
                        {
                            if (xhr.responseText != "[]") {
                            let res = JSON.parse(xhr.responseText)
                            deviceList = res
                            deviceRepeater.model = deviceList
                            selectedDevices = JSON.parse(service.getSetting("General", "SelectedDevices")) || []
                            if (selectedDevices.length > 0)
                            {
                                for (var i = 0; i < deviceRepeater.count; i++) {
                                    for (var j = 0; j < selectedDevices.length; j++) {
                                        if (deviceRepeater.itemAt(i).deviceId == selectedDevices[j].deviceId)
                                        {
                                            deviceRepeater.itemAt(i).color = "#209e20"
                                        }
                                    }
                                }
                            }
                            service.log(selectedDevices)
                            discovery.connect(selectedDevices)
                        }
                    }
                }
                xhr.send()
                return
            }
        }
        xhr.open("GET", `http://localhost:9730/connect?host=${sdkhost}&port=${sdkport}`, true)
        xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200)
        {
            if (xhr.responseText != "[]") {
            let res = JSON.parse(xhr.responseText)
            deviceList = res
            deviceRepeater.model = deviceList
            selectedDevices = JSON.parse(service.getSetting("General", "SelectedDevices")) || []
            if (selectedDevices.length > 0)
            {
                for (var i = 0; i < deviceRepeater.count; i++) {
                    for (var j = 0; j < selectedDevices.length; j++) {
                        if (deviceRepeater.itemAt(i).deviceId == selectedDevices[j].deviceId)
                        {
                            deviceRepeater.itemAt(i).color = "#209e20"
                        }
                    }
                }
            }
            service.log(selectedDevices)
            discovery.connect(selectedDevices)
        }
    }
}
xhr.send()
}
}
}
//add a red button to delete all the
Item {
    Rectangle {
        width : 130
        height : 30
        color : "#900000"
        radius : 2
    }
    width : 90
    height : 30
    ToolButton {
        id: deleteAllButton
        height : 30
        width : 130
        anchors.verticalCenter : parent.verticalCenter
        font.family : "Poppins"
        font.bold : true
        icon.source : "data:image/png;base64,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"
        text : "Delete All"
        anchors.right : parent.center
        onClicked: {
            //delete all the selected devices update the discovery and update the repeater
        for (var i = 0; i < deviceRepeater.count; i++) {
                service.log(deviceRepeater.itemAt(i).deviceId)
                discovery.removedDevices(deviceRepeater.itemAt(i).deviceId)
            }
            selectedDevices = []
            service.saveSetting("General", "SelectedDevices", JSON.stringify(selectedDevices))
            deviceList = []
            deviceRepeater.model = deviceList
            //click the connect button to update the device list
            connectButton.clicked()
        }
    }
}
}
Column {
    width : 200
    spacing : 5
    topPadding : 10
    
    Text {
        id: test
        color : theme.primarytextcolor
        text : "Select the devices you want to control"
        font.pixelSize : 16
        font.family : "Poppins"
        font.bold : false
        bottomPadding : 10
        width : 400
        wrapMode : Text.WordWrap
    }
    Repeater {
        id : deviceRepeater
        model : deviceList
        Rectangle {
            width : 400
            height : 30
            color : "#212d3a"
            radius : 2
            property var deviceId: modelData.deviceId
                Text {
                    anchors.centerIn : parent
                    rightPadding : 10
                    leftPadding : 10
                    color : "white"
                    text : modelData.name
                    font.pixelSize : 16
                    font.family : "Poppins"
                    font.bold : true
                    width : parent.width
                    elide : Text.ElideRight
                }
                MouseArea {
                    anchors.fill : parent
                    cursorShape : Qt.PointingHandCursor
                    hoverEnabled : true
                    onEntered: {
                        if (parent.color == "#212d3a")
                        {
                            parent.color = "#2e3f4f"
                        }
                    }
                    onExited: {
                        if (parent.color == "#2e3f4f")
                        {
                            parent.color = "#212d3a"
                        }
                    }
                    onClicked: {
                        selectedDevices = JSON.parse(service.getSetting("General", "SelectedDevices")) || []
                        if (selectedDevices.length == 0)
                        {
                            selectedDevices.push(modelData)
                            parent.color = "#209e20"
                            service.saveSetting("General", "SelectedDevices", JSON.stringify(selectedDevices))
                        } else {
                        for (var i = 0; i < selectedDevices.length; i++) {
                            if (selectedDevices[i].deviceId === modelData.deviceId)
                            {
                                let deviceIdToRemove = modelData.deviceId
                                parent.color = "#212d3a";
                                selectedDevices.splice(i, 1);
                                service.saveSetting("General", "SelectedDevices", JSON.stringify(selectedDevices))

                                discovery.removedDevices(deviceIdToRemove);
                                return
                            }
                        }
                        selectedDevices.push(modelData)
                        parent.color = "#209e20"
                        service.saveSetting("General", "SelectedDevices", JSON.stringify(selectedDevices))
                    }
                    discovery.connect(selectedDevices);
                }
            }
        }
    }
}
}
}
}