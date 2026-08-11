'use strict';

import {ServerSetting} from './serverSetting.js';

/**
 * Convert `Gio.Settings` into `ServerSetting`s.
 */
export class SettingsParser {
    /**
     * Parse the provided `Gio.Settings` object into an array of `ServerSetting` objects.
     *
     * @param {Gio.Settings} gioSettings saved settings
     * @returns `[ServerSetting]` array of `ServerSetting`s
     */
    static parse(gioSettings) {
        let settings;

        const hasV1Data = gioSettings.get_user_value('server-settings') !== null;
        const hasV2Data = gioSettings.get_user_value('server-settings-2') !== null;

        if (hasV1Data && !hasV2Data) {
            // migrate data from v1 to v2
            const variant = gioSettings.get_value('server-settings');
            const savedSettings = variant.deep_unpack();
            settings = [];
            for (const savedSetting of savedSettings) {
                const name = this.#getName(savedSetting);
                const url = this.#getURL(savedSetting);
                const frequency = this.#getFrequency(savedSetting);
                const timeout = this.#getTimeout(savedSetting);
                const verb = this.#getVerb(savedSetting); // changed from 'isGet' boolean to 'verb' string
                const notifies = this.#getNotifies(savedSetting);
                const visible = this.#getVisible(savedSetting);
                const ignoreTLSErrors = this.#getIgnoreTLSErrors(savedSetting);
                const ignoreRedirects = this.#getIgnoreRedirects(savedSetting);
                const headers = []; // new property

                const setting = new ServerSetting(name, url, frequency, timeout, verb, notifies, visible, ignoreTLSErrors, ignoreRedirects, headers);
                settings.push(setting);
            }
        } else {
            const variant = gioSettings.get_value('server-settings-2');
            settings = JSON.parse(variant.deep_unpack());
        }

        return settings;
    }

    static #getName(setting) {
        return setting['name'] !== undefined ? setting['name'] : ''; // defaults to ''
    }

    static #getURL(setting) {
        return setting['url'] !== undefined ? setting['url'] : ''; // defaults to ''
    }

    static #getFrequency(setting) {
        return setting['frequency'] !== undefined ? Number(setting['frequency']) : 120; // defaults to 120s
    }

    static #getTimeout(setting) {
        return setting['timeout'] !== undefined ? Number(setting['timeout']) : 10; // defaults to 10s
    }

    /**
     * Convert old schema's `isGet` boolean property to a new `verb` string for schema v2.
     *
     * @param {ServerSetting} setting
     * @returns `string` the request action verb
     */
    static #getVerb(setting) {
        let isGet = false; // defaults to false
        // migrate old key
        if (setting['is_get'] !== undefined)
            isGet = setting['is_get'] === 'true';
        else if (setting['isGet'] !== undefined)
            isGet = setting['isGet'] === 'true';
        return isGet ? 'GET' : 'HEAD'; // convert from boolean to string
    }

    static #getNotifies(setting) {
        return setting['notifies'] !== undefined ? setting['notifies'] === 'true' : false; // defaults to false
    }

    static #getVisible(setting) {
        return setting['visible'] !== undefined ? setting['visible'] === 'true' : true; // defaults to true
    }

    static #getIgnoreTLSErrors(setting) {
        return setting['ignoreTLSErrors'] !== undefined ? setting['ignoreTLSErrors'] === 'true' : false; // defaults to false
    }

    static #getIgnoreRedirects(setting) {
        return setting['ignoreRedirects'] !== undefined ? setting['ignoreRedirects'] === 'true' : false; // defaults to false
    }
}
