"use strict";

import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Adw from "gi://Adw";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { SettingsParser } from "./settingsParser.js";
import { ServerGroup } from "./serverGroup.js";
import { ServerSetting } from "./serverSetting.js";

/**
 * The main preferences class that creates server groups and saves to gsettings.
 */
export default class ServerStatusPreferences extends ExtensionPreferences {
    /**
     * Called by system when preferences are opened.
     *
     * @param {Gtk.Window} window
     */
    fillPreferencesWindow(window) {
        // load custom symbolic icons
        const iconPath = this.path + "/icons";
        const iconTheme = Gtk.IconTheme.get_for_display(
            Gdk.Display.get_default(),
        );
        iconTheme.add_search_path(iconPath);

        this.window = window;
        this.page = new Adw.PreferencesPage();
        this.gioSettings = this.getSettings();
        this.serverGroups = [];

        // instructions/help
        const helpBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
        });

        // server-bad
        const serverInitBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        const serverInitImage = new Gtk.Image({
            file: this.path + "/assets/server.svg",
            pixel_size: 36,
        });
        const serverInitDesc = new Gtk.Label({
            label: "Initializing...",
        });
        serverInitBox.append(serverInitImage);
        serverInitBox.append(serverInitDesc);
        helpBox.append(serverInitBox);

        // server-down
        const serverDownBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        const serverDownImage = new Gtk.Image({
            file: this.path + "/assets/server-down.svg",
            pixel_size: 36,
        });
        const serverDownDesc = new Gtk.Label({
            label: "If you get a server-down indicator, try switching to GET.\nHTTP HEAD is faster but not always supported.",
        });
        serverDownBox.append(serverDownImage);
        serverDownBox.append(serverDownDesc);
        helpBox.append(serverDownBox);

        // server-bad
        const serverBadBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        const serverBadImage = new Gtk.Image({
            file: this.path + "/assets/server-bad.svg",
            pixel_size: 36,
        });
        const serverBadDesc = new Gtk.Label({
            label: "If you get a server-bad indicator, there's something wrong with the URL.\nIt should be of format http[s]://host[:port][/path].",
        });
        serverBadBox.append(serverBadImage);
        serverBadBox.append(serverBadDesc);
        helpBox.append(serverBadBox);

        // server-up
        const serverUpBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        const serverUpImage = new Gtk.Image({
            file: this.path + "/assets/server-up.svg",
            pixel_size: 36,
        });
        const serverUpDesc = new Gtk.Label({
            label: "The desired server-up indicator.",
        });
        serverUpBox.append(serverUpImage);
        serverUpBox.append(serverUpDesc);
        helpBox.append(serverUpBox);

        // help group
        const helpGroup = new Adw.PreferencesGroup({});
        helpGroup.add(helpBox);
        this.page.add(helpGroup);

        // operations group
        const operationsGroup = new Adw.PreferencesGroup({});
        // import
        const importRow = new Adw.ActionRow({
            title: "Import",
            subtitle: "Create servers from a previously exported JSON file.",
        });
        const importImage = new Gtk.Image({
            icon_name: "footeware-arrow-into-box-symbolic",
            pixel_size: 16,
        });
        const importButton = Gtk.Button.new();
        importButton.set_child(importImage);
        importRow.add_suffix(importButton);
        importButton.connect("clicked", () => {
            const dialog = new Gtk.FileDialog({
                modal: true,
            });
            dialog.open(this.window, null, (dialog, result) => {
                this.importCallback(dialog, result, this);
            });
        });
        operationsGroup.add(importRow);

        // export
        const exportRow = new Adw.ActionRow({
            title: "Export",
            subtitle: "Save servers to a JSON file.",
        });
        const exportImage = new Gtk.Image({
            icon_name: "footeware-arrow-out-of-box-symbolic",
            pixel_size: 16,
        });
        const exportButton = Gtk.Button.new();
        exportButton.set_child(exportImage);
        exportRow.add_suffix(exportButton);
        exportButton.connect("clicked", () => {
            const dialog = new Gtk.FileDialog({
                modal: true,
                initial_name: "ServerStatusExport.json",
            });
            dialog.save(this.window, null, (dialog, result) => {
                this.exportCallback(dialog, result, this.window);
            });
        });
        operationsGroup.add(exportRow);

        // add
        const addRow = new Adw.ActionRow({
            title: "Add a new server",
        });
        const addButton = Gtk.Button.new_from_icon_name("list-add-symbolic");
        addButton.set_css_classes(["suggested-action"]);
        addRow.add_suffix(addButton);
        addButton.connect("clicked", () => {
            // ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
            const newGroup = new ServerGroup(this, null); // widgets will not be initialized but group will be expanded
            newGroup
                .getGroup()
                .insert_after(operationsGroup.parent, operationsGroup); // add group to top of groups
            this.serverGroups.unshift(newGroup); // add to beginning of array
            this.save(this, this.serverGroups);

            // make name field focused
            newGroup.getNameInput().grab_focus();
        });
        operationsGroup.add(addRow);
        this.page.add(operationsGroup);

        // create one server group per discovered settings
        const parsedSettings = SettingsParser.parseGtkSettings(
            this.gioSettings,
        );
        // add them back reversed, same as they were created
        const reversed = parsedSettings.toReversed();
        for (const savedSettings of reversed) {
            // ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
            const newGroup = new ServerGroup(this, savedSettings);
            newGroup
                .getGroup()
                .insert_after(operationsGroup.parent, operationsGroup);
            this.serverGroups.unshift(newGroup); // add to beginning of array
        }

        this.window.add(this.page);
    }

    /**
     * Render the displayed groups in their new order.
     *
     * @param {ExtensionPreferences} preferences
     */
    reorder(preferences) {
        // remove all Adw.PreferenceGroups related to ServerGroups and...
        for (const serverGroup of preferences.serverGroups) {
            // remove it from whatever position it's in
            preferences.page.remove(serverGroup.getGroup());
        }

        // ...add them back in new order
        for (const serverGroup of preferences.serverGroups) {
            // add sequentially
            preferences.page.add(serverGroup.getGroup());
        }
    }

    /**
     * Save current server settings to gsettings.
     *
     * @param {ServerStatusPreferences} preferences
     */
    save(preferences) {
        const serverSettingList = [];
        for (const serverGroup of preferences.serverGroups) {
            const settings = serverGroup.settings;
            if (settings) {
                settings.name = settings.name.trim();
                settings.url = settings.url.trim();
                settings.frequency = settings.frequency.toString();
                settings.is_get = settings.is_get.toString();
                serverSettingList.push(settings);
            }
        }
        // persist
        preferences.gioSettings.set_value(
            "server-settings",
            new GLib.Variant("aa{ss}", serverSettingList),
        );
        Gio.Settings.sync();
    }

    /**
     * Saves the selected file and notifies user.
     *
     * @param {Gtk.Dialog} dialog
     * @param {Gio.AsyncResult} result
     * @param {ServerStatusPreferences} preferences
     */
    importCallback(dialog, result, preferences) {
        let file;
        let message = "";
        try {
            file = dialog.open_finish(result);
            const filePath = file.get_path();
            const [ok, contents] = GLib.file_get_contents(filePath);
            if (ok) {
                let importedMap;
                try {
                    let decoded = new TextDecoder().decode(contents);
                    // replace single with double quotes for JSON
                    decoded = decoded.replace(/'/g, '"');
                    importedMap = JSON.parse(decoded);
                    if (importedMap.length == 0) {
                        message = "No servers found in file.";
                    } else {
                        // remove all currently displayed groups
                        if (preferences.serverGroups) {
                            for (let group of preferences.serverGroups) {
                                preferences.page.remove(group.getGroup()); // remove widget
                            }
                        }
                        // populate serverGroups array
                        preferences.serverGroups = [];
                        // create ServerSetting
                        const serverSettings =
                            SettingsParser.parseMap(importedMap);
                        for (const settings of serverSettings) {
                            const newGroup = new ServerGroup(
                                preferences,
                                settings,
                            );
                            preferences.serverGroups.push(newGroup);
                        }
                        // add new groups
                        for (const serverGroup of preferences.serverGroups) {
                            // add sequentially
                            preferences.page.add(serverGroup.getGroup());
                        }
                        preferences.save(preferences);
                        message = "Settings imported.";
                    }
                } catch (err) {
                    message = err.message;
                }
            } else {
                message = "Error. Import failed.";
            }
        } catch (err) {
            message = err.message;
        }
        const toast = new Adw.Toast({
            title: message,
        });
        preferences.window.add_toast(toast);
    }

    /**
     * Saves the selected file and notifies user.
     *
     * @param {Gtk.Dialog} dialog
     * @param {Gio.AsyncResult} result
     * @param {Gtk.Window} window
     */
    exportCallback(dialog, result, window) {
        let message;
        try {
            const file = dialog.save_finish(result);
            const filePath = file.get_path();
            const [ok, output] = GLib.spawn_command_line_sync(
                "dconf read /org/gnome/shell/extensions/serverstatus/server-settings",
            );
            if (ok) {
                const json = new TextDecoder().decode(output);
                const isContentSet = GLib.file_set_contents(filePath, json);
                message = isContentSet
                    ? "File saved."
                    : "Error. File not saved.";
            } else {
                message = "Error. Server settings not found.";
            }
        } catch (err) {
            message = err.message;
        }
        const toast = new Adw.Toast({
            title: message,
        });
        window.add_toast(toast);
    }
}
