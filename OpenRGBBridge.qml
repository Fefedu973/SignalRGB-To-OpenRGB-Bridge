Item {
	anchors.fill: parent

	Column {
		id: headerColumn
		y: 10
		width: parent.width - 20
		spacing: 0
		Text {
			color: theme.primarytextcolor
			text: "This plugin allows you to control devices that may be supported on OpenRGB but not on SignalRGB right now and sync them with your current layout and effects."
			font.pixelSize: 16
			font.family: "Poppins"
			font.bold: false
			bottomPadding: 10
			width: parent.width
			wrapMode: Text.WordWrap
		}
        Text {
			color: theme.primarytextcolor
			text: "To make this plugin work make sure you have OpenRGB and the SDK server installed and running on your system. You can download it from the official website."
			font.pixelSize: 13
			font.family: "Poppins"
			font.bold: false
			bottomPadding: 10
			width: parent.width
			wrapMode: Text.WordWrap
		}
		        Text {
			color: theme.primarytextcolor
			text: "You also need to install node.js and run the node server using the following command: node server.js. This is temporary and will be replaced by a more user-friendly solution in the future."
			font.pixelSize: 13
			font.family: "Poppins"
			font.bold: false
			bottomPadding: 10
			width: parent.width
			wrapMode: Text.WordWrap
		}
		Row {
			spacing: 5
			
			Rectangle {
				x: 0
				y: 0
				width: 200
				height: 30
				radius: 2
				border.color: "#444444"
				border.width: 2
				color: "#141414"

				TextField {
					width: 180
					leftPadding: 0
					rightPadding: 10
					id: discoverIP
					x: 10
					y: -5
					color: theme.primarytextcolor
					font.family: "Poppins"
					font.bold: true
					font.pixelSize: 16
					verticalAlignment: TextInput.AlignVCenter
					placeholderText: "SDK Server IP"
					
					validator: RegularExpressionValidator {
						regularExpression:  /^((?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.){0,3}(?:[0-1]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/
					}
					background: Item {
						width: parent.width
						height: parent.height
						Rectangle {
							color: "transparent"
							height: 1
							width: parent.width
							anchors.bottom: parent.bottom
						}
					}
				}
			}

			Rectangle {
				x: 0
				y: 0
				width: 60
				height: 30
				radius: 2
				border.color: "#444444"
				border.width: 2
				color: "#141414"
				
				TextField {
					width: 50
					leftPadding: 0
					rightPadding: 10
					id: ledCount
					x: 10
					y: -5
					color: theme.primarytextcolor
					font.family: "Poppins"
					font.bold: true
					font.pixelSize: 16
					verticalAlignment: TextInput.AlignVCenter
					placeholderText: "Port"
					
					
					validator: RegularExpressionValidator {
						regularExpression:  /^([0-9]{1,4})$/
					}
					background: Item {
						width: parent.width
						height: parent.height
						Rectangle {
							color: "transparent"
							height: 1
							width: parent.width
							anchors.bottom: parent.bottom
						}
					}
				}
			}
		

			Item {
				Rectangle {
					width: 130
					height: 30
					color: "#009000"
					radius: 2
				}
				width: 90
				height: 30
				ToolButton {
					height: 30
					width: 130
					anchors.verticalCenter: parent.verticalCenter
					font.family: "Poppins"
					font.bold: true
					icon.source: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAV0lEQVQ4jWP8//8/A0UAnwH///3r+P/vXwdevQQMuPv/37+7+AxgItaluMAwMIARGpIdDAwMoVjklaD0PSxyqxkYGSsodsFoNFLBABYC8qsJGcBIaXYGAFjoNxCMz3axAAAAAElFTkSuQmCC"
					text: "Connect"
					anchors.right: parent.center
            onClicked: {
				deviceListLoader.active = false;
				discovery.deviceList = [];

                const xhr = new XMLHttpRequest();

				const host = discoverIP.text;
				const port = ledCount.text;

                xhr.open("GET", `http://localhost:9730/getDeviceList?host=${host}&port=${port}`, true);

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4 && xhr.status === 200) {
						service.log(xhr.responseText);
						if (xhr.responseText != "[]") {
                        // Handle the response containing device data

                        // Dynamically create rectangles for each device
                        discovery.deviceList = JSON.parse(xhr.responseText);
                        
                        // Activate the Loader when the device list is available
                        deviceListLoader.active = true;
						discovery.connect();
						}
                    }
                };

                xhr.send();
            }
        }
    }
		}
    // Loader for dynamically loading the device list component

	// Define the Loader for the device list

    // Loader for dynamically loading the device list component
    Loader {
        id: deviceListLoader

        // Define the component directly in the Loader
        sourceComponent: Component {
            Column {
                width: 200
				spacing: 5
				topPadding: 10

				//text
				Text {
					color: theme.primarytextcolor
					text: "Select the devices you want to control"
					font.pixelSize: 16
					font.family: "Poppins"
					font.bold: false
					bottomPadding: 10
					width: 400
					wrapMode: Text.WordWrap
				}

                Repeater {
                    model: discovery.deviceList // Assuming deviceList is a property in the DiscoveryService
					id: deviceRepeater

                    Rectangle {
                        width: 500
                        height: 30 // Set an appropriate height for each device rectangle
                        color: "#212d3a" // Set the background color for each device rectangle
                        radius: 2

                        Text {
                            anchors.centerIn: parent
                            color: "white"
                            text: modelData.name // Assuming 'name' is a property in your device object
                            font.pixelSize: 16
                            font.family: "Poppins"
                            font.bold: true
                        }

						MouseArea {
							anchors.fill: parent
							onClicked: {
								// Handle the click event for the device
								//make the rectangle background color change red
								if (parent.color == "#212d3a") {
									parent.color = "#ff0000";
									discovery.selectedDevices.push(modelData);
									discovery.updateDevices();
								} else {
									parent.color = "#212d3a";
									discovery.selectedDevices.splice(discovery.selectedDevices.indexOf(modelData), 1);
									discovery.updateDevices();
								
							}
							}
						}
                    }
                }
            }
        }

        // Load the component only when the device list is available
        active: false
    }

	}}