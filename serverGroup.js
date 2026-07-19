'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import {ServerSetting} from './serverSetting.js';

/**
 * A new group is displayed when _Add_ is clicked in the preferences dialog.
 * It displays controls for the settings of a server.
 */
export class ServerGroup {
    /**
     * Constructor.
     *
     * @param {ServerStatusPreferences} preferences
     * @param {ServerSetting} settings may be null in which case the fields remain empty,
     *          expander is automatically opened and name field focused.
     * @param {Gtk.ListBox} listBox
     */
    constructor(preferences, settings, listBox) {
        this.id = this.createUID();
        this.listBox = listBox;
        this.preferences = preferences;
        this.serverSettingGroup = new Adw.PreferencesGroup();

        // expander
        this.expander = this.getExpanderRow(settings);

        // visibility row - show/hide server without deleting
        this.visible = settings?.visible ?? true;
        const visibilityRow = new Adw.ActionRow({
            title: 'Show in menu',
            subtitle: 'Hidden servers are not displayed and not checked.',
        });
        const visibilityIcon = this.visible ? 'view-reveal-symbolic' : 'view-conceal-symbolic';
        this.visibilityButton = Gtk.Button.new_from_icon_name(visibilityIcon);
        this.visibilityHandlerId = this.visibilityButton.connect('clicked', () => {
            this.visible = !this.visible;
            const newIcon = this.visible ? 'view-reveal-symbolic' : 'view-conceal-symbolic';
            this.visibilityButton.set_icon_name(newIcon);
            this.update();
        });
        visibilityRow.add_suffix(this.visibilityButton);
        this.serverSettingGroup.add(visibilityRow);

        // delete button
        const deleteRow = new Adw.ActionRow({
            title: 'Delete this server',
        });
        this.deleteButton = Gtk.Button.new_from_icon_name(
            'edit-delete-symbolic'
        );
        this.deleteButton.set_css_classes(['destructive-action']);
        deleteRow.add_suffix(this.deleteButton);
        this.serverSettingGroup.add(deleteRow);
        this.deleteHandlerId = this.deleteButton.connect('clicked', () => {
            preferences.doDelete(this);
        });

        this.createServerSettings();

        if (settings === null) {
            this.expander.set_expanded(true);
            this.nameRow.grab_focus();
        }
    }

    /**
     * Create the expander row with all the controls for this server group.
     *
     * @param {ServerSetting} settings
     * @returns {Adw.ExpanderRow}
     */
    getExpanderRow(settings) {
        this.expander = new Adw.ExpanderRow();
        // disable pango as it fails on & in url query strings
        this.expander.set_use_markup(false);
        // title
        const title = settings?.name ?? '';
        this.expander.set_title(title);
        // subtitle
        this.expander.set_subtitle(this.initSubtitle(settings));
        this.serverSettingGroup.add(this.expander);

        this.expander.add_prefix(new Gtk.Image({
            icon_name: 'list-drag-handle-symbolic',
        }));

        // name text field
        this.nameRow = new Adw.EntryRow({
            title: 'Name',
            text: settings?.name ?? '',
            show_apply_button: true,
        });
        this.nameHandlerId = this.nameRow.connect('apply', () => {
            this.update();
        });
        this.expander.add_row(this.nameRow);

        // url text field
        this.urlRow = new Adw.EntryRow({
            title: 'URL',
            text: settings?.url ?? '',
            show_apply_button: true,
        });
        this.urlHandlerId = this.urlRow.connect('apply', () => {
            this.update();
        });
        this.expander.add_row(this.urlRow);

        // frequency spinner
        this.frequencyRow = Adw.SpinRow.new_with_range(10, 300, 10);
        this.frequencyRow.set_value(settings?.frequency ?? 120);
        this.frequencyRow.set_title('Frequency (secs.)');
        this.frequencyHandlerId = this.frequencyRow.connect('notify::value', () => {
            this.update();
        });
        this.expander.add_row(this.frequencyRow);

        // timeout spinner
        this.timeoutRow = Adw.SpinRow.new_with_range(1, 300, 1);
        this.timeoutRow.set_value(settings?.timeout ?? 10);
        this.timeoutRow.set_title('Timeout (secs.)');
        this.timeoutHandlerId = this.timeoutRow.connect('notify::value', () => {
            this.update();
        });
        this.expander.add_row(this.timeoutRow);

        // 'use GET' switch
        this.useGetSwitchRow = new Adw.SwitchRow({
            title: 'Use GET rather than HEAD',
        });
        const isGet = settings?.isGet ?? false;
        this.useGetSwitchRow.set_active(isGet);
        this.useGetHandlerId = this.useGetSwitchRow.connect('notify::active', () => {
            this.update();
        });
        this.expander.add_row(this.useGetSwitchRow);

        // 'ignoreTLSErrors' switch
        this.ignoreTLSErrorsSwitchRow = new Adw.SwitchRow({
            title: 'Ignore TLS certificate errors',
            subtitle: 'self-signed, etc.',
        });
        const ignoreTLSErrors = settings?.ignoreTLSErrors ?? false;
        this.ignoreTLSErrorsSwitchRow.set_active(ignoreTLSErrors);
        this.ignoreTLSErrorsHandlerId = this.ignoreTLSErrorsSwitchRow.connect('notify::active', () => {
            this.update();
        });
        this.expander.add_row(this.ignoreTLSErrorsSwitchRow);

        // 'use notifications' switch
        this.useNotificationsSwitchRow = new Adw.SwitchRow({
            title: 'Notify when down',
        });
        const notifies = settings?.notifies ?? false;
        this.useNotificationsSwitchRow.set_active(notifies);
        this.useNotificationsHandlerId = this.useNotificationsSwitchRow.connect('notify::active', () => {
            this.update();
        });
        this.expander.add_row(this.useNotificationsSwitchRow);
        return this.expander;
    }

    /**
     * Set the initial subtitle based on provided settings.
     *
     * @param {ServerSetting} settings
     * @returns {string}
     */
    initSubtitle(settings) {
        if (!settings)
            return '';

        const notifiesIndicator = settings.notifies ? '🔔' : '';
        const ignoreTLSErrorsIndicator = settings.ignoreTLSErrors ? '⚠️' : '';
        return `${settings.isGet ? 'GET' : 'HEAD'} ${settings.url} @ ${settings.frequency}s with ${settings.timeout}s timeout ${notifiesIndicator} ${ignoreTLSErrorsIndicator}`;
    }

    /**
     * Renew #serverSettings, save them and update UI.
     */
    update() {
        this.createServerSettings();
        this.preferences.save();
        this.updateExpander();
    }

    /**
     * Get the title based on user input.
     *
     * @returns {string}
     */
    getTitle() {
        return this.nameRow.text;
    }

    /**
     * Get the subtitle based on user input.
     *
     * @returns {string}
     */
    getSubtitle() {
        const url = this.urlRow.text;
        const freq = this.frequencyRow.text;
        const timeout = this.timeoutRow.text;
        const httpMethod = this.useGetSwitchRow.active ? 'GET' : 'HEAD';
        const useNotificationsIndicator = this.useNotificationsSwitchRow.active ? '🔔' : '';
        const ignoreTLSErrorsIndicator = this.ignoreTLSErrorsSwitchRow.active ? '⚠️' : '';
        return `${httpMethod} ${url} @ ${freq}s with ${timeout}s timeout ${useNotificationsIndicator} ${ignoreTLSErrorsIndicator}`;
    }

    /**
     * Update the expander title & subtitle.
     */
    updateExpander() {
        this.expander.set_title(this.getTitle());
        this.expander.set_subtitle(this.getSubtitle());
    }

    /**
     * Move this `Adw.PreferenceGroup` down by one in the list.
     *
     * @param {[]} serverGroups array of {ServerGroup}s
     * @returns true if a move occurred.
     */
    moveDown(serverGroups) {
        const index = this.getPosition(serverGroups);
        if (index !== -1 && index < serverGroups.length - 1) {
            this.move(index, index + 1, serverGroups);
            return true;
        }
        return false; // no move was made
    }

    /**
     * Move this `Adw.PreferenceGroup` up by one in the list.
     *
     * @param {[]} serverGroups array of `ServerGroup`s
     * @returns true if a move occurred.
     */
    moveUp(serverGroups) {
        const index = this.getPosition(serverGroups);
        if (index > 0) {
            this.move(index, index - 1, serverGroups);
            return true;
        }
        return false; // no move was made
    }

    /**
     * Find the index of `this` in the provided array.
     *
     * @param {[]} serverGroups array of `ServerGroup`s
     * @returns int index of `this` in provided array, -1 if not found
     */
    getPosition(serverGroups) {
        for (let i = 0; i < serverGroups.length; i++) {
            const serverGroup = serverGroups[i];
            if (serverGroup.id === this.id)
                return i;
        }
        return -1;
    }

    /**
     * Move `this` in provided array using provided 'from' index and 'to' index.
     *
     * @param {int} fromIndex the position being moved from
     * @param {int} toIndex the move destination
     * @param {[]} serverGroups array of `ServerGroup`s
     */
    move(fromIndex, toIndex, serverGroups) {
        const serverGroup = serverGroups[fromIndex];
        serverGroups.splice(fromIndex, 1);
        serverGroups.splice(toIndex, 0, serverGroup);
    }

    /**
     * Return this group's server settings, creating it if null.
     *
     * @returns {ServerSetting}
     */
    getSettings() {
        if (!this.settings)
            this.createServerSettings();

        return this.settings;
    }

    /**
     * Return this preference group.
     *
     * @returns {Adw.PreferencesGroup}
     */
    getGroup() {
        return this.serverSettingGroup;
    }

    /**
     * Returns the _Name_ `EntryRow`.
     *
     * @returns {Adw.EntryRow}
     */
    getNameInput() {
        return this.nameRow;
    }

    /**
     * Create a `ServerSetting` based on control values.
     */
    createServerSettings() {
        this.settings = new ServerSetting(
            this.nameRow.text,
            this.urlRow.text,
            this.frequencyRow.text,
            this.timeoutRow.text,
            this.useGetSwitchRow.active,
            this.useNotificationsSwitchRow.active,
            this.visible,
            this.ignoreTLSErrorsSwitchRow.active
        );
    }

    /**
     * Create a unique ID for this group.
     *
     * @returns {string}
     */
    createUID() {
        const buffer = [];
        const chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charlen = chars.length;
        for (let i = 0; i < 32; i++)
            buffer[i] = chars.charAt(Math.floor(Math.random() * charlen));

        return buffer.join('');
    }

    /**
     * Disconnect listeners and dispose of boxed lists.
     */
    destroy() {
        this.#unplug(this.visibilityButton, this.visibilityHandlerId);
        this.#unplug(this.deleteButton, this.deleteHandlerId);
        this.#unplug(this.nameRow, this.nameHandlerId);
        this.#unplug(this.urlRow, this.urlHandlerId);
        this.#unplug(this.frequencyRow, this.frequencyHandlerId);
        this.#unplug(this.timeoutRow, this.timeoutHandlerId);
        this.#unplug(this.useGetSwitchRow, this.useGetHandlerId);
        this.#unplug(this.ignoreTLSErrorsSwitchRow, this.ignoreTLSErrorsHandlerId);
        this.#unplug(this.useNotificationsSwitchRow, this.useNotificationsHandlerId);

        this.listBox = null;
    }

    /**
     * Disconnect the handlerId from the control and set both to null.
     *
     * @param {Adw.*} control
     * @param {string} handlerId
     */
    #unplug(control, handlerId) {
        if (control && handlerId) {
            control.disconnect(handlerId);
            handlerId = null;
            control = null;
        }
    }
}
