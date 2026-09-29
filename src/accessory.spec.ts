import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type API, type Logging, type PlatformAccessory } from 'homebridge';

import {
    HttpMotionSensorAccessory,
    buildRepeaterRequestOptions,
    describeRequest,
    isWithinStartupGrace,
    matchesTriggerPath,
} from './accessory.ts';
import type { SensorAccessoryContext } from './config.ts';

// Partially mock node's http module so repeater fan-out calls (http.get) can be
// asserted without opening real outbound connections. Everything else (the
// real listening server in these tests) comes from the original module.
vi.mock('http', async (importOriginal) => {
    const actual = await importOriginal<typeof import('http')>();
    return {
        ...actual,
        get: vi.fn(() => ({ on: vi.fn() })) as unknown as typeof actual.get,
    };
});

import { get as repeaterGet, type IncomingMessage } from 'http';

describe('buildRepeaterRequestOptions', () => {
    it('builds a GET request without auth', () => {
        expect(
            buildRepeaterRequestOptions({
                host: '192.168.1.10',
                port: 8080,
                path: '/trigger',
            }),
        ).toEqual({
            host: '192.168.1.10',
            port: 8080,
            path: '/trigger',
            method: 'GET',
        });
    });

    it('adds an Authorization header when auth is configured', () => {
        expect(
            buildRepeaterRequestOptions({
                host: '192.168.1.10',
                port: 8080,
                path: '/trigger',
                auth: 'Bearer secret-token',
            }),
        ).toEqual({
            host: '192.168.1.10',
            port: 8080,
            path: '/trigger',
            method: 'GET',
            headers: {
                Authorization: 'Bearer secret-token',
            },
        });
    });

    it('coerces repeater port strings via upstream config parsing', () => {
        const options = buildRepeaterRequestOptions({
            host: 'repeater.local',
            port: 22322,
            path: '/api/on',
        });

        expect(options.port).toBe(22322);
        expect(options.method).toBe('GET');
    });
});

describe('isWithinStartupGrace', () => {
    const start = Date.now();

    it('ignores when grace is disabled (0 ms)', () => {
        expect(isWithinStartupGrace(start, 0, start + 1)).toBe(false);
    });

    it('ignores when the start time is unknown', () => {
        expect(isWithinStartupGrace(undefined, 10_000, start + 1)).toBe(false);
    });

    it('reports grace inside the window', () => {
        expect(isWithinStartupGrace(start, 10_000, start + 5_000)).toBe(true);
    });

    it('reports no grace at the window boundary', () => {
        expect(isWithinStartupGrace(start, 10_000, start + 10_000)).toBe(false);
    });

    it('reports no grace after the window', () => {
        expect(isWithinStartupGrace(start, 10_000, start + 10_001)).toBe(false);
    });
});

describe('matchesTriggerPath', () => {
    it('accepts any path when no trigger_path is configured', () => {
        expect(matchesTriggerPath(undefined, '/anything')).toBe(true);
        expect(matchesTriggerPath(undefined, undefined)).toBe(true);
        expect(matchesTriggerPath(undefined, '/motion?query=1')).toBe(true);
    });

    it('accepts an exact path match', () => {
        expect(matchesTriggerPath('/motion', '/motion')).toBe(true);
        expect(matchesTriggerPath('/motion', '/motion?query=1')).toBe(true);
    });

    it('rejects a path mismatch', () => {
        expect(matchesTriggerPath('/motion', '/other')).toBe(false);
        expect(matchesTriggerPath('/motion', '/motion/extra')).toBe(false);
    });

    it('treats a missing URL as the root path', () => {
        expect(matchesTriggerPath('/', undefined)).toBe(true);
        expect(matchesTriggerPath('/motion', undefined)).toBe(false);
    });

    it('does not throw on crafted targets that fail URL parsing', () => {
        // Absolute-form targets with out-of-range ports pass Node's HTTP parser
        // but make new URL() throw; the match must fail closed instead.
        expect(() => matchesTriggerPath('/motion', 'http://x:99999/motion')).not.toThrow();
        expect(matchesTriggerPath('/motion', 'http://x:99999/motion')).toBe(false);
    });
});

describe('describeRequest', () => {
    const request = (url: string | undefined, method = 'GET', remoteAddress = '10.0.0.1'): IncomingMessage =>
        ({ method, url, headers: {}, socket: { remoteAddress } }) as unknown as IncomingMessage;

    it('excludes query strings by default', () => {
        expect(describeRequest(request('/motion?token=secret'))).toBe('10.0.0.1 GET /motion');
    });

    it('includes the full URL when requested', () => {
        expect(describeRequest(request('/motion?token=secret'), true)).toBe('10.0.0.1 GET /motion?token=secret');
    });

    it('falls back to the raw target when URL parsing fails', () => {
        expect(describeRequest(request('http://x:99999/motion'))).toBe('10.0.0.1 GET http://x:99999/motion');
    });
});

describe('HttpMotionSensorAccessory HTTP ingress hardening', () => {
    const BASE_PORT = 28089;
    let usedPorts = 0;

    function createMockLog(): Logging {
        return {
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn(),
        } as unknown as Logging;
    }

    function createMockApi(): API {
        class MockService {
            constructor(public name?: string) {}
            getCharacteristic(): { onGet: ReturnType<typeof vi.fn>; updateValue: ReturnType<typeof vi.fn> } {
                return {
                    onGet: vi.fn(),
                    updateValue: vi.fn(),
                };
            }
        }
        return {
            hap: {
                uuid: {
                    generate: (input: string) => `uuid-for-${input}`,
                },
                Service: {
                    AccessoryInformation: MockService,
                    MotionSensor: MockService,
                },
                Characteristic: {
                    Manufacturer: 'Manufacturer',
                    Model: 'Model',
                    SerialNumber: 'SerialNumber',
                    MotionDetected: 'MotionDetected',
                },
            },
        } as unknown as API;
    }

    type MockPlatformAccessoryResult = {
        platformAccessory: PlatformAccessory<SensorAccessoryContext>;
        motionUpdateValue: ReturnType<typeof vi.fn>;
    };

    function createMockPlatformAccessory(): MockPlatformAccessoryResult {
        // Characteristics are cached per name so tests can spy on the same
        // MotionDetected characteristic instance that setMotionDetected uses.
        const characteristics = new Map<
            string,
            { onGet: ReturnType<typeof vi.fn>; updateValue: ReturnType<typeof vi.fn> }
        >();
        const motionCharacteristic = { onGet: vi.fn(), updateValue: vi.fn() };
        characteristics.set('MotionDetected', motionCharacteristic);

        const service: Record<string, (...args: unknown[]) => unknown> = {
            getCharacteristic: (characteristic: string) => {
                let characteristicMock = characteristics.get(characteristic);
                if (!characteristicMock) {
                    characteristicMock = { onGet: vi.fn(), updateValue: vi.fn() };
                    characteristics.set(characteristic, characteristicMock);
                }
                return characteristicMock;
            },
            setCharacteristic: vi.fn(() => service),
        };

        const platformAccessory = {
            context: {} as SensorAccessoryContext,
            getService: vi.fn(() => service),
            addService: vi.fn(),
        } as unknown as PlatformAccessory<SensorAccessoryContext>;

        return { platformAccessory, motionUpdateValue: motionCharacteristic.updateValue };
    }

    const accessoriesToClose: HttpMotionSensorAccessory[] = [];

    async function createAccessory(configOverrides: Record<string, unknown>): Promise<{
        accessory: HttpMotionSensorAccessory;
        port: number;
        log: Logging;
        motionUpdateValue: ReturnType<typeof vi.fn>;
    }> {
        const port = BASE_PORT + ++usedPorts;
        const log = createMockLog();
        const { platformAccessory, motionUpdateValue } = createMockPlatformAccessory();
        const accessory = new HttpMotionSensorAccessory(
            log,
            {
                name: 'Hallway',
                port,
                bind_ip: '127.0.0.1',
                ...configOverrides,
            },
            platformAccessory,
            createMockApi(),
        );
        // Register for teardown before awaiting readiness so a failed startup
        // still gets the server closed in afterEach.
        accessoriesToClose.push(accessory);
        // Poll until the listen callback has run instead of a fixed sleep.
        await waitForServerReady(accessory, log);
        return { accessory, port, log, motionUpdateValue };
    }

    async function waitForServerReady(accessory: HttpMotionSensorAccessory, log: Logging): Promise<void> {
        await vi.waitFor(
            () => {
                if ((accessory as unknown as { serverStartedAt?: number }).serverStartedAt !== undefined) {
                    return;
                }

                const serverError = vi.mocked(log.error).mock.calls[0]?.[0];
                if (serverError !== undefined) {
                    throw new Error(`HTTP server failed to start: ${String(serverError)}`);
                }

                throw new Error('HTTP server did not start within the timeout');
            },
            { timeout: 1_000, interval: 5 },
        );
    }

    async function withAccessory(configOverrides: Record<string, unknown>): Promise<{
        accessory: HttpMotionSensorAccessory;
        port: number;
        log: Logging;
        motionUpdateValue: ReturnType<typeof vi.fn>;
    }> {
        return createAccessory(configOverrides);
    }

    function handleRequest(
        accessory: HttpMotionSensorAccessory,
        options: { method: string; url: string; remoteAddress: string; headers?: Record<string, string> },
    ): { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
        const response = {
            writeHead: vi.fn(),
            end: vi.fn(),
        };
        const request = {
            method: options.method,
            url: options.url,
            headers: options.headers ?? {},
            socket: { remoteAddress: options.remoteAddress },
        };

        (
            accessory as unknown as { handleHttpRequest: (request: unknown, response: unknown) => void }
        ).handleHttpRequest(request, response);

        return response;
    }

    const repeaterEndpoint = {
        host: '192.168.1.10',
        port: 22322,
        path: '/api/on',
    };

    beforeEach(() => {
        vi.mocked(repeaterGet).mockClear();
    });

    afterEach(async () => {
        for (const accessory of accessoriesToClose.splice(0)) {
            await accessory.shutdown();
        }
    });

    it('responds 503 and records no motion during the startup grace period', async () => {
        const { accessory, port, log, motionUpdateValue } = await withAccessory({
            startup_grace_seconds: 30,
            repeater: [repeaterEndpoint],
        });

        const response = handleRequest(accessory, {
            method: 'POST',
            url: '/motion',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'text/plain' });
        expect(response.end).toHaveBeenCalledWith(expect.stringContaining('grace'));
        expect(log.warn).toHaveBeenCalledWith(
            expect.stringMatching(/Ignored request during startup grace period.*from 188\.64\.1\.\d+ POST \/motion$/),
        );
        expect(motionUpdateValue).not.toHaveBeenCalled();
        expect(vi.mocked(repeaterGet)).not.toHaveBeenCalled();
    });

    it('responds 404 when trigger_path does not match', async () => {
        const { accessory, port, log, motionUpdateValue } = await withAccessory({
            trigger_path: '/motion',
            repeater: [repeaterEndpoint],
        });

        const response = handleRequest(accessory, {
            method: 'GET',
            url: '/other',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
        expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Not Found'));
        expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('non-matching path'));
        expect(motionUpdateValue).not.toHaveBeenCalled();
        expect(vi.mocked(repeaterGet)).not.toHaveBeenCalled();
    });

    it('still triggers motion on a matching path when trigger_path is set', async () => {
        const { accessory, port, log, motionUpdateValue } = await withAccessory({
            trigger_path: '/motion',
            reset_timeout: 1,
            repeater: [repeaterEndpoint],
        });

        const response = handleRequest(accessory, {
            method: 'GET',
            url: '/motion',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
        expect(log.debug).toHaveBeenCalledWith(
            expect.stringMatching(/Motion detected via HTTP request from 188\.64\.1\.\d+ GET \/motion$/),
        );
        expect(motionUpdateValue).toHaveBeenCalledWith(true);
        expect(vi.mocked(repeaterGet)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(repeaterGet).mock.calls[0]?.[0]).toEqual(buildRepeaterRequestOptions(repeaterEndpoint));
    });

    it('triggers motion normally once the grace window has elapsed', async () => {
        const { accessory, port, motionUpdateValue } = await withAccessory({ startup_grace_seconds: 30 });

        const startedAt = (accessory as unknown as { serverStartedAt?: number }).serverStartedAt;
        expect(startedAt).toBeDefined();

        const nowSpy = vi.spyOn(performance, 'now').mockReturnValue((startedAt ?? 0) + 31_000);
        try {
            const response = handleRequest(accessory, {
                method: 'POST',
                url: '/motion',
                remoteAddress: `188.64.1.${port % 250}`,
            });

            expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
            expect(motionUpdateValue).toHaveBeenCalledWith(true);
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('responds 401 to unauthenticated requests before the grace and path checks when auth is configured', async () => {
        const { accessory, port, motionUpdateValue } = await withAccessory({
            auth: { mode: 'bearer', token: 'secret-token' },
            startup_grace_seconds: 30,
            trigger_path: '/motion',
        });

        // During the grace window ...
        const duringGrace = handleRequest(accessory, {
            method: 'POST',
            url: '/motion',
            remoteAddress: `188.64.1.${port % 250}`,
        });
        expect(duringGrace.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'text/plain' });

        // ... and with a non-matching path: the auth check must run first.
        const nonMatchingPath = handleRequest(accessory, {
            method: 'POST',
            url: '/other',
            remoteAddress: `188.64.1.${port % 250}`,
        });
        expect(nonMatchingPath.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'text/plain' });

        expect(motionUpdateValue).not.toHaveBeenCalled();
    });

    it('answers 503 for non-matching paths during the startup grace period (grace takes precedence)', async () => {
        const { accessory, port, log, motionUpdateValue } = await withAccessory({
            startup_grace_seconds: 30,
            trigger_path: '/motion',
            repeater: [repeaterEndpoint],
        });

        const response = handleRequest(accessory, {
            method: 'POST',
            url: '/other',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'text/plain' });
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Ignored request during startup grace period'));
        expect(motionUpdateValue).not.toHaveBeenCalled();
        expect(vi.mocked(repeaterGet)).not.toHaveBeenCalled();
    });

    it('responds 503 to authenticated requests during the startup grace period', async () => {
        const { accessory, port, motionUpdateValue } = await withAccessory({
            auth: { mode: 'bearer', token: 'secret-token' },
            startup_grace_seconds: 30,
        });

        const response = handleRequest(accessory, {
            method: 'POST',
            url: '/motion',
            remoteAddress: `188.64.1.${port % 250}`,
            headers: { authorization: 'Bearer secret-token' },
        });

        expect(response.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'text/plain' });
        expect(motionUpdateValue).not.toHaveBeenCalled();
    });

    it('still triggers on malformed request targets when no trigger_path is configured', async () => {
        const { accessory, port, motionUpdateValue } = await withAccessory({});

        const response = handleRequest(accessory, {
            method: 'GET',
            url: 'http://x:99999/motion',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
        expect(motionUpdateValue).toHaveBeenCalledWith(true);
    });

    it('responds 404, without crashing, to malformed request targets when trigger_path is set', async () => {
        const { accessory, port, log, motionUpdateValue } = await withAccessory({ trigger_path: '/motion' });

        const response = handleRequest(accessory, {
            method: 'GET',
            url: 'http://x:99999/motion',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
        expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('non-matching path'));
        expect(motionUpdateValue).not.toHaveBeenCalled();
    });

    it('triggers motion for a matching path that carries a query string', async () => {
        const { accessory, port, motionUpdateValue } = await withAccessory({ trigger_path: '/motion' });

        const response = handleRequest(accessory, {
            method: 'GET',
            url: '/motion?source=test',
            remoteAddress: `188.64.1.${port % 250}`,
        });

        expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
        expect(motionUpdateValue).toHaveBeenCalledWith(true);
    });
});
