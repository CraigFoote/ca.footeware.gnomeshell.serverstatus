"use strict";

import { ServerSetting } from "./serverSetting.js";

/**
 * Convert <code>Gio.Settings</code> into <code>ServerSettings</code>.
 */
export class SettingsParser {
    /**
     * Parse a <code>Gio.Settings</code> instance.
     *
     * @param {Gio.Settings} gioSettings
     * @returns {ServerSetting[]}
     */
    static parseGioSettings(gioSettings) {
        const variant = gioSettings.get_value("server-settings");
        const savedSettings = variant.deep_unpack();
        const settings = [];
        for (const savedSetting of savedSettings) {
            const name =
                savedSetting["name"] != undefined ? savedSetting["name"] : "";
            const url = savedSetting["url"] != undefined ? savedSetting["url"] : "";
            const frequency =
                savedSetting["frequency"] != undefined
                    ? Number(savedSetting["frequency"])
                    : 60; // convert from string to number
            const isGet =
                savedSetting["is_get"] != undefined
                    ? savedSetting["is_get"]
                    : "false";

            const isGetBool = isGet === "true"; // convert to boolean
            const setting = new ServerSetting(name, url, frequency, isGetBool);
            settings.push(setting);
        }
        return settings;
    }
}
