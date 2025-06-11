import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    HAP,
    Logging,
    PlatformConfig,
    Service,
    StaticPlatformPlugin,
} from 'homebridge';
import { createServer, get, Server, RequestOptions } from 'http';
import { HomebridgeHttpMotionSensorConfig } from './types';

const PLATFORM_NAME = 'HttpMotionSensorPlatform';
const PLUGIN_NAME = 'homebridge-http-motion-sensor';

let hap: HAP;

export = (api: API): void => {
    hap = api.hap;
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HttpMotionSensorPlatform);
};

class HttpMotionSensorPlatform implements StaticPlatformPlugin {
    private readonly log: Logging;
    private readonly config: PlatformConfig;
    private readonly api: API;

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.log.info('Initializing HttpMotionSensorPlatform');

        if (!this.config.sensors || !Array.isArray(this.config.sensors)) {
            this.log.error('No sensors configured. Please add sensors array to platform config.');
            return;
        }

        this.log.info(`Found ${this.config.sensors.length} motion sensor(s) to initialize`);
    }

    accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
        const accessories: AccessoryPlugin[] = [];

        for (const sensorConfig of this.config.sensors) {
            try {
                const accessory = new HttpMotionSensorAccessory(this.log, sensorConfig, this.api);
                accessories.push(accessory);
                this.log.info(`Successfully created motion sensor: ${sensorConfig.name}`);
            } catch (error) {
                this.log.error(`Failed to create motion sensor ${sensorConfig.name}: ${error}`);
            }
        }

        callback(accessories);
    }
}

class HttpMotionSensorAccessory implements AccessoryPlugin {
    private readonly log: Logging;
    private readonly config: HomebridgeHttpMotionSensorConfig;
    private readonly api: API;

    private motionDetected: boolean = false;
    private timeout: ReturnType<typeof setTimeout> | null = null;

    private motionSensorService: Service;
    private informationService: Service;

    private server?: Server;
    private readonly bindIP: string;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.config = config as HomebridgeHttpMotionSensorConfig;
        this.api = api;

        if (!this.config.name) {
            throw new Error('Missing required config: name');
        }

        if (!this.config.port) {
            throw new Error('Missing required config: port');
        }

        this.bindIP = this.config.bind_ip ?? '0.0.0.0';

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, 'Homebridge')
            .setCharacteristic(hap.Characteristic.Model, this.config.model ?? 'HTTP Motion Sensor')
            .setCharacteristic(hap.Characteristic.SerialNumber, this.config.serial ?? 'Default-Serial');

        this.motionSensorService = new hap.Service.MotionSensor(this.config.name);
        this.motionSensorService
            .getCharacteristic(hap.Characteristic.MotionDetected)
            .on(CharacteristicEventTypes.GET, this.getState.bind(this));

        this.setupHttpServer();
        this.api.on('shutdown', this.shutdown.bind(this));
    }

    private setupHttpServer(): void {
        this.server = createServer((request, response) => {
            this.httpHandler();
            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end('Successfully requested: ' + request.url);
        });

        this.server.listen(this.config.port!, this.bindIP, () => {
            this.log.info(
                `HTTP Motion Sensor '${this.config.name}' is listening on http://${this.bindIP}:${this.config.port}`,
            );
        });

        this.server.on('error', (error) => {
            this.log.error(`HTTP Server error: ${error.message}`);
        });
    }

    private httpHandler(): void {
        if (this.config.repeater && Array.isArray(this.config.repeater)) {
            for (const repeater of this.config.repeater) {
                const url = `http://${repeater.host}:${repeater.port}${repeater.path}`;
                const options: RequestOptions = {
                    host: repeater.host,
                    port: repeater.port,
                    path: repeater.path,
                    method: 'GET',
                };

                if (repeater.auth) {
                    options.headers = {
                        Authorization: repeater.auth,
                    };
                }

                get(url, (res) => {
                    this.log.debug(`Repeater request to ${url} successful`);
                }).on('error', (error) => {
                    this.log.warn(`Repeater request to ${url} failed: ${error.message}`);
                });
            }
        }

        this.motionDetected = true;
        this.motionSensorService.getCharacteristic(hap.Characteristic.MotionDetected).updateValue(this.motionDetected);

        this.log.debug('Motion detected via HTTP request');

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.motionDetected = false;
            this.motionSensorService
                .getCharacteristic(hap.Characteristic.MotionDetected)
                .updateValue(this.motionDetected);
            this.timeout = null;
            this.log.debug('Motion detection reset');
        }, 11 * 1000);
    }

    private getState(callback: CharacteristicGetCallback): void {
        this.log.debug(`Motion sensor state requested: ${this.motionDetected}`);
        callback(null, this.motionDetected);
    }

    private shutdown(): void {
        if (this.server) {
            this.server.close();
            this.log.info('HTTP server shutdown');
        }

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    getServices(): Service[] {
        return [this.informationService, this.motionSensorService];
    }
}
