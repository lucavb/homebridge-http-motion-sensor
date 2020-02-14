import http from 'http';
import { Characteristic, Service, CharacteristicEventTypes, CharacteristicGetCallback } from 'hap-nodejs';
import { HomebridgeHttpMotionSensorConfig } from './types';
import { AccessoryInformation, MotionSensor } from 'hap-nodejs/dist/lib/gen/HomeKit';

export default function (homebridge: any): void {
    homebridge.registerAccessory("homebridge-http-motion-sensor", "http-motion-sensor", HomebridgeHttpMotionSensor);
};

class HomebridgeHttpMotionSensor {

    private motionDetected: boolean = false;

    private timeout: NodeJS.Timeout | null = null;

    private readonly services: Service[] = [];

    private motionSensorService!: MotionSensor;

    constructor(private log: any, private config: HomebridgeHttpMotionSensorConfig) {
        this.prepareServices();
        http.createServer((request, response) => {
            this.httpHandler();
            response.end('Successfully requested: ' + request.url);
        });
    }

    private prepareServices() {
        // info service
        const informationService = new AccessoryInformation(this.config.name, 'httpmotionsensor_info');

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "PIR Manufacturer")
            .setCharacteristic(Characteristic.Model, this.config.model || "HC-SR501")
            .setCharacteristic(Characteristic.SerialNumber, this.config.serial || "4BD53931-D4A9-4850-8E7D-8A51A842FA29");
        this.services.push(informationService);

        this.motionSensorService = new MotionSensor(this.config.name, 'httpmotionsensor');
        this.motionSensorService.getCharacteristic(Characteristic.MotionDetected)?.
            on(CharacteristicEventTypes.GET, this.getState.bind(this));
        this.services.push(this.motionSensorService);
    }

    private httpHandler() {
        if (this.config.repeater) {
            for (const repeater of this.config.repeater) {
                http.get(repeater, function (res) {
                    // one could do something with this information
                });
            }
        }

        this.motionDetected = true;
        this.motionSensorService.getCharacteristic(Characteristic.MotionDetected)?.updateValue(this.motionDetected);
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.motionDetected = false;
            this.motionSensorService.getCharacteristic(Characteristic.MotionDetected)?.updateValue(this.motionDetected);
            this.timeout = null;
        }, 11 * 1000);
    };

    private getState(callback: CharacteristicGetCallback) {
        callback(null, this.motionDetected);
    }

    public getServices(): Service[] {
        return this.services;
    }

}
