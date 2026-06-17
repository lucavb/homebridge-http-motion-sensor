import type { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';

import { HttpMotionSensorAccessory } from './accessory.ts';
import { PLATFORM_NAME, PLUGIN_NAME } from './constants.ts';
import {
    type HomebridgeHttpMotionSensorConfig,
    type SensorAccessoryContext,
    PlatformOptions,
    buildSensorUuid,
} from './config.ts';

export class HttpMotionSensorPlatform implements DynamicPlatformPlugin {
    private readonly options: PlatformOptions;
    private readonly cachedAccessories = new Map<string, PlatformAccessory<SensorAccessoryContext>>();
    private readonly handlers = new Map<string, HttpMotionSensorAccessory>();

    constructor(
        private readonly log: Logging,
        config: PlatformConfig,
        private readonly api: API,
    ) {
        this.log.info('Initializing HttpMotionSensorPlatform');

        try {
            this.options = new PlatformOptions(config);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log.error(`Invalid platform configuration: ${message}`);
            throw error;
        }

        this.log.info(`Found ${this.options.sensors.length} motion sensor(s) in configuration`);

        this.api.on('didFinishLaunching', () => {
            void this.syncSensorsFromConfig();
        });

        this.api.on('shutdown', () => {
            void this.shutdownHandlers();
        });
    }

    configureAccessory(accessory: PlatformAccessory): void {
        const platformAccessory = accessory as PlatformAccessory<SensorAccessoryContext>;
        this.cachedAccessories.set(accessory.UUID, platformAccessory);
        this.log.debug(`Loaded cached accessory: ${accessory.displayName} (${accessory.UUID})`);

        const sensorConfig = this.findSensorConfigByUuid(accessory.UUID);
        if (!sensorConfig) {
            this.log.warn(
                `Cached accessory '${accessory.displayName}' does not match any sensor in config — will be removed on sync`,
            );
            return;
        }

        void this.attachHandler(sensorConfig, platformAccessory, { source: 'cache' });
    }

    private findSensorConfigByUuid(uuid: string): HomebridgeHttpMotionSensorConfig | undefined {
        return this.options.sensors.find((sensor) => buildSensorUuid(this.api, sensor) === uuid);
    }

    private updateAccessoryDisplayName(accessory: PlatformAccessory, name: string): void {
        if (accessory.displayName !== name) {
            accessory.updateDisplayName(name);
        }
    }

    private async shutdownHandlers(): Promise<void> {
        await Promise.all([...this.handlers.values()].map((handler) => handler.shutdown()));
        this.handlers.clear();
    }

    private async attachHandler(
        sensorConfig: HomebridgeHttpMotionSensorConfig,
        platformAccessory: PlatformAccessory<SensorAccessoryContext>,
        options: { source: 'cache' | 'sync' },
    ): Promise<boolean> {
        const uuid = buildSensorUuid(this.api, sensorConfig);
        const existingHandler = this.handlers.get(uuid);

        if (existingHandler?.hasSameRuntimeConfig(sensorConfig)) {
            existingHandler.updateMetadata(sensorConfig);
            this.updateAccessoryDisplayName(platformAccessory, sensorConfig.name);
            return true;
        }

        if (existingHandler) {
            await existingHandler.shutdown();
            this.handlers.delete(uuid);
        }

        try {
            const handler = new HttpMotionSensorAccessory(this.log, sensorConfig, platformAccessory, this.api);
            this.handlers.set(uuid, handler);
            this.updateAccessoryDisplayName(platformAccessory, sensorConfig.name);

            if (options.source === 'cache') {
                this.log.info(`Restored motion sensor from cache: ${sensorConfig.name}`);
            }

            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log.error(`Failed to create motion sensor ${sensorConfig.name}: ${message}`);
            return false;
        }
    }

    private async syncSensorsFromConfig(): Promise<void> {
        const expectedUuids = new Set<string>();
        const newAccessories: PlatformAccessory<SensorAccessoryContext>[] = [];

        for (const sensorConfig of this.options.sensors) {
            const uuid = buildSensorUuid(this.api, sensorConfig);
            expectedUuids.add(uuid);

            let platformAccessory = this.cachedAccessories.get(uuid);
            const isNew = !platformAccessory;

            if (!platformAccessory) {
                const PlatformAccessoryClass = this.api.platformAccessory;
                platformAccessory = new PlatformAccessoryClass(
                    sensorConfig.name,
                    uuid,
                ) as PlatformAccessory<SensorAccessoryContext>;
                this.cachedAccessories.set(uuid, platformAccessory);
            }

            if (this.handlers.has(uuid)) {
                const handler = this.handlers.get(uuid)!;
                if (handler.hasSameRuntimeConfig(sensorConfig)) {
                    handler.updateMetadata(sensorConfig);
                    this.updateAccessoryDisplayName(platformAccessory, sensorConfig.name);
                } else {
                    await this.attachHandler(sensorConfig, platformAccessory, { source: 'sync' });
                }
                continue;
            }

            const attached = await this.attachHandler(sensorConfig, platformAccessory, { source: 'sync' });
            if (!attached) {
                if (isNew) {
                    this.cachedAccessories.delete(uuid);
                }
                continue;
            }

            if (isNew) {
                newAccessories.push(platformAccessory);
                this.log.info(`Successfully created motion sensor: ${sensorConfig.name}`);
            }
        }

        if (newAccessories.length > 0) {
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);
        }

        const staleAccessories: PlatformAccessory<SensorAccessoryContext>[] = [];

        for (const [uuid, accessory] of this.cachedAccessories) {
            if (!expectedUuids.has(uuid)) {
                staleAccessories.push(accessory);
            }
        }

        if (staleAccessories.length > 0) {
            await Promise.all(
                staleAccessories.map(async (accessory) => {
                    const handler = this.handlers.get(accessory.UUID);
                    if (handler) {
                        await handler.shutdown();
                        this.handlers.delete(accessory.UUID);
                    }
                }),
            );

            for (const accessory of staleAccessories) {
                this.cachedAccessories.delete(accessory.UUID);
                this.log.info(`Removing motion sensor no longer in config: ${accessory.displayName}`);
            }

            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
        }
    }
}
