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
            text : 'To make this plugin work make sure you have OpenRGB installed and running on your system. You can download it from the <html><a href="https://openrgb.org/">official website</a></html>. Don\'t forget to start the SDK server by goind to the SDK server tab and clicking on "Start Server". Then under The Settings tab in "General Settings" make sure to enable "Start at login", "Start Minimized" and "Start Server". And make sure the deevice you want to controll is supported by OpenRGB and that it\'s control mode is set to Direct.'
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
            text : 'Then after everything is up and running you can connect to the OpenRGB SDK server by entering the Ip and the Port displayed in the OpenRGB SDK server tab (it should be "127.0.0.1" and "9730" by default) and clicking on "Connect". Then you can select the devices you want to control that are not directly supported by SignalRGB. Thoses devices will be synced with your current layout and effects and will automatically be added on signalRGB startup.'
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
                    if (checked)
                    {
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
                            regularExpression : /^([0-9]{1, 4})$/
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
                    regularExpression : /^((?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.){0, 3}(?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/
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
                    regularExpression : /^([0-9]{1, 4})$/
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
            width : 90
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
                    const sdkport = sdkServerPort
                    .text
                    if (useCustomPort.checked)
                    {
                        const customport = customPortContainer
                        .item
                        .children[0
                    ]
                    .text
                    if (customport.length > 0)
                    {
                        xhr.open("GET", `http://localhost:${customport}/connect?host=${sdkhost}&port=${sdkport}`, true)
                        xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200)
                        {

                            if (xhr.responseText != "[]")
                            {
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

            xhr
            .open("GET", `http://localhost:9730/connect?host=${sdkhost}&port=${sdkport}`, true)
            xhr
            .onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200)
            {
                if (xhr.responseText != "[]")
                {
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
                                parent.color = "#212d3a";
                                selectedDevices.splice(i, 1);
                                service.saveSetting("General", "SelectedDevices", JSON.stringify(selectedDevices))

                                discovery.updateDevices(selectedDevices);
                                return
                            }
                        }
                        selectedDevices.push(modelData)
                        parent.color = "#209e20"
                        service.saveSetting("General", "SelectedDevices", JSON.stringify(selectedDevices))
                    }

                    discovery.updateDevices(selectedDevices);
                }


            }
        }
    }
}
}
}
