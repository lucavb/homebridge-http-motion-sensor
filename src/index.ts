import http from 'http';
import { Characteristic, Service, CharacteristicEventTypes, CharacteristicGetCallback } from 'hap-nodejs';
import { HomebridgeHttpMotionSensorConfig } from './types';
import { MotionSensor } from 'hap-nodejs/dist/lib/gen/HomeKit';

let homebridgeService;

export default function (homebridge: any): void {
    homebridgeService = homebridge.hap.Service;

    homebridge.registerAccessory("homebridge-http-motion-sensor", "http-motion-sensor", HomebridgeHttpMotionSensor);
};

class HomebridgeHttpMotionSensor {

    private motionDetected: boolean = false;

    private timeout: NodeJS.Timeout | null = null;

    private readonly services: Service[] = [];

    private motionSensorService!: MotionSensor;

    private server: http.Server;

    private bind_ip: string;

    constructor(private log: any, private config: HomebridgeHttpMotionSensorConfig) {
        this.prepareServices();
        this.bind_ip = config.bind_ip || "0.0.0.0";
        this.server = http.createServer((request, response) => {
            this.httpHandler();
            response.end('Successfully requested: ' + request.url);
        });

        this.server.listen(this.config.port, this.bind_ip, () => {
            this.log(`The device '${this.config.name}' is can now be reached under http://${this.bind_ip}:${this.config.port}`);
        });
    }

    private prepareServices() {
        this.motionSensorService = new homebridgeService.MotionSensor(this.config.name, 'httpmotionsensor');
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
