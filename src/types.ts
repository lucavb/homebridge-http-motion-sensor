import { AccessoryConfig } from 'homebridge';

export interface HomebridgeHttpMotionSensorRepeaterEntry {
    host: string;
    port: number;
    path: string;
    auth?: string;
}

export interface HomebridgeHttpMotionSensorConfig extends AccessoryConfig {
    port?: number;
    model?: string;
    serial?: string;
    bind_ip?: string;
    repeater?: HomebridgeHttpMotionSensorRepeaterEntry[];
}
