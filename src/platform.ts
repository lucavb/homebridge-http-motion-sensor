import type { AccessoryPlugin, API, Logging, PlatformConfig, StaticPlatformPlugin } from 'homebridge';

import { HttpMotionSensorAccessory } from './accessory.ts';
import { PlatformOptions } from './config.ts';

/**
 * The name of this plugin.
 */
export const PLUGIN_NAME = 'homebridge-http-motion-sensor';

/**
 * The name of this homebridge platform.
 */
export const PLATFORM_NAME = 'HttpMotionSensorPlatform';

export class HttpMotionSensorPlatform implements StaticPlatformPlugin {
    private readonly options: PlatformOptions;

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

        this.log.warn(
            'homebridge-http-motion-sensor v3.0.0 will migrate to DynamicPlatformPlugin. ' +
                'Accessory UUIDs will change — watch the release notes before upgrading to v3.',
        );

        this.log.info(`Found ${this.options.sensors.length} motion sensor(s) to initialize`);
    }

    accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
        const accessories: AccessoryPlugin[] = [];

        for (const sensorConfig of this.options.sensors) {
            try {
                const accessory = new HttpMotionSensorAccessory(this.log, sensorConfig, this.api, this.api.hap);
                accessories.push(accessory);
                this.log.info(`Successfully created motion sensor: ${sensorConfig.name}`);
            } catch (error) {
                this.log.error(`Failed to create motion sensor ${sensorConfig.name}: ${error}`);
            }
        }

        callback(accessories);
    }
}
