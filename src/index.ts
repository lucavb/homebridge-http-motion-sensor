import type { API } from 'homebridge';

import { HttpMotionSensorPlatform, PLATFORM_NAME, PLUGIN_NAME } from './platform.ts';

export default (api: API): void => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HttpMotionSensorPlatform);
};
