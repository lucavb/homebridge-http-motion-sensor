import { describe, expect, it } from 'vitest';

import { buildRepeaterRequestOptions } from './accessory.ts';

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
