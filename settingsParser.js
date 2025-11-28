"use strict";

import { ServerSetting } from "./serverSetting.js";

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
        const variant = gioSettings.get_value("server-settings");
        const savedSettings = variant.deep_unpack();
        const settings = [];
        for (const savedSetting of savedSettings) {
            const name =
                savedSetting["name"] !== undefined ? savedSetting["name"] : "";
            const url =
                savedSetting["url"] !== undefined ? savedSetting["url"] : "";
            const frequency =
                savedSetting["frequency"] !== undefined
                    ? Number(savedSetting["frequency"])
                    : 120;

            // support old key
            let isGet = false;
            if (savedSetting["is_get"] != undefined) {
                isGet = savedSetting["is_get"] === "true";
            } else if (savedSetting["isGet"] != undefined) {
                isGet = savedSetting["isGet"] === "true";
            }

            const setting = new ServerSetting(name, url, frequency, isGet);
            settings.push(setting);
        }
        return settings;
    }
}
