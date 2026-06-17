import type { API } from 'homebridge';
import { describe, expect, it } from 'vitest';

import {
    buildSensorUuid,
    DEFAULT_RESET_TIMEOUT_SECONDS,
    getMotionResetMs,
    MOTION_RESET_MS,
    PlatformOptions,
    parsePlatformConfig,
    sensorRuntimeConfigEqual,
} from './config.ts';
import { PLUGIN_NAME } from './constants.ts';

function createMockApi(): API {
    return {
        hap: {
            uuid: {
                generate: (input: string) => `uuid-for-${input}`,
            },
        },
    } as unknown as API;
}

describe('PlatformOptions', () => {
    const validConfig = {
        platform: 'HttpMotionSensorPlatform',
        name: 'HTTP Motion Sensor Platform',
        sensors: [
            {
                name: 'Hallway',
                port: 18089,
            },
        ],
    };

    it('parses a valid platform configuration', () => {
        const options = new PlatformOptions(validConfig);

        expect(options.name).toBe('HTTP Motion Sensor Platform');
        expect(options.sensors).toHaveLength(1);
        expect(options.sensors[0]?.name).toBe('Hallway');
        expect(options.sensors[0]?.port).toBe(18089);
    });

    it('coerces string ports to numbers', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [{ name: 'Kitchen', port: '19000' }],
        });

        expect(options.sensors[0]?.port).toBe(19000);
    });

    it('parses optional reset_timeout', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [{ name: 'Hallway', port: 18089, reset_timeout: '30' }],
        });

        expect(options.sensors[0]?.reset_timeout).toBe(30);
    });

    it('rejects reset_timeout below 1', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, reset_timeout: 0 }],
                }),
        ).toThrow();
    });

    it('rejects reset_timeout above 3600', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, reset_timeout: 3601 }],
                }),
        ).toThrow();
    });

    it('rejects an empty sensors array', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [],
                }),
        ).toThrow(/At least one sensor is required/);
    });

    it('rejects ports below 1024', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Bad Port', port: 80 }],
                }),
        ).toThrow();
    });

    it('rejects missing platform name', () => {
        expect(
            () =>
                new PlatformOptions({
                    platform: 'HttpMotionSensorPlatform',
                    name: '',
                    sensors: [{ name: 'Hallway', port: 18089 }],
                }),
        ).toThrow();
    });
});

describe('parsePlatformConfig', () => {
    it('exports parsed config for tests and tooling', () => {
        const config = parsePlatformConfig({
            platform: 'HttpMotionSensorPlatform',
            name: 'Test Platform',
            sensors: [{ name: 'Garden', port: 18090, serial: 'ABC123' }],
        });

        expect(config.sensors[0]?.serial).toBe('ABC123');
    });
});

describe('buildSensorUuid', () => {
    const api = createMockApi();

    it('prefers serial over name in the identity string', () => {
        const uuid = buildSensorUuid(api, {
            name: 'Hallway',
            port: 18089,
            serial: 'E642011E3ECB',
        });

        expect(uuid).toBe(`uuid-for-${PLUGIN_NAME}:E642011E3ECB:18089`);
    });

    it('falls back to name when serial is not set', () => {
        const uuid = buildSensorUuid(api, {
            name: 'Hallway',
            port: 18089,
        });

        expect(uuid).toBe(`uuid-for-${PLUGIN_NAME}:Hallway:18089`);
    });

    it('includes port in the identity string', () => {
        const uuidA = buildSensorUuid(api, { name: 'Hallway', port: 18089 });
        const uuidB = buildSensorUuid(api, { name: 'Hallway', port: 18090 });

        expect(uuidA).not.toBe(uuidB);
    });
});

describe('getMotionResetMs', () => {
    it('defaults to 11 seconds', () => {
        expect(getMotionResetMs({ name: 'Hallway', port: 18089 })).toBe(11_000);
        expect(DEFAULT_RESET_TIMEOUT_SECONDS).toBe(11);
        expect(MOTION_RESET_MS).toBe(11_000);
    });

    it('uses configured reset_timeout in seconds', () => {
        expect(getMotionResetMs({ name: 'Hallway', port: 18089, reset_timeout: 5 })).toBe(5_000);
    });
});

describe('sensorRuntimeConfigEqual', () => {
    const base = { name: 'Hallway', port: 18089, bind_ip: '0.0.0.0' as const };

    it('treats matching runtime fields as equal even when name differs', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, name: 'Renamed Hallway' })).toBe(true);
    });

    it('detects port changes', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, port: 18090 })).toBe(false);
    });

    it('detects reset_timeout changes', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, reset_timeout: 30 })).toBe(false);
    });
});
