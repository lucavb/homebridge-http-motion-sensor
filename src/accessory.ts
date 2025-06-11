import {
    AccessoryPlugin,
    API,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    HAP,
    Logging,
    Service,
} from 'homebridge';
import { createServer, get, RequestOptions, Server } from 'http';
import { HomebridgeHttpMotionSensorConfig, sensorConfigSchema } from './schemas';

export class HttpMotionSensorAccessory implements AccessoryPlugin {
    private readonly config: HomebridgeHttpMotionSensorConfig;

    private motionDetected: boolean = false;
    private timeout: ReturnType<typeof setTimeout> | null = null;

    private readonly motionSensorService: Service;
    private readonly informationService: Service;

    private server?: Server;
    private readonly bindIP: string;

    constructor(
        private readonly log: Logging,
        config: unknown,
        private readonly api: API,
        hap: HAP,
    ) {
        const result = sensorConfigSchema.safeParse(config);
        if (!result.success) {
            this.log.error('Invalid sensor configuration:');
            result.error.issues.forEach((issue) => {
                this.log.error(`${issue.path.join('.')}: ${issue.message}`);
            });
            throw new Error('Sensor configuration validation failed');
        }

        this.config = result.data;
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
        this.motionSensorService
            .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
            .updateValue(this.motionDetected);

        this.log.debug('Motion detected via HTTP request');

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.motionDetected = false;
            this.motionSensorService
                .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
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
