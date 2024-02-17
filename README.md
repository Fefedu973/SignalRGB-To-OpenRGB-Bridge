# SignalRGB To OpenRGB Bridge
An add-on for signalRGB that allows to control OpenRGB Devices
This plugin allows you to make Nvidia Founder Editions graphics cards compatible with signalRGB

[![Click here to add this repo to SignalRGB](https://github.com/SRGBmods/qmk-plugins/blob/main/_images/add-to-signalrgb.png)](https://srgbmods.net/s?p=addon/install?url=https://github.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge)

## What is working Right now ?
- Device from OpenRGB sync with SignalRGB
- Multiple zones control support 
- Multiple Device Support
- Independent LED control support
- Custom shaped devices support 

## TODO:
- Device sepcific controls
- Fixing bugs related to device recognition and more
- Get rid of the stupid node js server

## SETUP INSTRUCTIONS

### Install and configure OpenRGB (only the first time)
- Download OpenRGB [here](https://openrgb.org/releases.html).
- Extract the zip file and put the extracted files in your programm folder
- Launch OpenRGB.exe
- Go into Settings -> General Settings and enable:
  - Minimize On Close
  - Start At Login
  - Start Minimized
  - Start Server
- Then go into the SDK Server Tab
- Click on "Start Server" (you can change the Host and the Port if you want/need but I don't recommend to do that)
#### Optionnal: Install the OpenRGB Visual Map Plugin (if you want to customize the LED position of your device)
- Download The OpenRGB Visual Map Plugin [here](https://openrgb.org/plugins.html).
- Extract the zip file
- Launch OpenRGB and go into Settings -> Plugins and click on Install Plugin
- In the file selector navigate to you uncompressed folder and select "OpenRGBVisualMapPlugin.dll"
- See the configure device layout section before continuing the setup

### Install and configure the plugin for SignalRGB
- Click on the "Add to SignalRGB" Button
- Accept opening the link with SignalRGB
- In the SignalRGB app click on "confirm" in the install add-on dialog
- Wait for the plugin to download
- Press the "Windows" + "R" keys and paste this URL "%localappdata%\WhirlwindFX\SignalRgb\cache\addons"
- Head into the last modified folder
- Launch "server.exe"
- Click on "Allow" in the Windows Security firewall dialog box
- Then restart SignalRGB (right click on tray icon -> restart)
- Go into "Network" and click on "OpenRGB Bridge"
- Fill the SDK Server IP and Port Field (They are the values that were configured when starting the OpenRGB SDK Server, by default you should put 127.0.0.1 in the Server IP field and 6742 in the Port field)
- Then Click on "Connect"
- You will see a list of devices, Click on the devices you want to control using my plugin through OpenRGB that are not yet supported by SignalRGB
- The device you selected should light up according to your selected effect in SignalRGB, you can now move it across the layout and your configuration should be done. If it's working please don't touch anything after that.
- If in the meantime new devices are detected by OpenRGB, if the device order is changed in OpenRGB or if you change device settings or layout (using the visual map plugin) please press the "Delete All" button and re-select the devices you want to control

### Configure the Intermediary Server (Optionnal)
You can change many settings for the intermediary server in order to suits your needs. Here is the list of what you can do.
- You can change the server port if you want or if it is aleready used by adding "--port=${THE PORT YOU WANT}" to the file name
   - Make sure to tick the "Use a custom port for the intermediate server" checkbox in my plugin page inside SiganRGB and enter the port you choosed for your server
- You can prevent the server for starting with windows by adding "--no-startup" to the filename (note that you will need to manually start it when you start SignalRGB)
- If you have issue with my plugin you can check the logs of the server by adding "--console" to the filename. This will show the console on next server startup. Please make sure to remove it if you don't want that anymore. You can also check logs in my plugin config page in SignalRGB by enabling "shoow console" and in each device by clicking on the device that is not working in the devices page, then go into the question mark tab and enable Show console. If you have issue please head into the [Signal RGB Plugin Test server](https://discord.gg/Bn4q4h9QCH) and leave a message here and tag me (Fefe_du_973) or open an issue on the github
You can of course enbale multiple settings at the same time. Use it as you want !

### Configure the Device LED Layout in OpenRGB (Optionnal)
- WIP

## Please open an issue if you have any issue or suggestions !
