import { z } from 'zod';

export const repeaterEntrySchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.coerce.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
    path: z.string().min(1, 'Path is required'),
    auth: z.string().optional(),
});

export const sensorConfigSchema = z.object({
    name: z.string().min(1, 'Sensor name is required'),
    port: z.coerce.number().int().min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535'),
    model: z.string().optional(),
    serial: z.string().optional(),
    bind_ip: z.union([z.ipv4(), z.ipv6()]).optional().or(z.literal('0.0.0.0')),
    repeater: z.array(repeaterEntrySchema).optional(),
});

export const platformConfigSchema = z.object({
    name: z.string().min(1, 'Platform name is required'),
    platform: z.literal('HttpMotionSensorPlatform'),
    sensors: z.array(sensorConfigSchema).optional(),
});

export type HomebridgeHttpMotionSensorRepeaterEntry = z.infer<typeof repeaterEntrySchema>;
export type HomebridgeHttpMotionSensorConfig = z.infer<typeof sensorConfigSchema>;
export type HttpMotionSensorPlatformConfig = z.infer<typeof platformConfigSchema>;
