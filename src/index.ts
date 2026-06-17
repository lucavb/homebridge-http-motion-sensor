import type { API } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './constants.ts';
import { HttpMotionSensorPlatform } from './platform.ts';

export default (api: API): void => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HttpMotionSensorPlatform);
};
