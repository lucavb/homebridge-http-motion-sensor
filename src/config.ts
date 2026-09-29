import type { API, PlatformConfig } from 'homebridge';
import { z } from 'zod';

import { PLUGIN_NAME } from './constants.ts';

export const DEFAULT_RESET_TIMEOUT_SECONDS = 11;
/** Disabled by default (0). Set startup_grace_seconds per sensor (e.g. 30) to opt in to the post-restart grace window. */
export const DEFAULT_STARTUP_GRACE_SECONDS = 0;

/** @deprecated Use getMotionResetMs(sensor) instead */
export const MOTION_RESET_MS = DEFAULT_RESET_TIMEOUT_SECONDS * 1000;

const repeaterEntrySchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.coerce.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
    path: z.string().min(1, 'Path is required'),
    auth: z.string().optional(),
});

const bearerAuthSchema = z.object({
    mode: z.literal('bearer'),
    token: z.string().min(1, 'Bearer token is required'),
});

const basicAuthSchema = z.object({
    mode: z.literal('basic'),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});

const headerAuthSchema = z.object({
    mode: z.literal('header'),
    header_name: z.string().min(1, 'Header name is required'),
    header_value: z.string().min(1, 'Header value is required'),
});

const sensorAuthSchema = z.discriminatedUnion('mode', [bearerAuthSchema, basicAuthSchema, headerAuthSchema]);

const optionalSensorAuthSchema = z
    .union([
        sensorAuthSchema,
        z.object({
            mode: z.literal('none'),
        }),
    ])
    .optional()
    .transform((auth) => (auth?.mode === 'none' ? undefined : auth));

const TRIGGER_PATH_REGEX = /^\/[^?#]*$/;
const TRIGGER_PATH_MESSAGE =
    'Trigger path must be a path starting with / and cannot contain query strings (?) or fragments (#)';
const TRIGGER_PATH_URL_STABLE_MESSAGE =
    'Trigger path must be the literal request path: values that URL parsing normalizes away (dot segments, leading double slashes, whitespace, non-ASCII) can never match an incoming request';

function isUrlStableTriggerPath(value: string): boolean {
    try {
        return new URL(value, 'http://localhost').pathname === value;
    } catch {
        return false;
    }
}

const sensorConfigSchema = z.object({
    name: z.string().min(1, 'Sensor name is required'),
    port: z.coerce.number().int().min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535'),
    model: z.string().optional(),
    serial: z.string().optional(),
    bind_ip: z.union([z.ipv4(), z.ipv6()]).optional().or(z.literal('0.0.0.0')),
    reset_timeout: z.coerce.number().int().min(1).max(3600).optional(),
    trigger_path: z
        .string()
        .transform((value) => value.trim())
        .refine((value) => TRIGGER_PATH_REGEX.test(value), TRIGGER_PATH_MESSAGE)
        .refine(isUrlStableTriggerPath, TRIGGER_PATH_URL_STABLE_MESSAGE)
        .optional(),
    startup_grace_seconds: z.coerce.number().int().min(0).max(3600).optional(),
    auth: optionalSensorAuthSchema,
    repeater: z.array(repeaterEntrySchema).optional(),
});

const platformConfigSchema = z.object({
    name: z.string().min(1, 'Platform name is required'),
    platform: z.literal('HttpMotionSensorPlatform'),
    sensors: z.array(sensorConfigSchema).min(1, 'At least one sensor is required'),
});

export type HomebridgeHttpMotionSensorRepeaterEntry = z.infer<typeof repeaterEntrySchema>;
export type SensorAuthConfig = z.infer<typeof sensorAuthSchema>;
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

export function getStartupGraceMs(sensor: HomebridgeHttpMotionSensorConfig): number {
    return (sensor.startup_grace_seconds ?? DEFAULT_STARTUP_GRACE_SECONDS) * 1000;
}

export function sensorRuntimeConfigEqual(
    a: HomebridgeHttpMotionSensorConfig,
    b: HomebridgeHttpMotionSensorConfig,
): boolean {
    return (
        a.port === b.port &&
        (a.bind_ip ?? '0.0.0.0') === (b.bind_ip ?? '0.0.0.0') &&
        (a.reset_timeout ?? DEFAULT_RESET_TIMEOUT_SECONDS) === (b.reset_timeout ?? DEFAULT_RESET_TIMEOUT_SECONDS) &&
        a.trigger_path === b.trigger_path &&
        (a.startup_grace_seconds ?? DEFAULT_STARTUP_GRACE_SECONDS) ===
            (b.startup_grace_seconds ?? DEFAULT_STARTUP_GRACE_SECONDS) &&
        JSON.stringify(a.auth ?? null) === JSON.stringify(b.auth ?? null) &&
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
