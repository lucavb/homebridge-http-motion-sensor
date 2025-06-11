import { AccessoryPlugin, API, Logging, StaticPlatformPlugin } from 'homebridge';
import { HttpMotionSensorPlatformConfig, platformConfigSchema } from './schemas';
import { HttpMotionSensorAccessory } from './accessory';

export class HttpMotionSensorPlatform implements StaticPlatformPlugin {
    private readonly config: HttpMotionSensorPlatformConfig;

    constructor(
        private readonly log: Logging,
        config: unknown,
        private readonly api: API,
    ) {
        this.log.info('Initializing HttpMotionSensorPlatform');

        const result = platformConfigSchema.safeParse(config);
        if (!result.success) {
            this.log.error('Invalid platform configuration:');
            result.error.issues.forEach((issue) => {
                this.log.error(`${issue.path.join('.')}: ${issue.message}`);
            });
            throw new Error('Platform configuration validation failed');
        }

        this.config = result.data;
        this.log.info(`Found ${this.config.sensors.length} motion sensor(s) to initialize`);
    }

    accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
        const accessories: AccessoryPlugin[] = [];

        for (const sensorConfig of this.config.sensors) {
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
