import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { API } from 'homebridge';
import { describe, expect, it } from 'vitest';

import {
    buildSensorUuid,
    DEFAULT_RESET_TIMEOUT_SECONDS,
    DEFAULT_STARTUP_GRACE_SECONDS,
    getMotionResetMs,
    getStartupGraceMs,
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

describe('getStartupGraceMs', () => {
    it('defaults to disabled (0 seconds)', () => {
        expect(getStartupGraceMs({ name: 'Hallway', port: 18089 })).toBe(0);
        expect(DEFAULT_STARTUP_GRACE_SECONDS).toBe(0);
    });

    it('uses configured startup_grace_seconds in seconds', () => {
        expect(getStartupGraceMs({ name: 'Hallway', port: 18089, startup_grace_seconds: 10 })).toBe(10_000);
    });
});

describe('trigger_path and startup_grace_seconds configuration', () => {
    const validConfig = {
        platform: 'HttpMotionSensorPlatform',
        name: 'HTTP Motion Sensor Platform',
        sensors: [{ name: 'Hallway', port: 18089 }],
    };

    it('parses accepted trigger_path values (plain paths only)', () => {
        for (const trigger_path of ['/', '/motion', '/motion/']) {
            const options = new PlatformOptions({
                ...validConfig,
                sensors: [{ name: 'Hallway', port: 18089, trigger_path }],
            });

            expect(options.sensors[0]?.trigger_path).toBe(trigger_path);
        }
    });

    it('rejects a trigger_path that does not start with /', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: 'motion' }],
                }),
        ).toThrow(/starting with \//);
    });

    it('rejects a trigger_path containing a query string', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '/motion?x=1' }],
                }),
        ).toThrow(/cannot contain query strings/);
    });

    it('rejects a trigger_path containing a fragment', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '/motion#frag' }],
                }),
        ).toThrow(/fragments/);
    });

    it('rejects an empty trigger_path', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '' }],
                }),
        ).toThrow(/starting with \//);
    });

    it('rejects a query-only trigger_path', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '/?x=1' }],
                }),
        ).toThrow(/cannot contain query strings/);
    });

    it('trims surrounding whitespace from trigger_path', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [{ name: 'Hallway', port: 18089, trigger_path: '  /motion  ' }],
        });

        expect(options.sensors[0]?.trigger_path).toBe('/motion');
    });

    it('rejects a trigger_path containing dot segments that can never match a request', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '/a/../motion' }],
                }),
        ).toThrow(/can never match an incoming request/);
    });

    it('rejects a trigger_path that parses as a URL authority (leading double slash)', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '//motion' }],
                }),
        ).toThrow(/can never match an incoming request/);
    });

    it('rejects a non-ASCII trigger_path (request paths arrive percent-encoded)', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, trigger_path: '/mötion' }],
                }),
        ).toThrow(/can never match an incoming request/);
    });

    it('parses startup_grace_seconds and coerces strings', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [{ name: 'Hallway', port: 18089, startup_grace_seconds: '10' }],
        });

        expect(options.sensors[0]?.startup_grace_seconds).toBe(10);
    });

    it('accepts startup_grace_seconds of 0', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [{ name: 'Hallway', port: 18089, startup_grace_seconds: 0 }],
        });

        expect(options.sensors[0]?.startup_grace_seconds).toBe(0);
    });

    it('rejects startup_grace_seconds above 3600', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, startup_grace_seconds: 3601 }],
                }),
        ).toThrow();
    });

    it('rejects non-integer startup_grace_seconds', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, startup_grace_seconds: 1.5 }],
                }),
        ).toThrow();
    });

    it('leaves both fields absent unchanged (backward compatibility)', () => {
        const options = new PlatformOptions(validConfig);

        expect(options.sensors[0]?.trigger_path).toBeUndefined();
        expect(options.sensors[0]?.startup_grace_seconds).toBeUndefined();
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

    it('detects trigger_path changes', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, trigger_path: '/motion' })).toBe(false);
        expect(sensorRuntimeConfigEqual({ ...base, trigger_path: '/motion' }, base)).toBe(false);
    });

    it('detects startup_grace_seconds changes', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, startup_grace_seconds: 10 })).toBe(false);
        expect(sensorRuntimeConfigEqual({ ...base, startup_grace_seconds: 10 }, base)).toBe(false);
    });

    it('treats unset startup_grace_seconds and explicit 0 as equal', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, startup_grace_seconds: 0 })).toBe(true);
    });

    it('treats matching auth configs as equal', () => {
        const withAuth = {
            ...base,
            auth: { mode: 'bearer' as const, token: 'secret' },
        };

        expect(sensorRuntimeConfigEqual(withAuth, { ...withAuth })).toBe(true);
    });

    it('treats sensors without auth as equal', () => {
        expect(sensorRuntimeConfigEqual(base, { ...base, name: 'Renamed' })).toBe(true);
    });

    it('detects auth changes', () => {
        const withAuth = {
            ...base,
            auth: { mode: 'bearer' as const, token: 'secret' },
        };

        expect(sensorRuntimeConfigEqual(base, withAuth)).toBe(false);
    });
});

describe('sensor auth configuration', () => {
    const validConfig = {
        platform: 'HttpMotionSensorPlatform',
        name: 'HTTP Motion Sensor Platform',
        sensors: [{ name: 'Hallway', port: 18089 }],
    };

    it('parses bearer auth', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [
                {
                    name: 'Hallway',
                    port: 18089,
                    auth: { mode: 'bearer', token: 'secret-token' },
                },
            ],
        });

        expect(options.sensors[0]?.auth).toEqual({ mode: 'bearer', token: 'secret-token' });
    });

    it('parses basic auth', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [
                {
                    name: 'Hallway',
                    port: 18089,
                    auth: { mode: 'basic', username: 'user', password: 'pass' },
                },
            ],
        });

        expect(options.sensors[0]?.auth).toEqual({ mode: 'basic', username: 'user', password: 'pass' });
    });

    it('parses header auth', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [
                {
                    name: 'Hallway',
                    port: 18089,
                    auth: { mode: 'header', header_name: 'X-Api-Key', header_value: 'secret' },
                },
            ],
        });

        expect(options.sensors[0]?.auth).toEqual({
            mode: 'header',
            header_name: 'X-Api-Key',
            header_value: 'secret',
        });
    });

    it('normalizes auth mode none to undefined', () => {
        const options = new PlatformOptions({
            ...validConfig,
            sensors: [{ name: 'Hallway', port: 18089, auth: { mode: 'none' } }],
        });

        expect(options.sensors[0]?.auth).toBeUndefined();
    });

    it('rejects bearer auth without token', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, auth: { mode: 'bearer' } }],
                }),
        ).toThrow(/Platform configuration validation failed/);
    });

    it('rejects basic auth without password', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [{ name: 'Hallway', port: 18089, auth: { mode: 'basic', username: 'user' } }],
                }),
        ).toThrow();
    });

    it('rejects header auth without header_value', () => {
        expect(
            () =>
                new PlatformOptions({
                    ...validConfig,
                    sensors: [
                        {
                            name: 'Hallway',
                            port: 18089,
                            auth: { mode: 'header', header_name: 'X-Api-Key' },
                        },
                    ],
                }),
        ).toThrow(/Platform configuration validation failed/);
    });
});

describe('backward compatibility', () => {
    it('parses minimal sensor config without auth', () => {
        const options = new PlatformOptions({
            platform: 'HttpMotionSensorPlatform',
            name: 'HTTP Motion Sensor Platform',
            sensors: [{ name: 'Hallway', port: 18089 }],
        });

        expect(options.sensors[0]?.auth).toBeUndefined();
    });

    it('parses README example config with repeater auth string', () => {
        const options = new PlatformOptions({
            platform: 'HttpMotionSensorPlatform',
            name: 'HTTP Motion Sensor Platform',
            sensors: [
                {
                    name: 'Hallway Motion Sensor',
                    port: 18089,
                    serial: 'E642011E3ECB',
                    model: 'ESP8266 Motion Sensor',
                    bind_ip: '0.0.0.0',
                    repeater: [
                        {
                            host: '192.168.2.11',
                            port: 22322,
                            path: '/turnonscreentilltimeout',
                            auth: 'Bearer your-token-here',
                        },
                    ],
                },
                {
                    name: 'Garden Motion Sensor',
                    port: 18090,
                    serial: 'F642011E3ECC',
                    model: 'ESP8266 Motion Sensor',
                },
            ],
        });

        expect(options.sensors).toHaveLength(2);
        expect(options.sensors[0]?.auth).toBeUndefined();
        expect(options.sensors[0]?.repeater?.[0]?.auth).toBe('Bearer your-token-here');
    });

    it('parses tests/test-config.json fixture', () => {
        const testConfigPath = join(dirname(fileURLToPath(import.meta.url)), '../tests/test-config.json');
        const testConfig = JSON.parse(readFileSync(testConfigPath, 'utf8')) as {
            platforms: unknown[];
        };
        const platformConfig = testConfig.platforms[0];

        expect(() => new PlatformOptions(platformConfig)).not.toThrow();
    });
});

describe('buildSensorUuid auth independence', () => {
    const api = createMockApi();

    it('does not change uuid when auth is added', () => {
        const withoutAuth = { name: 'Hallway', port: 18089, serial: 'E642011E3ECB' };
        const withAuth = {
            ...withoutAuth,
            auth: { mode: 'bearer' as const, token: 'secret' },
        };

        expect(buildSensorUuid(api, withoutAuth)).toBe(buildSensorUuid(api, withAuth));
    });
});
