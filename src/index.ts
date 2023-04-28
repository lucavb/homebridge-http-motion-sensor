import {Characteristic, CharacteristicEventTypes, CharacteristicGetCallback} from 'hap-nodejs';
import {Server, get, createServer} from 'http';
import {API, Logging} from 'homebridge';
import {HomebridgeAccessory} from 'homebridge-ts-helper';
import {HomebridgeHttpMotionSensorConfig, validationConfig} from './types';
import {validateConfig} from 'homebridge-ts-helper/dist/configValidator';
import {MotionSensor} from 'hap-nodejs/dist/lib/gen/HomeKit';

let MotionSensorConstructor: typeof MotionSensor;

export default (homebridge: API): void => {
    MotionSensorConstructor = homebridge.hap.Service.MotionSensor;
    homebridge.registerAccessory('homebridge-http-motion-sensor', 'http-motion-sensor', HomebridgeHttpMotionSensor);
};

class HomebridgeHttpMotionSensor extends HomebridgeAccessory {

    private motionDetected: boolean = false;

    private timeout: NodeJS.Timeout | null = null;

    private motionSensorService!: MotionSensor;

    private server?: Server;

    private readonly bindIP?: string;

    constructor(protected readonly log: Logging,
                protected readonly config: HomebridgeHttpMotionSensorConfig,
                protected readonly api: API) {
        super(log, config);
        const result = validateConfig(this.config, validationConfig);
        if (!result.valid) {
            this.log.error('The config for this plugin is not correct, please check these offenses', result.offenses);
            return;
        }
        this.prepareServices();
        this.bindIP = config.bind_ip ?? '0.0.0.0';
        this.server = createServer((request, response) => {
            this.httpHandler();
            response.end('{"Successfully requested": ' + '"' + request.url + '"}');
        });

        this.server.listen(this.config.port!, this.bindIP, () => {
            this.log(`The device '${this.config.name}' can now be reached under http://${this.bindIP}:${this.config.port}`);
        });

        this.api.on('shutdown', () => {
            this.server!.close();
        });
    }

    private prepareServices() {
        this.motionSensorService = new MotionSensorConstructor(this.config.name);
        this.motionSensorService.getCharacteristic(Characteristic.MotionDetected)
            ?.on(CharacteristicEventTypes.GET, this.getState.bind(this));
        this.services.push(this.motionSensorService);
    }

    private httpHandler() {
        if (this.config.repeater) {
            for (const repeater of this.config.repeater) {
                get(repeater).on('error', (e) => {
                    this.log.warn(`a repeater request to the host ${repeater.host} failed. Please see this error: ${e.message}`);
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
