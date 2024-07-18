"use strict";

import GObject from "gi://GObject";
import St from "gi://St";
import {
    Extension,
    gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { ServerSetting } from "./serverSetting.js";
import { ServerStatusPanel } from "./serverStatusPanel.js";
import { Status } from "./status.js";
import { IconProvider } from "./iconProvider.js";

let iconProvider;
let panelIcon;
let statusPanels;
let extensionListenerId;

/**
 * The taskbar indicator with a clickable icon showing worst status of all server statuses.
 */
const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _("Server Status Indicator"));
            panelIcon = new St.Icon({
                gicon: iconProvider.getIcon(Status.Init),
                style_class: "system-status-icon",
            });
            this.add_child(panelIcon);
            statusPanels = [];
        }
    },
);

/**
 * The main extension class. Creates an <code>Indicator</code> and keeps
 * it updated based on status of specified servers settings.
 */
export default class ServerStatusIndicatorExtension extends Extension {
    enable() {
        iconProvider = new IconProvider(this.path + "/assets/");

        // get settings stored in gsettings
        this.rawSettings = this.getSettings();
        this.indicator = new Indicator();

        // add the indicator to the taskbar
        Main.panel.addToStatusArea(this.uuid, this.indicator);
        this.savedSettings = this.parseSettings();

        // create a box to hold server panels
        this.serversBox = new St.BoxLayout({
            vertical: true,
        });
        this.indicator.menu.box.add_child(this.serversBox);

        // panel items, one per server setting
        for (const savedSetting of this.savedSettings) {
            const panel = new ServerStatusPanel(
                savedSetting,
                this.updateIcon,
                iconProvider,
            );
            this.serversBox.add_child(panel);
            statusPanels.push(panel);
        }

        // Open Prefs button
        const prefsButton = new St.Button({
            icon_name: "preferences-system-symbolic",
            style_class: "prefs-button",
        });
        prefsButton.connect("clicked", () => {
            this.indicator.menu.close();
            this.openPreferences();
        });
        this.indicator.menu.box.add_child(prefsButton);

        // listen for changes to server settings in gsettings and update display
        extensionListenerId = this.rawSettings.connect("changed", () => {
            this.onPrefChanged();
        });
    }

    /**
     * Destroys and nulls artifacts for garbage collection.
     */
    disable() {
        this.rawSettings.disconnect(extensionListenerId);
        extensionListenerId = null;
        this.savedSettings = null;
        this.indicator.destroy();
        this.indicator = null;
        this.rawSettings = null;
        if (iconProvider) {
            iconProvider.destroy();
            iconProvider = null;
        }
        panelIcon = null;
        statusPanels = [];
    }

    /**
     * Creates <code>ServerSetting</code> objects based on discovered gsettings entries.
     *
     * @returns {ServerSetting[]}
     */
    parseSettings() {
        const variant = this.rawSettings.get_value("server-settings");
        const saved = variant.deep_unpack();
        const savedSettings = [];
        for (const rawSetting of saved) {
            const name =
                rawSetting["name"] != undefined ? rawSetting["name"] : "";
            const url = rawSetting["url"] != undefined ? rawSetting["url"] : "";
            const frequency =
                rawSetting["frequency"] != undefined
                    ? rawSetting["frequency"]
                    : "60";
            const is_get =
                rawSetting["is_get"] != undefined
                    ? rawSetting["is_get"]
                    : "false";
            const setting = new ServerSetting(name, url, frequency, is_get);
            savedSettings.push(setting);
        }
        return savedSettings;
    }

    /**
     * Preferences have changed the set of server settings so we can update the indicator icon.
     */
    onPrefChanged() {
        panelIcon.gicon = iconProvider.getIcon(Status.Init);
        statusPanels = [];
        // clear server box and repopulate
        this.serversBox.destroy_all_children();
        this.savedSettings = this.parseSettings();
        // panel items, one per server setting
        for (const savedSetting of this.savedSettings) {
            const panel = new ServerStatusPanel(
                savedSetting,
                this.updateIcon,
                iconProvider,
            );
            this.serversBox.add_child(panel);
            statusPanels.push(panel);
        }
        this.updateIcon();
    }

    /**
     * Update the indicator icon based on changes in server settings.
     */
    updateIcon() {
        const statusList = [];
        for (const statusPanel of statusPanels) {
            const status = statusPanel.getStatus();
            statusList.push(status);
        }
        // determine worst status
        let haveDown = false;
        let haveBad = false;
        let haveUp = false;
        for (const s of statusList) {
            if (s === Status.Down) {
                haveDown = true;
            } else if (s === Status.Bad) {
                haveBad = true;
            } else if (s === Status.Up) {
                haveUp = true;
            }
        }
        // set taskbar indicator icon with appropriate color
        if (panelIcon) {
            if (haveDown) {
                panelIcon.gicon = iconProvider.getIcon(Status.Down);
            } else if (haveBad) {
                panelIcon.gicon = iconProvider.getIcon(Status.Bad);
            } else if (haveUp) {
                panelIcon.gicon = iconProvider.getIcon(Status.Up);
            } else {
                panelIcon.gicon = iconProvider.getIcon(Status.Init);
            }
        }
    }
}
