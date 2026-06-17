import { describe, expect, it } from 'vitest';

import { MOTION_RESET_MS, PlatformOptions, parsePlatformConfig } from './config.ts';

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

describe('MOTION_RESET_MS', () => {
    it('uses an 11 second motion reset window', () => {
        expect(MOTION_RESET_MS).toBe(11_000);
    });
});
