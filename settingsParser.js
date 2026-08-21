'use strict';

import GLib from 'gi://GLib';

import {ServerSetting} from './serverSetting.js';

/**
 * Convert `Gio.Settings` into an array of `ServerSetting`s.
 */
export class SettingsParser {
    /**
     * Parse the provided GLib.Variant `Gio.Settings` object into an array of `ServerSetting` objects.
     *
     * @param {Gio.Settings} gioSettings
     * @returns `[ServerSetting]`
     */
    static parseGioSettings(gioSettings) {
        let settings;

        const hasV1UserData = gioSettings.get_user_value('server-settings') !== null;
        const hasV2UserData = gioSettings.get_user_value('server-settings-2') !== null;

        if (hasV1UserData && !hasV2UserData) {
            // migrate data from v1 to v2
            const variant = gioSettings.get_value('server-settings');
            const savedSettings = variant.deep_unpack();
            settings = [];
            for (const setting of savedSettings) {
                const name = setting['name'] !== undefined ? setting['name'] : '';
                const url = setting['url'] !== undefined ? setting['url'] : '';
                const frequency = setting['frequency'] !== undefined ? Number(setting['frequency']) : 120;
                const timeout = setting['timeout'] !== undefined ? Number(setting['timeout']) : 10;
                const verb = this.#getVerb(setting); // changed from 'isGet' boolean to 'verb' string
                const notifies = setting['notifies'] !== undefined ? setting['notifies'] === 'true' : false;
                const visible = setting['visible'] !== undefined ? setting['visible'] === 'true' : true;
                const ignoreTLSErrors = setting['ignoreTLSErrors'] !== undefined ? setting['ignoreTLSErrors'] === 'true' : false;
                const ignoreRedirects = setting['ignoreRedirects'] !== undefined ? setting['ignoreRedirects'] === 'true' : false;
                const headers = []; // new property

                const serverSetting = new ServerSetting(name, url, frequency, timeout, verb, notifies, visible, ignoreTLSErrors, ignoreRedirects, headers);
                settings.push(serverSetting);
            }
        } else {
            const variant = gioSettings.get_value('server-settings-2');
            settings = variant.recursiveUnpack();
        }
        return settings;
    }

    /**
     * Parse the provided `ServerGroups` array into an GLib.Variant of `Gio.Settings` objects.
     *
     * Add a map for each group to a `serverSettings` array. All map keys are string but the values can be strings,
     * ints, boolean or complex. Hence each value must be wrapped in a variant. This uses the 'aa{sv}' GVariant type string.
     *
     * One map key, 'headers' has values that are themselves a map with string keys and string values - so the
     * whole `headers` value must be wrapped in a variant.
     *
     * Add them all to an array, wrap it in a variant and return that variant. Suitable for saving.
     *
     * @param {ServerGroup} serverGroups array of ServerGroups
     * @returns `GLib.Variant`
     */
    static parseServerSettings(serverGroups) {
        const serverSettings = [];
        for (const serverGroup of serverGroups) {
            const settings = serverGroup.settings;
            const settingsMap = {};
            for (const [key, value] of Object.entries(settings)) {
                if (key === 'headers') {
                    // headers array of maps with map keys as string and values as variants
                    const headersArray = [];
                    for (const header of value) {
                        const headerMap = {};
                        for (const [headerKey, headerValue] of Object.entries(header)) {
                            // wrapping - the value has to be a Variant, it's the v in aa{sv}
                            headerMap[headerKey] = new GLib.Variant('s', headerValue);
                        }
                        headersArray.push(headerMap);
                    }
                    // wrap the array in a variant and set as value in the settingsMap, it's also the v in aa{sv}
                    settingsMap[key] = GLib.Variant.new_variant(new GLib.Variant('aa{sv}', headersArray));
                } else if (key === 'frequency' || key === 'timeout') {
                    // numeric values
                    settingsMap[key] = new GLib.Variant('i', value);
                } else if (key === 'notifies' || key === 'visible' || key === 'ignoreTLSErrors' || key === 'ignoreRedirects') {
                    // boolean values
                    settingsMap[key] = new GLib.Variant('b', value);
                } else {
                    // string values
                    settingsMap[key] = GLib.Variant.new_string(value);
                }
            }
            serverSettings.push(settingsMap);
        }
        return new GLib.Variant('aa{sv}', serverSettings);
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
}
