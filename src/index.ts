import { API } from 'homebridge';
import { HttpMotionSensorPlatform } from './platform';

const PLATFORM_NAME = 'HttpMotionSensorPlatform';
const PLUGIN_NAME = 'homebridge-http-motion-sensor';

export = (api: API): void => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HttpMotionSensorPlatform);
};
