"use strict";

import { ServerSetting } from "./serverSetting.js";

/**
 * Convert <code>Gtk.Settings</code> into <code>ServerSettings</code>.
 */
export class SettingsParser {
    /**
     * Parse a <code>Gtk.Settings</code> instance.
     *
     * @param {Gtk.Settings} gtkSettings
     * @returns {ServerSetting[]}
     */
    static parseGtkSettings(gtkSettings) {
        const variant = gtkSettings.get_value("server-settings");
        const savedGtkSettings = variant.deep_unpack();
        const settings = [];
        for (const gtkSetting of savedGtkSettings) {
            const name =
                gtkSetting["name"] != undefined ? gtkSetting["name"] : "";
            const url = gtkSetting["url"] != undefined ? gtkSetting["url"] : "";
            const frequency =
                gtkSetting["frequency"] != undefined
                    ? gtkSetting["frequency"]
                    : "60";
            const isGet =
                gtkSetting["is_get"] != undefined
                    ? gtkSetting["is_get"]
                    : "false";
            const setting = new ServerSetting(name, url, frequency, isGet);
            settings.push(setting);
        }
        return settings;
    }

    /**
     * Parse a <code>Map</code> as returned from <code>JSON.parse</code>.
     *
     * @param {Map} map
     * @returns {ServerSetting[]}
     */
    static parseMap(map) {
        const serverSettings = [];
        for (const setting of map) {
            const name = setting["name"] != undefined ? setting["name"] : "";
            const url = setting["url"] != undefined ? setting["url"] : "";
            const frequency =
                setting["frequency"] != undefined ? setting["frequency"] : "60";
            const isGet =
                setting["is_get"] != undefined ? setting["is_get"] : "false";
            serverSettings.push(new ServerSetting(name, url, frequency, isGet));
        }
        return serverSettings;
    }
}
