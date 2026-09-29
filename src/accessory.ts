import type { API, Logging, PlatformAccessory, Service } from 'homebridge';
import { createServer, get, type IncomingMessage, type RequestOptions, type Server, type ServerResponse } from 'http';

import { getAuthStatusMessage, isAuthEnabled, validateInboundAuth } from './auth.ts';
import {
    type HomebridgeHttpMotionSensorConfig,
    type HomebridgeHttpMotionSensorRepeaterEntry,
    type SensorAccessoryContext,
    getMotionResetMs,
    getStartupGraceMs,
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

export function isWithinStartupGrace(startTimeMs: number | undefined, graceMs: number, nowMs: number): boolean {
    return graceMs > 0 && startTimeMs !== undefined && nowMs - startTimeMs < graceMs;
}

export function matchesTriggerPath(triggerPath: string | undefined, url: string | undefined): boolean {
    if (!triggerPath) {
        return true;
    }

    let pathname: string;
    try {
        pathname = new URL(url ?? '/', 'http://localhost').pathname;
    } catch {
        // Malformed request targets (e.g. absolute-form URLs with out-of-range
        // ports that Node's HTTP parser accepts but the URL parser rejects)
        // must not throw out of the request listener; treat them as non-matches.
        return false;
    }

    return pathname === triggerPath;
}

function requestPathname(request: IncomingMessage): string {
    try {
        return new URL(request.url ?? '/', 'http://localhost').pathname;
    } catch {
        // Malformed request targets can pass Node's HTTP parser but fail URL
        // parsing; fall back to the raw target so logs still identify the request.
        return request.url ?? '/';
    }
}

/**
 * Shared log descriptor for per-request log lines. Query strings are excluded by
 * default so sender tokens embedded in URLs never reach persisted logs.
 */
export function describeRequest(request: IncomingMessage, includeQuery = false): string {
    const target = includeQuery ? (request.url ?? '/') : requestPathname(request);
    return `${request.socket.remoteAddress ?? 'unknown'} ${request.method ?? 'GET'} ${target}`;
}

export class HttpMotionSensorAccessory {
    private motionDetected = false;
    private timeout: ReturnType<typeof setTimeout> | null = null;

    private motionSensorService?: Service;
    private server?: Server;
    private config: HomebridgeHttpMotionSensorConfig;
    private readonly bindIP: string;
    // Monotonic ms (performance.now()) at listener start. A monotonic clock keeps the
    // grace window stable across wall-clock steps (e.g. NTP sync after a power-loss boot).
    private serverStartedAt: number | undefined;

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
            this.handleHttpRequest(request, response);
        });

        this.server.listen(this.config.port, this.bindIP, () => {
            this.serverStartedAt = performance.now();
            this.log.info(
                `HTTP Motion Sensor '${this.config.name}' is listening on http://${this.bindIP}:${this.config.port}`,
            );

            if (this.config.auth) {
                this.log.debug(
                    `HTTP Motion Sensor '${this.config.name}': authentication enabled (${getAuthStatusMessage(this.config.auth)})`,
                );
            }
        });

        this.server.on('error', (error) => {
            this.log.error(`HTTP Server error: ${error.message}`);
        });
    }

    private handleHttpRequest(request: IncomingMessage, response: ServerResponse): void {
        if (isAuthEnabled(this.config.auth) && !validateInboundAuth(request, this.config.auth)) {
            this.log.warn(
                `Rejected unauthenticated request to '${this.config.name}' from ${request.socket.remoteAddress ?? 'unknown'}`,
            );
            response.writeHead(401, { 'Content-Type': 'text/plain' });
            response.end('Unauthorized');
            return;
        }

        if (isWithinStartupGrace(this.serverStartedAt, getStartupGraceMs(this.config), performance.now())) {
            this.log.warn(
                `Ignored request during startup grace period for '${this.config.name}' from ${describeRequest(request)}`,
            );
            response.writeHead(503, { 'Content-Type': 'text/plain' });
            response.end('Service unavailable during startup grace period');
            return;
        }

        if (!matchesTriggerPath(this.config.trigger_path, request.url)) {
            this.log.debug(
                `Ignored request to non-matching path for '${this.config.name}' from ${describeRequest(request)}`,
            );
            response.writeHead(404, { 'Content-Type': 'text/plain' });
            response.end('Not Found');
            return;
        }

        this.httpHandler(request);
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('Successfully requested: ' + request.url);
    }

    private httpHandler(request: IncomingMessage): void {
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

        this.setMotionDetected(true, request);

        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
            this.setMotionDetected(false);
            this.timeout = null;
            this.log.debug('Motion detection reset');
        }, getMotionResetMs(this.config));
    }

    private setMotionDetected(detected: boolean, request?: IncomingMessage): void {
        this.motionDetected = detected;

        if (!this.motionSensorService) {
            return;
        }

        this.motionSensorService
            .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
            .updateValue(this.motionDetected);

        if (detected) {
            const requestDescriptor = request ? ` from ${describeRequest(request, true)}` : '';
            this.log.debug(`Motion detected via HTTP request${requestDescriptor}`);
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
