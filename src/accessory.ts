import type { API, Logging, PlatformAccessory, Service } from 'homebridge';
import { createServer, get, type RequestOptions, type Server } from 'http';

import {
    type HomebridgeHttpMotionSensorConfig,
    type HomebridgeHttpMotionSensorRepeaterEntry,
    type SensorAccessoryContext,
    getMotionResetMs,
    sensorRuntimeConfigEqual,
} from './config.ts';

export function buildRepeaterRequestOptions(repeater: HomebridgeHttpMotionSensorRepeaterEntry): RequestOptions {
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

    return options;
}

export class HttpMotionSensorAccessory {
    private motionDetected = false;
    private timeout: ReturnType<typeof setTimeout> | null = null;

    private motionSensorService?: Service;
    private server?: Server;
    private config: HomebridgeHttpMotionSensorConfig;
    private readonly bindIP: string;

    constructor(
        private readonly log: Logging,
        config: HomebridgeHttpMotionSensorConfig,
        private readonly platformAccessory: PlatformAccessory<SensorAccessoryContext>,
        private readonly api: API,
    ) {
        this.config = config;
        this.bindIP = this.config.bind_ip ?? '0.0.0.0';
        this.platformAccessory.context.sensor = this.config;

        this.setupServices();
        this.setupHttpServer();
    }

    hasSameRuntimeConfig(config: HomebridgeHttpMotionSensorConfig): boolean {
        return sensorRuntimeConfigEqual(this.config, config);
    }

    updateMetadata(config: HomebridgeHttpMotionSensorConfig): void {
        this.config = config;
        this.platformAccessory.context.sensor = config;

        const hap = this.api.hap;
        const informationService = this.platformAccessory.getService(hap.Service.AccessoryInformation);
        informationService
            ?.setCharacteristic(hap.Characteristic.Model, config.model ?? 'HTTP Motion Sensor')
            .setCharacteristic(hap.Characteristic.SerialNumber, config.serial ?? 'Default-Serial');
    }

    private setupServices(): void {
        const hap = this.api.hap;

        let informationService = this.platformAccessory.getService(hap.Service.AccessoryInformation);
        if (!informationService) {
            informationService = new hap.Service.AccessoryInformation();
            this.platformAccessory.addService(informationService);
        }

        informationService
            .setCharacteristic(hap.Characteristic.Manufacturer, 'Homebridge')
            .setCharacteristic(hap.Characteristic.Model, this.config.model ?? 'HTTP Motion Sensor')
            .setCharacteristic(hap.Characteristic.SerialNumber, this.config.serial ?? 'Default-Serial');

        let motionSensorService = this.platformAccessory.getService(hap.Service.MotionSensor);
        if (!motionSensorService) {
            motionSensorService = new hap.Service.MotionSensor(this.config.name);
            this.platformAccessory.addService(motionSensorService);
        }

        motionSensorService.getCharacteristic(hap.Characteristic.MotionDetected).onGet(() => this.motionDetected);
        this.motionSensorService = motionSensorService;
    }

    private setupHttpServer(): void {
        this.server = createServer((request, response) => {
            this.httpHandler();
            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end('Successfully requested: ' + request.url);
        });

        this.server.listen(this.config.port, this.bindIP, () => {
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
                const options = buildRepeaterRequestOptions(repeater);
                const url = `http://${repeater.host}:${repeater.port}${repeater.path}`;

                get(options, () => {
                    this.log.debug(`Repeater request to ${url} successful`);
                }).on('error', (error) => {
                    this.log.warn(`Repeater request to ${url} failed: ${error.message}`);
                });
            }
        }

        this.setMotionDetected(true);

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.setMotionDetected(false);
            this.timeout = null;
            this.log.debug('Motion detection reset');
        }, getMotionResetMs(this.config));
    }

    private setMotionDetected(detected: boolean): void {
        this.motionDetected = detected;

        if (!this.motionSensorService) {
            return;
        }

        this.motionSensorService
            .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
            .updateValue(this.motionDetected);

        if (detected) {
            this.log.debug('Motion detected via HTTP request');
        }
    }

    shutdown(): Promise<void> {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (!this.server) {
            return Promise.resolve();
        }

        const server = this.server;
        this.server = undefined;

        return new Promise((resolve) => {
            server.close(() => {
                this.log.info(`HTTP server shutdown for '${this.config.name}'`);
                resolve();
            });
        });
    }
}
