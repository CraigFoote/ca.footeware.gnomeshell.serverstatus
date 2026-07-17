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
     * @returns {ServerSetting} array of `ServerSetting`s
     */
    static parse(gioSettings) {
        const variant = gioSettings.get_value('server-settings');
        const savedSettings = variant.deep_unpack();
        const settings = [];
        for (const savedSetting of savedSettings) {
            const name = this.#getName(savedSetting);
            const url = this.#getURL(savedSetting);
            const frequency = this.#getFrequency(savedSetting);
            const timeout = this.#getTimeout(savedSetting);
            const isGet = this.#getIsGet(savedSetting);
            const notifies = this.#getNotifies(savedSetting);
            const visible = this.#getVisible(savedSetting);
            const ignoreTLSErrors = this.#getIgnoreTLSErrors(savedSetting);
            const setting = new ServerSetting(name, url, frequency, timeout, isGet, notifies, visible, ignoreTLSErrors);
            settings.push(setting);
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

    static #getIsGet(setting) {
        let isGet = false; // defaults to false
        // migrate old key
        if (setting['is_get'] !== undefined)
            isGet = setting['is_get'] === 'true';
        else if (setting['isGet'] !== undefined)
            isGet = setting['isGet'] === 'true';
        return isGet;
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
}
