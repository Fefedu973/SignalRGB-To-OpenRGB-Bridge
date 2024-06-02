# SignalRGB To OpenRGB Bridge
An add-on for signalRGB that allows to control OpenRGB Devices
This plugin allows you for exemple to make Nvidia Founder Editions graphics cards compatible with signalRGB !. It also remove the lag with the G915 keyboard. but it's not limited to those devices, it support all devices supported by OpenRGB ! (you can use this plugin to fill in the gabs of supported devices by signalRGB in your setup). ⚠️ This plugin does not bring the support of all devices to signalRGB  but only the devices supported by openRGB in the first place.

[![Click here to add this repo to SignalRGB](https://github.com/SRGBmods/qmk-plugins/blob/main/_images/add-to-signalrgb.png)](https://srgbmods.net/s?p=addon/install?url=https://github.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge)

## What is working Right now ?
- Device from OpenRGB sync with SignalRGB
- Multiple zones control support 
- Multiple Device Support
- Independent LED control support
- Custom shaped devices support 

## TODO:
- Device sepcific controls
- Get rid of the stupid node js server
- Sync shutdown color from signalRGB to openRGB
- Fix a JSON Parse Error on first plugin usage (can be fixed by clicking the delete all button)

## Known Issues
- There isn't any known issues rigth now
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
- Then we are going to create a "shutdown profile". This will allow signalRGB to support changing the shutdown color of your devices (colors that are set when you close SignalRGB or your computer.) You need to do that because when trying applying the last color of shutdown color directly when using the signalRGB feature the intermediary server and openRGB were already closed when turning the computer off, this means that the shutdown color wasn't applied. If you change the shutdown color in SignalRGB it won't be synced with your shudown profile that we are going to create for now. The signalRGB shutdown color as you configured in signalRGB will only work if you close SignalRGB because openRGB and the intermediary server are not closed during this process. This means that for now the shutdown color when shuting your computer down config and implementation is managed by openRGB not signalRGB and their settings are not synced. hope it's clear lol.
   - Click on the little arrow on the right of the the "Save Profile" button
   - In the "Create a new profile" field please insert this EXACT name "shutdown-profile"
   - In the settings -> General Settings scroll to the bottom and enable the "Load Profile" option and set it to the default profile.
   - Enable "Set Profile on Exit" and select the "shutdown-profile" profile
   - Edit the shutdown profile to match the lightning you want on shutdown. Don't forget to save it
- Make sure to disable devices that you don't need openRGB to control by going into Settings -> Supported Devices and searching for the devices that shows up in openRGB you don't want and un-ticking them. Make sure to click "Apply changes" and to restart OpenRGB after that
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
- If you nned to stop/restart the server you need to stop the server process in the task manager (search for node.js javascript runtime) and start it again manually

### Configure the Device LED Layout in OpenRGB (Optionnal)
- If you have device that have a special shape (eg: for exemple fans are round but signal rgb don't know their shape so the effects are going to be applied as there were a straight line.
  - For some devices you may need to manually add the number of leds your device has (for motherboard rgb header for exemple) by selecting the zone you want in OpenRGB and selecting edit and the enter the number of led your device has. See the OpenRGB documentation to see if your device is supported or if you have any questions.
- To edit the LED postion head into the Visual Map tab.
- On the left you will see the list of your device. Click on the + sign to add the device you want to edit the shape on the grid, then click "auto resize"
- Click on the checkmark icon of the device you added and make a custom shape by selecting shape -> custom and then on "Edit Shape"
- Inside the new popup window you can do pre-defined shapes or you can drag each led arround individually to make the shpae you want that that will match your device
- Once done click on "auto resize" and on "save"
- In the main window click on "auto resize"
- Your device modifications are ready to be saved now !
- Click on "Vmap menu" and hit "save" set the name to match your device name and add "custom shape" to it and click "ok" and click another time on Vmap Meanu and tick "register controller"
- Go back into the "Devices" tab and you should see a new device. It is in fact the same device as the device you've just modified but with the new led positions as the plugin cannot direclty edit the main device led position
- Now you can continue the setup process. But make sure when it's going to be the time of connecting your device with SignalRGB to select the device with the custom shape and not the normal one.

## Please open an issue if you have any issue or suggestions !
