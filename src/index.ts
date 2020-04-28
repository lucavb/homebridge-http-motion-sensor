import {Characteristic, CharacteristicEventTypes, CharacteristicGetCallback} from 'hap-nodejs';
import {MotionSensor} from 'hap-nodejs/dist/lib/gen/HomeKit';
import http from 'http';
import {API, Logging} from 'homebridge';
import {HomebridgeAccessory} from 'homebridge-ts-helper';
import {HomebridgeHttpMotionSensorConfig} from './types';

export default (homebridge: API): void => {
    homebridge.registerAccessory('homebridge-http-motion-sensor', 'http-motion-sensor', HomebridgeHttpMotionSensor);
};

class HomebridgeHttpMotionSensor extends HomebridgeAccessory {
    private motionDetected: boolean = false;

    private timeout: NodeJS.Timeout | null = null;

    private motionSensorService!: MotionSensor;

    private server: http.Server;

    // eslint-disable-next-line camelcase
    private readonly bind_ip: string;

    constructor(protected log: Logging, protected config: HomebridgeHttpMotionSensorConfig) {
        super(log, config);
        this.prepareServices();
        this.bind_ip = config.bind_ip || '0.0.0.0';
        this.server = http.createServer((request, response) => {
            this.httpHandler();
            response.end('Successfully requested: ' + request.url);
        });

        this.server.listen(this.config.port, this.bind_ip, () => {
            this.log(`The device '${this.config.name}' can now be reached under http://${this.bind_ip}:${this.config.port}`);
        });
    }

    private prepareServices() {
        this.motionSensorService = new MotionSensor(this.config.name);
        this.motionSensorService.getCharacteristic(Characteristic.MotionDetected)
            ?.on(CharacteristicEventTypes.GET, this.getState.bind(this));
        this.services.push(this.motionSensorService);
    }

    private httpHandler() {
        if (this.config.repeater) {
            for (const repeater of this.config.repeater) {
                http.get(repeater, (res) => {
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
}
