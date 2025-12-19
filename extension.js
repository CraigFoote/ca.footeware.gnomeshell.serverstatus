"use strict";

import St from "gi://St";
import Clutter from "gi://Clutter";
import {
    Extension,
    gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { ServerStatusPanel } from "./serverStatusPanel.js";
import { Status } from "./status.js";
import { IconProvider } from "./iconProvider.js";
import { Indicator } from "./indicator.js";
import { SettingsParser } from "./settingsParser.js";

/**
 * The main extension class. Creates an `Indicator` and keeps
 * it updated based on status of specified servers settings.
 */
export default class ServerStatusIndicatorExtension extends Extension {
    enable() {
        this.iconProvider = new IconProvider(this.path + "/assets/");

        this.indicator = new Indicator(
            _(this.metadata.name),
            this.iconProvider,
        );
        Main.panel.addToStatusArea(this.uuid, this.indicator);

        // create a box to hold server panels
        this.serversBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
        });
        this.indicator.menu.box.add_child(this.serversBox);

        // get settings stored in gsettings
        this.rawSettings = this.getSettings();
        this.savedSettings = SettingsParser.parseGioSettings(this.rawSettings);

        // panel items, one per server setting
        for (const savedSetting of this.savedSettings) {
            const panel = new ServerStatusPanel(
                savedSetting,
                () => this.updateIcon(),
                this.iconProvider,
            );
            this.serversBox.add_child(panel);
            this.indicator.addStatusPanel(panel);
        }

        // Open Prefs button
        const prefsButton = new St.Button({
            icon_name: "preferences-system-symbolic",
            style_class: "prefs-button padded",
            track_hover: true,
            reactive: true,
        });
        prefsButton.connect("clicked", () => {
            this.indicator.menu.close();
            this.openPreferences();
        });

        this.indicator.menu.box.add_child(prefsButton);

        // listen for changes to server settings in gsettings and update display
        this.extensionListenerId = this.rawSettings.connect("changed", () => {
            this.onPrefChanged();
        });
    }

    /**
     * Destroys and nulls artifacts for garbage collection.
     */
    disable() {
        // disconnect listener for pref changes
        if (this.rawSettings && this.extensionListenerId) {
            this.rawSettings.disconnect(this.extensionListenerId);
            this.extensionListenerId = null;
        }
        // clean up status panels through indicator
        if (this.indicator) {
            this.indicator.clearStatusPanels();
        }
        // clean up the serversBox
        if (this.serversBox) {
            this.serversBox.destroy();
            this.serversBox = null;
        }
        // clean up the indicator
        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = null;
        }
        // destroy icon provider and its icons
        if (this.iconProvider) {
            this.iconProvider.destroy();
            this.iconProvider = null;
        }
        // clean up other stuff
        this.savedSettings.length = 0; // dereference elements
        this.savedSettings = null;
        this.rawSettings.length = 0; // dereference elements
        this.rawSettings = null;
    }

    /**
     * Preferences have changed the set of server settings so we
     * need to update the indicator icon and menu server panels.
     */
    onPrefChanged() {
        this.indicator.updatePanelIcon(Status.Init);
        // clear servers' box and repopulate
        this.indicator.clearStatusPanels();
        this.serversBox.destroy_all_children();
        this.savedSettings = SettingsParser.parseGioSettings(this.rawSettings);
        // recreate panel items, one per server setting
        for (const savedSetting of this.savedSettings) {
            const panel = new ServerStatusPanel(
                savedSetting,
                () => this.updateIcon(),
                this.iconProvider,
            );
            this.serversBox.add_child(panel);
            this.indicator.addStatusPanel(panel);
        }
        this.updateIcon();
    }

    /**
     * Update the indicator icon based on changes in server settings.
     */
    updateIcon() {
        if (!this.indicator) {
            return;
        }
        const statusList = [];
        const panels = this.indicator.getStatusPanels();
        for (const panel of panels) {
            const status = panel.getStatus();
            statusList.push(status);
        }
        // determine worst status, check worst to best statuses
        let worstStatus;
        if (statusList.includes(Status.Down)) {
            worstStatus = Status.Down;
        } else if (statusList.includes(Status.Bad)) {
            worstStatus = Status.Bad;
        } else if (statusList.includes(Status.Init)) {
            worstStatus = Status.Init;
        } else if (statusList.includes(Status.Up)) {
            worstStatus = Status.Up;
        }
        // update the panel icon
        this.indicator.updatePanelIcon(worstStatus);
    }
}
