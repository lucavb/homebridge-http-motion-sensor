'use strict';

import {Server, get, createServer} from 'http';
import type {API, Logging} from 'homebridge';
import PACKAGE_JSON from '../package.json';
import { setTimeout, clearTimeout } from 'timers';

const MANUFACTURER: string = PACKAGE_JSON.author.name;
const SERIAL_NUMBER = '001';
const MODEL: string = PACKAGE_JSON.name;
const FIRMWARE_REVISION: string = PACKAGE_JSON.version;

let Service: any, Characteristic: any;

type MotionSensorConfig = {
  name: string;
  port: number;
  bind_ip?: string;
  model: string;
  serial: string;
  firmware: string;
  repeater?: Array<string | { host: string }>;
};

// Use export default for ESM compatibility
const plugin = (api: API) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;

  // Register using a wrapper to adapt Homebridge's AccessoryConfig to our HttpMotionSensorConfig
  api.registerAccessory(MODEL, 'http-motion-sensor', class extends HttpMotionSensor {
    constructor(log: Logging, config: any, api: API) {
      // Optionally, validate config here or map fields as needed
      super(log, config as MotionSensorConfig, api);
    }
  });
};

class HttpMotionSensor {
  name: string;
  log: Logging;
  api: API;
  config: MotionSensorConfig;
  services: any[] = [];
  motionDetected: boolean = false;
  timeout: any;
  server?: Server;
  bindIP?: string;
  port?: number;
  homebridgeService: any;
  serial: string;

  constructor(log: Logging, config: MotionSensorConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.port = config.port;
    this.serial = config.serial || SERIAL_NUMBER;
    this.config = config;
    this.api = api;
    this.bindIP = config.bind_ip ?? '0.0.0.0';
    this.server = createServer((request, response) => {
      this.httpHandler();
      response.setHeader('Content-Type', 'application/json');
      response.statusCode = 200;
      response.end(JSON.stringify({
        'Successfully requested': request.url,
      }));
    });

    this.server.listen(this.port!, this.bindIP, () => {
      this.log(`This device can now be reached under http://${this.bindIP}:${this.port}`);
    });

    this.api.on('shutdown', () => {
      this.server!.close();
    });

    this.homebridgeService = new Service.MotionSensor(this.name);
  }

  getServices() {
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(Characteristic.Model, MODEL)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, FIRMWARE_REVISION);

    this.homebridgeService
      .getCharacteristic(Characteristic.MotionDetected)
      .onGet(this.getState.bind(this));

    return [informationService, this.homebridgeService];
  }

  httpHandler() {
    this.log.info('Motion detected');
    if (this.config.repeater) {
      for (const repeater of this.config.repeater) {
        get(repeater).on('error', (e) => {
          const host = typeof repeater === 'string' ? repeater : repeater.host;
          this.log.warn(`a repeater request to the host ${host} failed. Please see this error: ${e.message}`);
        });
      }
    }

    this.motionDetected = true;
    this.homebridgeService.updateCharacteristic(Characteristic.MotionDetected, this.motionDetected);
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      this.motionDetected = false;
      this.homebridgeService.updateCharacteristic(Characteristic.MotionDetected, this.motionDetected);
      this.timeout = null;
    }, 11 * 1000);
  };

  getState() {
    return this.motionDetected;
  };
}

export default plugin;
