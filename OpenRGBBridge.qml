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
						discovery.connect();
					}
				}
			}
		}
	}
}
