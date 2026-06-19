# ESP8266 Motion Sensor Example

Example firmware that triggers a Homebridge HTTP motion sensor when a PIR sensor detects motion.

## Setup

1. Open [`sensor.ino`](sensor.ino) and configure:
    - WiFi `ssid` and `password`
    - Static `ip`, `gateway`, `dns`, and `subnet` for your network
    - `motionServer` — IP of the machine running Homebridge
    - `REMOTE_PORT_NUMBER` — must match `sensors[].port` in your Homebridge config
2. Flash the sketch to your ESP8266.
3. Wire the PIR sensor to pin 12 (or change `HCSR501PIN`).

## Authentication (optional)

By default the sketch sends **no** auth header (`AUTH_ENABLED` is `false`). This matches sensors without `sensors[].auth` in Homebridge.

To use Bearer authentication:

1. Add `auth` to the matching sensor in Homebridge (see main [README](../README.md#securing-your-sensors)).
2. In the sketch, set:

```cpp
#define AUTH_ENABLED true
#define AUTH_TOKEN "your-long-random-secret"  // same as sensors[].auth.token
```

For Basic auth or custom headers, configure your HTTP client accordingly — see README `curl` examples.
