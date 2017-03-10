// wifi

#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <ArduinoOTA.h>

const char* ssid = "<your ssid (wifi name) goes here>";
const char* password = "<your wifi password goes here>";

IPAddress ip(192, 168, 22, 221); // the ip address of your ESP8266
IPAddress dns(192, 168, 22, 1); // the ip address of your DNS server. Mostlikely the same as gateway
IPAddress gateway(192, 168, 22, 1); // the ip of your gateway.
IPAddress subnet(255, 255, 255, 0); // probably this. if not you will know what this is anyway

// motion sensor

WiFiClient client;
/*
    The IP address of your Raspberry Pi or where ever you are running the plugin
*/
IPAddress motionServer(192, 168, 22, 220);

/*
    The port number you assigned to the plugin
*/
#define REMOTE_PORT_NUMBER 10200

/*
    the time you want to wait until this calls your raspberry pi again
    I find 10.000 ms (10 s) to be reasonable. 
*/
#define TIMESPAN_MOTION 10000 
/*
    The pin where you connect the motion sensor to the ESP8266
*/
#define HCSR501PIN 12;
unsigned long lastMotionDetected = -1;


void setup() {
    Serial.begin(9600);

    while (!Serial); // wait for serial attach
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    WiFi.config(ip, dns, gateway, subnet);
    if (WiFi.waitForConnectResult() != WL_CONNECTED) {
        Serial.println("WiFi Connect Failed! Rebooting...");
        delay(1000);
        ESP.restart();
    }
    ArduinoOTA.begin();

    pinMode(hcsr501pin, INPUT);
}

void loop() {
    ArduinoOTA.handle();

    int buttonState = digitalRead(hcsr501pin);

    unsigned long now = millis();
    if (buttonState == 1 && (now - lastMotionDetected) > TIMESPAN_MOTION){
        lastMotionDetected = now;
        Serial.println("Motion detected");
        if (client.connect(motionServer, REMOTE_PORT_NUMBER)) {
            Serial.println("connected");
            // Make a HTTP request:
            client.println("GET /motion HTTP/1.1");
            client.println();
        }
    }
}