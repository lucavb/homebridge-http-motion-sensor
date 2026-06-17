import type { API, PlatformConfig } from 'homebridge';
import { z } from 'zod';

import { PLUGIN_NAME } from './constants.ts';

export const DEFAULT_RESET_TIMEOUT_SECONDS = 11;

/** @deprecated Use getMotionResetMs(sensor) instead */
export const MOTION_RESET_MS = DEFAULT_RESET_TIMEOUT_SECONDS * 1000;

const repeaterEntrySchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.coerce.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
    path: z.string().min(1, 'Path is required'),
    auth: z.string().optional(),
});

const sensorConfigSchema = z.object({
    name: z.string().min(1, 'Sensor name is required'),
    port: z.coerce.number().int().min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535'),
    model: z.string().optional(),
    serial: z.string().optional(),
    bind_ip: z.union([z.ipv4(), z.ipv6()]).optional().or(z.literal('0.0.0.0')),
    reset_timeout: z.coerce.number().int().min(1).max(3600).optional(),
    repeater: z.array(repeaterEntrySchema).optional(),
});

const platformConfigSchema = z.object({
    name: z.string().min(1, 'Platform name is required'),
    platform: z.literal('HttpMotionSensorPlatform'),
    sensors: z.array(sensorConfigSchema).min(1, 'At least one sensor is required'),
});

export type HomebridgeHttpMotionSensorRepeaterEntry = z.infer<typeof repeaterEntrySchema>;
export type HomebridgeHttpMotionSensorConfig = z.infer<typeof sensorConfigSchema>;
export type HttpMotionSensorPlatformConfig = z.infer<typeof platformConfigSchema>;

export interface SensorAccessoryContext {
    sensor: HomebridgeHttpMotionSensorConfig;
}

export function buildSensorUuid(api: API, sensor: HomebridgeHttpMotionSensorConfig): string {
    const identity = sensor.serial ?? sensor.name;
    return api.hap.uuid.generate(`${PLUGIN_NAME}:${identity}:${sensor.port}`);
}

export function getMotionResetMs(sensor: HomebridgeHttpMotionSensorConfig): number {
    return (sensor.reset_timeout ?? DEFAULT_RESET_TIMEOUT_SECONDS) * 1000;
}

export function sensorRuntimeConfigEqual(
    a: HomebridgeHttpMotionSensorConfig,
    b: HomebridgeHttpMotionSensorConfig,
): boolean {
    return (
        a.port === b.port &&
        (a.bind_ip ?? '0.0.0.0') === (b.bind_ip ?? '0.0.0.0') &&
        (a.reset_timeout ?? DEFAULT_RESET_TIMEOUT_SECONDS) === (b.reset_timeout ?? DEFAULT_RESET_TIMEOUT_SECONDS) &&
        JSON.stringify(a.repeater ?? []) === JSON.stringify(b.repeater ?? [])
    );
}

export class PlatformOptions {
    readonly name: string;
    readonly sensors: HomebridgeHttpMotionSensorConfig[];

    constructor(config: PlatformConfig) {
        const result = platformConfigSchema.safeParse(config);
        if (!result.success) {
            const messages = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
            throw new Error(`Platform configuration validation failed: ${messages.join('; ')}`);
        }

        this.name = result.data.name;
        this.sensors = result.data.sensors;
    }
}

export function parsePlatformConfig(config: unknown): HttpMotionSensorPlatformConfig {
    return platformConfigSchema.parse(config);
}
