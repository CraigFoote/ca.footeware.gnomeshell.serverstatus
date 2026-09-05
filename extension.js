'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ServerStatusPanel} from './serverStatusPanel.js';
import {Status} from './status.js';
import {IconProvider} from './iconProvider.js';
import {Indicator} from './indicator.js';
import {SettingsParser} from './settingsParser.js';
import {ConnectivityListener} from './connectivityListener.js';

/**
 * The main extension class. Creates an `Indicator` and keeps
 * it updated based on status of specified servers' settings.
 */
export default class ServerStatusIndicatorExtension extends Extension {
    enable() {
        this.iconProvider = new IconProvider(`${this.path}/assets/`);

        this.indicator = new Indicator(
            _(this.metadata.name),
            this.iconProvider
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

        // ServerStatusPanels, one per server setting
        this.createStatusPanels();

        // button box for the prefs and notifs buttons
        const buttonBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_expand: true,
        });

        this.indicator.menu.box.add_child(buttonBox);

        // Open Prefs button
        this.prefsIcon = new St.Icon({
            gicon: this.iconProvider.getPreferencesIcon(),
            style_class: 'panel-button',
        });
        this.prefsButton = new St.Button({
            style_class: 'panel-button padded',
            track_hover: true,
            reactive: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            can_focus: true,
            accessible_name: 'Preferences',
            child: this.prefsIcon,
        });
        this.prefsButtonId = this.prefsButton.connect('clicked', async () => {
            this.indicator.menu.close();
            await this.openPreferences();
        });
        // aligning container
        const prefsBin = new St.Bin({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        prefsBin.child = this.prefsButton;

        buttonBox.add_child(prefsBin);

        // Toggle Notifications button
        this.notifsIcon = new St.Icon({
            gicon: this.iconProvider.getNotificationsIcon(true),
            style_class: 'panel-button',
        });
        this.notifsButton = new St.Button({
            style_class: 'panel-button padded',
            track_hover: true,
            reactive: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            can_focus: true,
            accessible_name: 'Toggle Notifications',
            child:  this.notifsIcon,
        });
        this.notifsButtonId = this.notifsButton.connect('clicked', () => {
            // swap icons
            if (this.notifsIcon.gicon === this.iconProvider.getNotificationsIcon(true))
                this.notifsIcon.gicon = this.iconProvider.getNotificationsIcon(false); // false for -no icon
            else
                this.notifsIcon.gicon = this.iconProvider.getNotificationsIcon(true);
        });
        // aligning container
        const notifsBin = new St.Bin({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        notifsBin.child = this.notifsButton;

        buttonBox.add_child(notifsBin);

        // listen for changes to server settings in gsettings and update display
        this.extensionListenerId = this.rawSettings.connect('changed', () => {
            this.onPrefChanged();
        });

        // listen for connectivity changes
        this.connectivityListener = new ConnectivityListener(
            // not globally connected
            () => {
                this.indicator?.getStatusPanels().forEach(panel => panel.suspend());
                this.indicator?.updatePanelIcon(Status.Init);
            },
            // globally connected
            () => {
                this.indicator?.getStatusPanels().forEach(panel => panel.resume());
            }
        );
    };

    /**
     * Destroys and nulls artifacts for garbage collection.
     */
    disable() {
        // disconnect listeners for click events
        if (this.prefsButton && this.prefsButtonId) {
            this.prefsButton.disconnect(this.prefsButtonId);
            this.prefsButton.destroy();
            this.prefsButton = null;
            this.prefsButtonId = null;
        }
        if (this.notifsButton && this.notifsButtonId) {
            this.notifsButton.disconnect(this.notifsButtonId);
            this.notifsButton.destroy();
            this.notifsButton = null;
            this.notifsButtonId = null;
        }
        // disconnect listener for pref changes
        if (this.rawSettings && this.extensionListenerId) {
            this.rawSettings.disconnect(this.extensionListenerId);
            this.extensionListenerId = null;
        }
        // clean up connectivity listener
        if (this.connectivityListener) {
            this.connectivityListener.destroy();
            this.connectivityListener = null;
        }
        // clean up status panels through indicator
        if (this.indicator)
            this.indicator.clearStatusPanels();

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
        this.notifsIcon = null;
        this.prefsIcon = null;
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
        this.savedSettings = SettingsParser.parseGioSettings(this.getSettings());
        // recreate panel items, one per server setting
        for (const savedSetting of this.savedSettings) {
            if (savedSetting.visible) {
                const panel = new ServerStatusPanel(
                    savedSetting,
                    () => this.updateIcon(),
                    this.iconProvider,
                    () => this.isNotifying() // callback
                );
                this.serversBox.add_child(panel);
                this.indicator.addStatusPanel(panel);
            }
        }
        this.updateIcon();
    }

    /**
     * Update the indicator icon based on changes in server settings.
     */
    updateIcon() {
        if (!this.indicator)
            return;

        const statusList = [];
        const panels = this.indicator.getStatusPanels();
        for (const panel of panels) {
            const status = panel.getStatus();
            statusList.push(status);
        }
        // determine worst status, check worst to best statuses
        let worstStatus;
        if (statusList.includes(Status.Down))
            worstStatus = Status.Down;
        else if (statusList.includes(Status.Bad))
            worstStatus = Status.Bad;
        else if (statusList.includes(Status.Init))
            worstStatus = Status.Init;
        else if (statusList.includes(Status.Up))
            worstStatus = Status.Up;

        // update the panel icon
        this.indicator.updatePanelIcon(worstStatus);
    }

    /**
     * Create status panel items, one per server setting.
     */
    createStatusPanels() {
        for (const savedSetting of this.savedSettings) {
            if (savedSetting.visible) {
                const panel = new ServerStatusPanel(
                    savedSetting,
                    () => this.updateIcon(), // callback
                    this.iconProvider,
                    () => this.isNotifying() // callback
                );
                this.serversBox.add_child(panel);
                this.indicator.addStatusPanel(panel);
            }
        }
    }

    /**
     * Determines if this extension is currently notifying user when a server is down.
     *
     * @returns boolean true if this extension should notify user
     */
    isNotifying() {
        return this.notifsIcon.gicon === this.iconProvider.getNotificationsIcon(true);
    }
}
