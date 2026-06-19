import { createHash, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';

import type { SensorAuthConfig } from './config.ts';

function secureCompare(expected: string, actual: string): boolean {
    const expectedDigest = createHash('sha256').update(expected).digest();
    const actualDigest = createHash('sha256').update(actual).digest();
    return timingSafeEqual(expectedDigest, actualDigest);
}

function getAuthorizationHeader(request: IncomingMessage): string | undefined {
    const value = request.headers.authorization;

    if (value === undefined) {
        return undefined;
    }

    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
}

function validateBearerAuth(request: IncomingMessage, token: string): boolean {
    const authorization = getAuthorizationHeader(request);
    if (!authorization) {
        return false;
    }

    const bearerPrefix = /^bearer\s+/i;
    if (!bearerPrefix.test(authorization)) {
        return false;
    }

    const providedToken = authorization.replace(bearerPrefix, '');
    return secureCompare(token, providedToken);
}

function validateBasicAuth(request: IncomingMessage, username: string, password: string): boolean {
    const authorization = getAuthorizationHeader(request);
    if (!authorization) {
        return false;
    }

    const basicPrefix = /^basic\s+/i;
    if (!basicPrefix.test(authorization)) {
        return false;
    }

    const encoded = authorization.replace(basicPrefix, '');
    let decoded: string;

    try {
        decoded = Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
        return false;
    }

    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
        return false;
    }

    const providedUsername = decoded.slice(0, separatorIndex);
    const providedPassword = decoded.slice(separatorIndex + 1);

    const usernameMatch = secureCompare(username, providedUsername);
    const passwordMatch = secureCompare(password, providedPassword);
    return usernameMatch && passwordMatch;
}

function validateHeaderAuth(request: IncomingMessage, headerName: string, headerValue: string): boolean {
    const headerKey = headerName.toLowerCase();
    const raw = request.headers[headerKey];

    if (typeof raw === 'string') {
        return secureCompare(headerValue, raw);
    }

    if (Array.isArray(raw) && raw.length > 0) {
        return secureCompare(headerValue, raw[0] ?? '');
    }

    return false;
}

export function isAuthEnabled(auth: SensorAuthConfig | undefined): auth is SensorAuthConfig {
    return auth !== undefined;
}

export function getAuthStatusMessage(auth: SensorAuthConfig | undefined): string {
    if (!auth) {
        return 'disabled';
    }

    switch (auth.mode) {
        case 'bearer':
            return 'bearer';
        case 'basic':
            return 'basic';
        case 'header':
            return `header (${auth.header_name})`;
    }
}

export function validateInboundAuth(request: IncomingMessage, auth: SensorAuthConfig): boolean {
    switch (auth.mode) {
        case 'bearer':
            return validateBearerAuth(request, auth.token);
        case 'basic':
            return validateBasicAuth(request, auth.username, auth.password);
        case 'header':
            return validateHeaderAuth(request, auth.header_name, auth.header_value);
    }
}
