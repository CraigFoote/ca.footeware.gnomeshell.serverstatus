'use strict';

import {ServerSetting} from './serverSetting.js';

/**
 * Convert `Gio.Settings` into `ServerSetting`s.
 */
export class SettingsParser {
    /**
     * Parse a `Gio.Settings` instance.
     *
     * @param {Gio.Settings} gioSettings the persisted settings
     * @returns {ServerSetting} array of `ServerSetting`s
     */
    static parseGioSettings(gioSettings) {
        const variant = gioSettings.get_value('server-settings');
        const savedSettings = variant.deep_unpack();
        const settings = [];
        for (const savedSetting of savedSettings) {
            const name =
                savedSetting['name'] !== undefined ? savedSetting['name'] : '';
            const url =
                savedSetting['url'] !== undefined ? savedSetting['url'] : '';
            const frequency =
                savedSetting['frequency'] !== undefined
                    ? Number(savedSetting['frequency'])
                    : 120;
            const timeout =
                savedSetting['timeout'] !== undefined
                    ? Number(savedSetting['timeout'])
                    : 10;

            // migrate old key
            let isGet = false;
            if (savedSetting['is_get'] !== undefined)
                isGet = savedSetting['is_get'] === 'true';
            else if (savedSetting['isGet'] !== undefined)
                isGet = savedSetting['isGet'] === 'true';

            const notifies = this.getNotifies(savedSetting);
            const visible = this.getVisible(savedSetting);
            const ignoreTLSErrors = this.getIgnoreTLSErrors(savedSetting);

            const setting = new ServerSetting(name, url, frequency, timeout, isGet, notifies, visible, ignoreTLSErrors);
            settings.push(setting);
        }
        return settings;
    }

    /**
     * Get the value of the 'notifies' property from the provided setting.
     *
     * @param {ServerSetting} setting
     * @returns {string}
     */
    getNotifies(setting) {
        return setting['notifies'] !== undefined ? setting['notifies'] === 'true' : false; // defaults to false
    }

    /**
     * Get the value of the 'visible' property from the provided setting.
     *
     * @param {ServerSetting} setting
     * @returns {string}
     */
    getVisible(setting) {
        return setting['visible'] !== undefined ? setting['visible'] === 'true' : true; // defaults to true for backward compatibility
    }

    /**
     * Get the value of the 'ignoreTLSErrors' property from the provided setting.
     *
     * @param {ServerSetting} setting
     * @returns {string}
     */
    getIgnoreTLSErrors(setting) {
        return setting['ignoreTLSErrors'] !== undefined ? setting['ignoreTLSErrors'] === 'true' : false; // defaults to false
    }
}
