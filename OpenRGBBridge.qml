Item {
  anchors.fill: parent
  Column{
    width: parent.width
    height: parent.height

    Repeater {
      model: service.controllers          
      delegate: Item {
        width: 300
        height: 250
        Rectangle {
          width: parent.width
          height: parent.height - 10
          color: "#FFFFFF"
          radius: 5
        }
        Image {
          id: logo
          x: 10
          y: 10
          height: 80              
          source: "https://marketplace.signalrgb.com/brands/products/cololight/logo.png"
          fillMode: Image.PreserveAspectFit
          antialiasing: true
          mipmap:true
        }
        Column {
          x: 10
          y: 100
          width: parent.width - 20
          spacing: 10
          
          Text{
            color: "#000000"
            text: model.modelData.obj.name
            font.pixelSize: 20
            font.family: "Poppins"
            font.bold: true
          }
          Text{
            color: "#000000"
            text: "Id: " + model.modelData.obj.id
            font.family: "Montserrat"
          }
          Text{
            color: "#000000"
            text: "IP: " + model.modelData.obj.ip
            font.family: "Montserrat"
          }
            
                
        }
        
      }  
    }
  }
}
