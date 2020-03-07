import * as hap from 'hap-nodejs';
import {Service} from 'hap-nodejs';

type VersionNumber = number;
type ServerVersionNumber = string;

export interface HomebridgeApi {
    _accessories: object;
    _platforms: object;
    _configurableAccessories: object;
    _dynamicPlatforms: object;
    version: VersionNumber;
    serverVersion: ServerVersionNumber;

    hap: typeof hap;

    publishCameraAccessories(pluginName: string, accessories: any): void;

    publishExternalAccessories(pluginName: string, accessories: any): void;

    registerAccessory(pluginName: string, accessoryName: string, constructor: any, configurationRequestHandler?: any): void;

    registerPlatform(pluginName: string, platformName: string, constructor: any, dynamic: any): void;

    registerPlatformAccessories(pluginName: string, platformName: string, accessories: any): void;

    unregisterPlatformAccessories(pluginName: string, platformName: string, accessories: any): void;

    updatePlatformAccessories(accessories: any): void;
}

export interface IAccessoryConfig {
    name: string;
    description?: string;
}

export abstract class HomebridgeAccessory {
    protected services: Service[] = [];

    protected config: IAccessoryConfig;

    public getServices(): Service[] {
        return this.services;
    }
}
