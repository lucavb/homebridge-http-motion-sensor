import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'http';

import { getAuthStatusMessage, isAuthEnabled, validateInboundAuth } from './auth.ts';
import type { SensorAuthConfig } from './config.ts';

function createRequest(headers: Record<string, string>): IncomingMessage {
    const normalizedHeaders: Record<string, string | string[]> = {};

    for (const [key, value] of Object.entries(headers)) {
        normalizedHeaders[key.toLowerCase()] = value;
    }

    return { headers: normalizedHeaders } as IncomingMessage;
}

describe('isAuthEnabled', () => {
    it('returns false when auth is undefined', () => {
        expect(isAuthEnabled(undefined)).toBe(false);
    });

    it('returns true when auth is configured', () => {
        expect(isAuthEnabled({ mode: 'bearer', token: 'secret' })).toBe(true);
    });
});

describe('getAuthStatusMessage', () => {
    it('returns disabled when auth is undefined', () => {
        expect(getAuthStatusMessage(undefined)).toBe('disabled');
    });

    it('describes each auth mode', () => {
        expect(getAuthStatusMessage({ mode: 'bearer', token: 'x' })).toBe('bearer');
        expect(getAuthStatusMessage({ mode: 'basic', username: 'u', password: 'p' })).toBe('basic');
        expect(getAuthStatusMessage({ mode: 'header', header_name: 'X-Api-Key', header_value: 'v' })).toBe(
            'header (X-Api-Key)',
        );
    });
});

describe('validateInboundAuth', () => {
    const bearerAuth: SensorAuthConfig = { mode: 'bearer', token: 'secret-token' };
    const basicAuth: SensorAuthConfig = { mode: 'basic', username: 'user', password: 'pass' };
    const headerAuth: SensorAuthConfig = {
        mode: 'header',
        header_name: 'X-Api-Key',
        header_value: 'api-secret',
    };

    describe('bearer', () => {
        it('accepts a matching Bearer token', () => {
            const request = createRequest({ Authorization: 'Bearer secret-token' });
            expect(validateInboundAuth(request, bearerAuth)).toBe(true);
        });

        it('accepts a case-insensitive Bearer prefix', () => {
            const request = createRequest({ Authorization: 'bearer secret-token' });
            expect(validateInboundAuth(request, bearerAuth)).toBe(true);
        });

        it('rejects a missing Authorization header', () => {
            const request = createRequest({});
            expect(validateInboundAuth(request, bearerAuth)).toBe(false);
        });

        it('rejects a wrong token of the same length', () => {
            const request = createRequest({ Authorization: 'Bearer secret-tokn!' });
            expect(validateInboundAuth(request, bearerAuth)).toBe(false);
        });

        it('rejects a wrong token of a different length', () => {
            const request = createRequest({ Authorization: 'Bearer wrong-token' });
            expect(validateInboundAuth(request, bearerAuth)).toBe(false);
        });

        it('rejects a raw token without Bearer prefix', () => {
            const request = createRequest({ Authorization: 'secret-token' });
            expect(validateInboundAuth(request, bearerAuth)).toBe(false);
        });
    });

    describe('basic', () => {
        it('accepts matching credentials', () => {
            const encoded = Buffer.from('user:pass').toString('base64');
            const request = createRequest({ Authorization: `Basic ${encoded}` });
            expect(validateInboundAuth(request, basicAuth)).toBe(true);
        });

        it('rejects wrong password with same-length credentials', () => {
            const encoded = Buffer.from('user:pasx').toString('base64');
            const request = createRequest({ Authorization: `Basic ${encoded}` });
            expect(validateInboundAuth(request, basicAuth)).toBe(false);
        });

        it('rejects wrong password', () => {
            const encoded = Buffer.from('user:wrong').toString('base64');
            const request = createRequest({ Authorization: `Basic ${encoded}` });
            expect(validateInboundAuth(request, basicAuth)).toBe(false);
        });

        it('rejects missing Authorization header', () => {
            const request = createRequest({});
            expect(validateInboundAuth(request, basicAuth)).toBe(false);
        });
    });

    describe('header', () => {
        it('accepts a matching custom header', () => {
            const request = createRequest({ 'X-Api-Key': 'api-secret' });
            expect(validateInboundAuth(request, headerAuth)).toBe(true);
        });

        it('matches header names case-insensitively', () => {
            const request = createRequest({ 'x-api-key': 'api-secret' });
            expect(validateInboundAuth(request, headerAuth)).toBe(true);
        });

        it('rejects a missing custom header', () => {
            const request = createRequest({});
            expect(validateInboundAuth(request, headerAuth)).toBe(false);
        });

        it('rejects a wrong header value of the same length', () => {
            const request = createRequest({ 'X-Api-Key': 'api-secretx' });
            expect(validateInboundAuth(request, headerAuth)).toBe(false);
        });

        it('rejects a wrong header value', () => {
            const request = createRequest({ 'X-Api-Key': 'wrong-secret' });
            expect(validateInboundAuth(request, headerAuth)).toBe(false);
        });
    });
});
