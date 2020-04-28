import {IAccessoryConfig} from 'homebridge-ts-helper';

export interface HomebridgeHttpMotionSensorRepeaterEntry {
    host: string;
    port: number;
    path: string;
    auth?: string;
}

export interface HomebridgeHttpMotionSensorConfig extends IAccessoryConfig {
    port: number;
    model?: string;
    serial?: string;
    // eslint-disable-next-line camelcase
    bind_ip?: string;
    repeater: HomebridgeHttpMotionSensorRepeaterEntry[];
}
