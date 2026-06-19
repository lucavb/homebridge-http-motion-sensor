# homebridge-http-motion-sensor

[![CI](https://github.com/lucavb/homebridge-http-motion-sensor/actions/workflows/ci.yml/badge.svg)](https://github.com/lucavb/homebridge-http-motion-sensor/actions/workflows/ci.yml)

<div align="center">
  <img src="homebridge-http-motion-sensor.jpg" alt="Homebridge HTTP Motion Sensor" width="400">
  <br>
  <em>HTTP-triggered motion sensor for your smart home</em>
</div>

> **⚠️ BREAKING CHANGE NOTICE**  
> **Version 2.0.0+ requires configuration migration!**
>
> This plugin has been converted from an **accessory plugin** to a **platform plugin**. If you're upgrading from v1.x, you **MUST** update your Homebridge configuration. See the [Migration Guide](#migration-from-v1x) below.
>
> **Old**: Configured in `"accessories"` array  
> **New**: Configured in `"platforms"` array

This plugin offers you a motion sensor that can be triggered via an HTTP request. This can be used in conjunction with an ESP8266 for instance or an Arduino with an ethernet shield. See the [ESP8266 example](esp8266/sensor.ino) in this repository.

## What's New in v4.1.0

- **Optional inbound authentication**: Per-sensor HTTP protection with Bearer token, Basic auth, or custom header
- **Fully opt-in**: Existing configurations and unauthenticated HTTP triggers work unchanged
- **Homebridge UI**: Security section in the config UI for each sensor

## What's New in v4.0.0

- **Dynamic platform plugin**: Migrated to `DynamicPlatformPlugin` (Homebridge best practice)
- **Configurable motion reset**: Optional `reset_timeout` per sensor in seconds (default: 11)
- **Stable accessory identity**: UUIDs derived from `serial` (or `name`) + `port`

### Breaking Changes in v4.0.0

**HomeKit accessory UUIDs change** when upgrading from v3.x. You may see duplicate motion sensors in the Home app and need to re-link automations. See [Migration from v3.x](#migration-from-v3x) below.

- Platform config format is unchanged
- HTTP trigger behaviour is unchanged

## What's New in v3.1.0

- **Homebridge 2.1 ready**: Dual ESM/CJS build via tsdown; tested with Homebridge 2.1
- **Homebridge 1.x support preserved**: CommonJS entry via `dist/index.cjs`
- **Modern toolchain**: Vitest unit tests, shelly-ds9-style CI, husky pre-commit hooks
- **API cleanup**: `.onGet()` for motion state reads, improved config validation

## What's New in v3.0.0

- **Node.js 22.12+ or 24+ required** (Node.js 20 support dropped)

## What's New in v2.0.0

This version has been completely modernized to use the latest Homebridge APIs and best practices, following the [official Homebridge documentation](https://developers.homebridge.io/#/api/platform-plugins):

- **🏗️ Platform Plugin Architecture**: Converted from accessory plugin to platform plugin as recommended by Homebridge developers
- **📦 Multiple Sensor Support**: Configure multiple HTTP motion sensors in a single platform
- **⬆️ Updated for Homebridge 1.6+ and 2.x**: Compatible with Homebridge 2.1 via dual-module publish
- **🗑️ Removed deprecated dependencies**: Eliminated `homebridge-ts-helper` dependency and use modern Homebridge APIs directly
- **✨ Enhanced Configuration UI**: Rich configuration schema with validation and user-friendly forms
- **🛡️ Better error handling**: Enhanced HTTP server error handling and configuration validation
- **🧹 Cleaner codebase**: Improved code structure, better TypeScript types, and modern async patterns
- **📊 Better logging**: More informative debug and info logging throughout the plugin
- **🧪 Comprehensive Testing**: CI-ready test suite with automated functional testing

### Breaking Changes

⚠️ **Configuration Format Changed**: The plugin now uses platform configuration instead of accessory configuration.

- **Requires Homebridge 1.6.0 or later** (including Homebridge 2.1)
- **Node.js 22.12+ or 24+ required**
- **Migration required**: See migration guide below

### Homebridge v2.0 Compatibility

✅ This plugin is **fully compatible** with both Homebridge v1.x and v2.0:

- Uses modern HAP-NodeJS APIs (no deprecated patterns)
- Follows current Homebridge platform plugin best practices
- Tested with Homebridge v2.0 beta releases
- Ready for Homebridge v2.0 stable release

Users will see a **green checkmark** in the Homebridge UI readiness check when using this plugin with Homebridge v2.0.

### Migration from v1.x

⚠️ **REQUIRED CONFIGURATION CHANGE**: This plugin now uses platform configuration instead of accessory configuration.

**Follow these steps to migrate:**

1. **Remove the old accessory configuration** from your `"accessories"` array
2. **Add the new platform configuration** to your `"platforms"` array
3. **Restart Homebridge**

#### Old Configuration (Accessory) - ❌ Remove This:

```json
{
    "accessories": [
        {
            "accessory": "http-motion-sensor",
            "name": "Hallway Motion Sensor",
            "port": 18089
        }
    ]
}
```

#### New Configuration (Platform) - ✅ Add This:

```json
{
    "platforms": [
        {
            "platform": "HttpMotionSensorPlatform",
            "name": "HTTP Motion Sensor Platform",
            "sensors": [
                {
                    "name": "Hallway Motion Sensor",
                    "port": 18089
                }
            ]
        }
    ]
}
```

**🎉 Benefits of the new platform configuration:**

- Support for multiple motion sensors in one configuration
- Better resource management and performance
- Enhanced configuration UI with validation
- Future-proof architecture following Homebridge best practices

### Migration from v3.x

**Required when upgrading to v4.0.0+**: HomeKit accessory UUIDs change because the plugin now uses `DynamicPlatformPlugin`.

**Follow these steps:**

1. Note your current motion sensor names and any HomeKit automations that use them
2. Upgrade the plugin to v4.0.0 and restart Homebridge
3. In the Home app, remove the **old** duplicate motion sensors (ghost accessories from v3.x)
4. Re-assign automations and scenes to the new sensors
5. Optionally set `reset_timeout` (seconds) per sensor if the default 11 seconds does not suit your hardware

**Tips for stable UUIDs in v4+:**

- Set `serial` in config if you want to rename the sensor in HomeKit without changing its UUID
- Changing `port` or `serial` (or `name` when no `serial` is set) creates a new accessory — remove the old one from Home

Config format and HTTP ports are unchanged — no `config.json` edits are required for the upgrade itself.

## Installation

Run the following command

```
npm install -g homebridge-http-motion-sensor
```

Chances are you are going to need sudo with that.

## Config.json

This plugin now uses the **platform plugin** architecture for better flexibility and multiple sensor support. Here's an example configuration:

```json
{
    "platforms": [
        {
            "platform": "HttpMotionSensorPlatform",
            "name": "HTTP Motion Sensor Platform",
            "sensors": [
                {
                    "name": "Hallway Motion Sensor",
                    "port": 18089,
                    "serial": "E642011E3ECB",
                    "model": "ESP8266 Motion Sensor",
                    "bind_ip": "0.0.0.0",
                    "repeater": [
                        {
                            "host": "192.168.2.11",
                            "port": 22322,
                            "path": "/turnonscreentilltimeout",
                            "auth": "Bearer your-token-here"
                        }
                    ]
                },
                {
                    "name": "Garden Motion Sensor",
                    "port": 18090,
                    "serial": "F642011E3ECC",
                    "model": "ESP8266 Motion Sensor"
                }
            ]
        }
    ]
}
```

### Platform Configuration

| Key      | Description                                                 |
| -------- | ----------------------------------------------------------- |
| platform | Required. Must be `"HttpMotionSensorPlatform"`              |
| name     | Required. The name of this platform instance                |
| sensors  | Required. Array of motion sensor configurations (see below) |

### Sensor Configuration

| Key           | Description                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name          | Required. The name of this motion sensor. This will appear in your HomeKit app                                                                                                                                                                                            |
| port          | Required. The port that you want this sensor to listen on. Choose a number above 1024 and make sure each sensor uses a different port                                                                                                                                     |
| model         | Optional. Model name displayed in HomeKit                                                                                                                                                                                                                                 |
| serial        | Optional. Serial number displayed in HomeKit. Also used for stable accessory UUID in v4+. If not provided, `name` is used instead                                                                                                                                         |
| bind_ip       | Optional. IP address to bind the HTTP server to. Defaults to "0.0.0.0" (all interfaces)                                                                                                                                                                                   |
| reset_timeout | Optional. Seconds before motion resets to inactive. Default is 11                                                                                                                                                                                                         |
| auth          | Optional. Inbound authentication for HTTP trigger requests (see [Securing your sensors](#securing-your-sensors)). Not the same as `repeater[].auth`                                                                                                                       |
| repeater      | Optional. Array of endpoints to call when motion is detected. Each entry will trigger an HTTP GET request. Useful for triggering other devices or services. See [Node.js HTTP documentation](https://nodejs.org/api/http.html#http_http_get_options_callback) for details |

### Inbound Authentication (`sensors[].auth`)

| Key          | Description                                                         |
| ------------ | ------------------------------------------------------------------- |
| mode         | Required when `auth` is set. One of `bearer`, `basic`, or `header`  |
| token        | Required for `bearer`. Client sends `Authorization: Bearer <token>` |
| username     | Required for `basic`. Basic auth username                           |
| password     | Required for `basic`. Basic auth password                           |
| header_name  | Required for `header`. Custom header name (e.g. `X-Api-Key`)        |
| header_value | Required for `header`. Expected header value                        |

### Repeater Configuration

| Key  | Description                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| host | Required. Hostname or IP address of the target server                                                                                                                                                              |
| port | Required. Port number of the target server                                                                                                                                                                         |
| path | Required. URL path to request (e.g., "/api/trigger")                                                                                                                                                               |
| auth | Optional. **Outbound** Authorization header value for repeater requests (e.g., `"Bearer token123"` or `"Basic dXNlcjpwYXNz"`). This is separate from `sensors[].auth`, which protects **inbound** trigger requests |

## Securing your sensors

By default, any device on your network can trigger a sensor by sending an HTTP request to its port. Optional per-sensor `auth` protects the inbound HTTP endpoint.

> **Opt-in on both sides:** Enabling `sensors[].auth` in Homebridge without updating your ESP8266 or other HTTP client will stop motion from triggering until the client sends credentials. Update firmware ([`AUTH_ENABLED`](esp8266/sensor.ino)) or HTTP clients when you enable auth.

Secrets are stored in `config.json` in plaintext (standard for Homebridge plugins). Use long random tokens where possible.

### Bearer token (recommended)

```json
{
    "name": "Hallway Motion Sensor",
    "port": 18089,
    "auth": {
        "mode": "bearer",
        "token": "your-long-random-secret"
    }
}
```

```bash
curl -H "Authorization: Bearer your-long-random-secret" http://homebridge.local:18089/motion
```

### Basic auth

```json
{
    "auth": {
        "mode": "basic",
        "username": "sensor",
        "password": "your-password"
    }
}
```

```bash
curl -u sensor:your-password http://homebridge.local:18089/motion
```

### Custom header

```json
{
    "auth": {
        "mode": "header",
        "header_name": "X-Api-Key",
        "header_value": "your-api-key"
    }
}
```

```bash
curl -H "X-Api-Key: your-api-key" http://homebridge.local:18089/motion
```

### Testing auth

```bash
# Should return 401 when auth is enabled but header is missing
curl -w "\n%{http_code}\n" http://homebridge.local:18089/motion
```

## Benefits of Platform Plugin Architecture

- **Multiple Sensors**: Configure multiple motion sensors in a single platform
- **Better Resource Management**: Shared platform resources and better lifecycle management
- **Future-Proof**: Follows modern Homebridge best practices
- **Enhanced Configuration**: Rich configuration UI with validation
- **Improved Logging**: Better debugging and monitoring capabilities

### Homebridge 2.x Compatibility

This plugin ships a dual ESM/CJS build and declares `engines.homebridge: ^1.6.0 || ^2.0.0`. Users should see a green checkmark in the Homebridge UI readiness check on Homebridge 2.x.

## Testing

### Unit tests (Vitest)

```bash
npm test
```

CI uses `npm run test:ci` for verbose output.

### Integration tests (Homebridge + HTTP)

End-to-end tests boot Homebridge and exercise the HTTP motion sensors:

```bash
npm run test:integration
```

Requires global `homebridge`, `curl`, and `nc` (netcat).

### Full local gate (matches CI)

```bash
npm run cq && npm run test:ci && npm run test:integration
```

The integration suite will:

- Build the plugin
- Start a test Homebridge instance
- Create three test motion sensors on ports 18089, 18090, and 18091 (auth-enabled)
- Test motion detection and reset functionality
- Verify HTTP responses, multiple requests, and different endpoints
- Test inbound Bearer authentication on port 18091
- Test motion reset after timeout
- Show logs and optionally keep Homebridge running for manual testing

For CI environments (no interactive prompts), `test:integration` is used automatically.
