# homebridge-http-motion-sensor

This plugin offers you a motion sensor that can be triggerd via an HTTP request. This can be used in conjunction with an ESP8266 for instance or an Arduino with an ethernet shield. I will add an example Arduino script in the future.

## Installation

Run the following command

```
npm install -g homebridge-http-motion-sensor
```

Chances are you are going to need sudo with that.

## Config.json

This is an example configuration

```
"accessories" : [

    {
        "accessory": "http-motion-sensor",
        "name": "Hallway Motion Sensor",
        "port": 18089,
        "serial" : "E642011E3ECB",
        "bind_ip" : "0.0.0.0",
        "repeater" : [
                {
                    "host" : "192.168.2.11",
                    "port" : "22322",
                    "path" : "/turnonscreentilltimeout",
                    "auth" : "username:password"
                }
            ]
    }
]
```

| Key       | Description                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| accessory | Required. Has to be "http-motion-sensor"                                                                                                                                                                                                                                       |
| name      | Required. The name of this accessory. This will appear in your homekit app                                                                                                                                                                                                     |
| port      | Required. The port that you want this plugin to listen on. Choose a number above 1024.                                                                                                                                                                                         |
| serial    | Optional. Assigns a serial number. Not really required but I would advise in making up some arbitrary string.                                                                                                                                                                  |
| repeater  | Optional. Whenever the http server setup by this plugin is hit, it will also make a request to each entry in this array. I am using it to turn on a screen in my hallway. See [this](https://nodejs.org/api/http.html#http_http_get_options_callback) for further information. |
| bind_ip   | Optional. If you know what this is, you'll know what to do with it.                                                                                                                                                                                                            |
