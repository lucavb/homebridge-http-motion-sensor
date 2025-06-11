# homebridge-http-motion-sensor

This plugin offers you a motion sensor that can be triggered via an HTTP request. This can be used in conjunction with an ESP8266 for instance or an Arduino with an ethernet shield. I will add an example Arduino script in the future.

## What's New in v1.3.0

This version has been completely modernized to use the latest Homebridge APIs and best practices, following the [official Homebridge documentation](https://developers.homebridge.io/#/api/platform-plugins):

- **🏗️ Platform Plugin Architecture**: Converted from accessory plugin to platform plugin as recommended by Homebridge developers
- **📦 Multiple Sensor Support**: Configure multiple HTTP motion sensors in a single platform
- **⬆️ Updated to Homebridge 1.10.0**: Now compatible with the latest Homebridge version
- **🚀 Homebridge v2.0 Ready**: Full compatibility with Homebridge v2.0 beta and stable releases
- **🗑️ Removed deprecated dependencies**: Eliminated `homebridge-ts-helper` dependency and use modern Homebridge APIs directly
- **✨ Enhanced Configuration UI**: Rich configuration schema with validation and user-friendly forms
- **🛡️ Better error handling**: Enhanced HTTP server error handling and configuration validation
- **🧹 Cleaner codebase**: Improved code structure, better TypeScript types, and modern async patterns
- **📊 Better logging**: More informative debug and info logging throughout the plugin
- **🧪 Comprehensive Testing**: CI-ready test suite with automated functional testing

### Breaking Changes

⚠️ **Configuration Format Changed**: The plugin now uses platform configuration instead of accessory configuration.

- **Requires Homebridge 1.6.0 or later** (compatible with Homebridge v2.0)
- **Node.js 20.15.1 or 22+ required** (Node.js 18 support dropped, following Homebridge v2.0)
- **Migration required**: See migration guide below

### Homebridge v2.0 Compatibility

✅ This plugin is **fully compatible** with both Homebridge v1.x and v2.0:
- Uses modern HAP-NodeJS APIs (no deprecated patterns)
- Follows current Homebridge platform plugin best practices
- Tested with Homebridge v2.0 beta releases
- Ready for Homebridge v2.0 stable release

Users will see a **green checkmark** in the Homebridge UI readiness check when using this plugin with Homebridge v2.0.

### Migration from v1.2.x

If you're upgrading from an older version, you'll need to update your configuration from accessory format to platform format:

#### Old Configuration (Accessory):

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

#### New Configuration (Platform):

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

| Key      | Description                                                                                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name     | Required. The name of this motion sensor. This will appear in your HomeKit app                                                                                                                                                                                            |
| port     | Required. The port that you want this sensor to listen on. Choose a number above 1024 and make sure each sensor uses a different port                                                                                                                                     |
| model    | Optional. Model name displayed in HomeKit                                                                                                                                                                                                                                 |
| serial   | Optional. Serial number displayed in HomeKit. If not provided, a default will be used                                                                                                                                                                                     |
| bind_ip  | Optional. IP address to bind the HTTP server to. Defaults to "0.0.0.0" (all interfaces)                                                                                                                                                                                   |
| repeater | Optional. Array of endpoints to call when motion is detected. Each entry will trigger an HTTP GET request. Useful for triggering other devices or services. See [Node.js HTTP documentation](https://nodejs.org/api/http.html#http_http_get_options_callback) for details |

### Repeater Configuration

| Key  | Description                                                                            |
| ---- | -------------------------------------------------------------------------------------- |
| host | Required. Hostname or IP address of the target server                                  |
| port | Required. Port number of the target server                                             |
| path | Required. URL path to request (e.g., "/api/trigger")                                   |
| auth | Optional. Authorization header value (e.g., "Bearer token123" or "Basic dXNlcjpwYXNz") |

## Benefits of Platform Plugin Architecture

- **Multiple Sensors**: Configure multiple motion sensors in a single platform
- **Better Resource Management**: Shared platform resources and better lifecycle management
- **Future-Proof**: Follows modern Homebridge best practices
- **Enhanced Configuration**: Rich configuration UI with validation
- **Improved Logging**: Better debugging and monitoring capabilities

## Testing

### Automated Testing

Run the full automated test suite:

```bash
npm test
```

This will:
- Build the plugin
- Start a test Homebridge instance
- Create two test motion sensors on ports 18089 and 18090
- Test motion detection and reset functionality
- Verify HTTP responses, multiple requests, and different endpoints
- Test motion reset after timeout
- Show logs and optionally keep Homebridge running for manual testing

For CI environments (no interactive prompts):

```bash
npm run test:ci
```

### Manual Testing

For quick development testing:

```bash
npm run test:manual
```

For quick start during development:

```bash
npm run test:quick
```

### Prerequisites for Testing

- **Node.js 20.15.1 or 22+** (Node.js 18 not supported)
- **Homebridge** (`npm install -g homebridge`)
- **curl** (for HTTP testing)
- **netcat (nc)** (for port checking)

### Test Configuration

Tests are located in the `tests/` directory:
- `tests/test.sh` - Comprehensive automated test suite
- `tests/manual-test.sh` - Interactive testing script  
- `tests/test-config.json` - Test configuration with two sensors
- `tests/README.md` - Detailed testing documentation

The test configuration includes:
- **Test Motion Sensor 1**: Port 18089, basic configuration
- **Test Motion Sensor 2**: Port 18090, with repeater functionality to httpbin.org

### Test Commands

```bash
# Full test suite
npm test                    # Interactive mode
npm run test:ci            # CI mode (no prompts)

# Development testing  
npm run test:quick         # Quick start
npm run test:manual        # Interactive testing
npm run test:dev          # Use existing .tmp

# Maintenance
npm run test:clean        # Clean up temp files
```
