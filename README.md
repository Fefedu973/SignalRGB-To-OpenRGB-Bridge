# SignalRGB To OpenRGB Bridge

SignalRGB To OpenRGB Bridge is a SignalRGB addon that exposes devices supported by [OpenRGB](https://openrgb.org/) as controllable SignalRGB devices.

Use it to fill support gaps in your setup: GPUs, keyboards, LED controllers, motherboard headers, custom Visual Map layouts, or any other device that works in OpenRGB but is not currently supported directly by SignalRGB.

[![Add To SignalRGB](https://marketplace.signalrgb.com/resources/add-extension-256.png "Add to My SignalRGB Installation")](https://srgbmods.net/s?p=addon/install?url=https://github.com/Fefedu973/SignalRGB-To-OpenRGB-Bridge)

## Features

- Sync OpenRGB devices with the current SignalRGB canvas and effects.
- Select only the OpenRGB devices you want SignalRGB to control.
- Multiple OpenRGB devices can be used at the same time.
- Per-LED color streaming is supported when the OpenRGB device supports Direct/Custom mode.
- Multi-zone and matrix devices are exposed as SignalRGB subdevices.
- Custom shapes from the OpenRGB Visual Map Plugin can be selected and controlled.
- Large LED devices are sent over binary TCP packets instead of HTTP URLs.
- OpenRGB SDK protocol versions up to v5 are supported.

This addon does not add native SignalRGB support for every RGB device. It can only control devices that OpenRGB already detects and supports.

## Requirements

- SignalRGB with addon TCP/network module support.
- OpenRGB installed and running.
- The OpenRGB SDK server enabled.

Default OpenRGB SDK endpoint:

```text
Host: 127.0.0.1
Port: 6742
```

## Installation

1. Click the `Add To Installation` button above.
2. Accept the SignalRGB install prompt.
3. Open SignalRGB.
4. Go to `Third Party Services`.
5. Open `OpenRGB Bridge`.
6. Start OpenRGB and make sure the SDK server is online.
7. In the addon UI, keep `127.0.0.1:6742` unless you changed OpenRGB's SDK host or port.
8. Click `Refresh`.
9. Select the OpenRGB devices you want to control from SignalRGB.

Selected devices are saved and re-added on the next SignalRGB launch.

## OpenRGB Setup

Install OpenRGB from the [official releases page](https://openrgb.org/releases.html), then configure it before using the addon:

1. Launch OpenRGB.
2. Open `Settings > General Settings`.
3. Enable `Start Server`.
4. Optional, but recommended: enable `Start at Login`, `Start Minimized`, and `Minimize On Close`.
5. Open the `SDK Server` tab and confirm the server is online.
6. Disable any devices you do not want OpenRGB to control in `Settings > Supported Devices`, then apply changes and restart OpenRGB if needed.

## Custom LED Layouts

For devices with unusual LED positions, such as fans, strips, headers, or non-rectangular devices, use the [OpenRGB Visual Map Plugin](https://openrgb.org/plugins.html).

Recommended flow:

1. Install the OpenRGB Visual Map Plugin from OpenRGB's plugin page.
2. Open the Visual Map tab in OpenRGB.
3. Add the device you want to reshape.
4. Use `Auto Resize`, then edit the shape or LED positions.
5. Save the visual map.
6. Register the mapped controller.
7. Return to the addon, click `Refresh`, and select the mapped controller instead of the original one.

If you change OpenRGB device order, add new devices, or change Visual Map layouts, click `Delete All` in the addon and select your devices again.

## Shutdown Color

The addon can send SignalRGB's shutdown color while SignalRGB and OpenRGB are still running. During a full PC shutdown, Windows may close SignalRGB, OpenRGB, or the SDK connection before the final color packet is sent.

For reliable power-off lighting, configure an OpenRGB shutdown profile:

1. In OpenRGB, create a profile named `shutdown-profile`.
2. Configure it with the lighting you want after shutdown.
3. In `Settings > General Settings`, enable `Set Profile on Exit`.
4. Select `shutdown-profile`.
5. Save the profile.

This OpenRGB profile is independent from SignalRGB's shutdown color setting.

## How It Works

The addon implements the OpenRGB SDK protocol directly in `OpenRGBBridge.js`. It connects to the SDK server, reads controller data, registers selected controllers in SignalRGB, sends OpenRGB's `SETCUSTOMMODE` command for controlled devices, and sends `UPDATELEDS` packets during rendering.

The addon does not pick a mode by name from the device mode list. It uses the SDK `SETCUSTOMMODE` command, which asks OpenRGB to put the target controller in its SDK-controlled Custom/Direct mode when the device supports it.

Device identity is based on OpenRGB metadata such as vendor, name, serial, and location. If OpenRGB exposes identical devices without stable serial/location data, you may need to reselect them after the OpenRGB device list changes.

## Troubleshooting

### I do not see a "Network" section in SignalRGB

Recent SignalRGB versions show addons like this under `Third Party Services`.

### No devices appear

- Confirm OpenRGB is running.
- Confirm the OpenRGB SDK server is enabled and online.
- Confirm the host and port in the addon match the OpenRGB SDK Server tab.
- Click `Refresh`.
- If OpenRGB recently detected new devices, click `Rescan`, then `Refresh`.

### Devices appear but colors do not change

- Make sure no other RGB software is controlling the same device.
- Make sure the device supports Direct or Custom mode in OpenRGB.
- Try `Delete All`, then select the device again.
- Check the SignalRGB plugin console for OpenRGB TCP errors.

### Colors freeze or devices stop matching

OpenRGB can change controller indexes after devices are added, removed, disabled, or remapped. Click `Delete All`, then `Refresh`, and select the devices again.

## Development

This repository is a SignalRGB addon. The important files are:

- `OpenRGBBridge.js`: addon runtime, OpenRGB TCP client, codec, discovery, and rendering.
- `OpenRGBBridge.qml`: settings UI.
- `signalbridge.png`: addon image asset.
- `tools/validate-openrgb-codec.cjs`: packet encoder validation.

No `node_modules` directory or generated server binary should be committed.

Run the local codec check with:

```bash
npm run validate
```

## Known Issues

### Some large OpenRGB controllers may be skipped during refresh

Some controllers with a large LED count or large zone/matrix payload can fail to load through SignalRGB's TCP addon transport even though OpenRGB itself still detects them. The addon keeps discovery simple: it reads controllers one by one and skips a controller after a timeout so one problematic device does not block the entire list.

This issue has been solved. If this is still dosen't work, make sure that your SignalRGB install is up to date
