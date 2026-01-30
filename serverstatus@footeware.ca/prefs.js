"use strict";

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { ServerGroup } from "./serverGroup.js";
import { SettingsParser } from "./settingsParser.js";

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
        this.window = window; // used in serverGroup.js
        this.page = new Adw.PreferencesPage();
        this.savedSettings = this.getSettings();
        this.serverGroups = [];

        // destroy on close
        window.connect("close-request", () => {
            this.serverGroups = null;
            this.savedSettings = null;
            this.page = null;
        });

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
            label: "If you get a server-bad indicator, there's something wrong with\nthe URL. It should be of format http[s]://host[:port][/path].",
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
            this.save();

            // make name field focused
            newGroup.getNameInput().grab_focus();
        });
        operationsGroup.add(addRow);
        this.page.add(operationsGroup);

        // create one server group per discovered settings
        const parsedSettings = SettingsParser.parseGioSettings(
            this.savedSettings,
        );
        // add them back reversed, same as they were created, and displayed in indicator
        const reversed = parsedSettings.toReversed();
        for (const savedSettings of reversed) {
            // ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
            const newGroup = new ServerGroup(this, savedSettings);
            newGroup
                .getGroup()
                .insert_after(operationsGroup.parent, operationsGroup);
            this.serverGroups.unshift(newGroup); // add to beginning of array
        }

        window.add(this.page);
    }

    /**
     * Render the displayed groups in their new order.
     */
    reorder() {
        // remove all Adw.PreferenceGroups related to ServerGroups and...
        for (const serverGroup of this.serverGroups) {
            // remove it from whatever position it's in
            this.page.remove(serverGroup.getGroup());
        }

        // ...add them back in new order
        for (const serverGroup of this.serverGroups) {
            // add sequentially
            this.page.add(serverGroup.getGroup());
        }
    }

    /**
     * Save current server settings to gsettings.
     */
    save() {
        const serverSettings = [];
        if (this.serverGroups !== null) {
            for (const serverGroup of this.serverGroups) {
                const settings = serverGroup.settings;
                if (settings) {
                    settings.name = settings.name.trim();
                    settings.url = settings.url.trim();
                    settings.frequency = settings.frequency.toString();
                    settings.timeout = settings.timeout.toString();
                    settings.isGet = settings.isGet.toString();
                    serverSettings.push(settings);
                }
            }
        }
        this.savedSettings.set_value(
            "server-settings",
            new GLib.Variant("aa{ss}", serverSettings),
        );
        // persist
        Gio.Settings.sync();
    }
}
