"use strict";

import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import { ServerSetting } from "./serverSetting.js";

/**
 * A new group is displayed when _Add_ is clicked in the preferences dialog.
 * It displays controls for the settings of a server.
 */
export class ServerGroup {
    /**
     * Constructor.
     *
     * @param {ServerStatusPreferences} preferences
     * @param {ServerSetting} settings, may be null in which case the fields remain empty, expander is automatically opened and name field focused.
     */
    constructor(preferences, settings) {
        this.id = this.createUID();
        this.preferences = preferences;
        this.serverSettingGroup = new Adw.PreferencesGroup({});

        // expander
        this.expander = new Adw.ExpanderRow();
        // disable pango as it fails on & in url query strings
        this.expander.set_use_markup(false);
        const title = settings?.name ?? "";
        this.expander.set_title(title);
        const subtitle = settings
            ? `${settings.isGet ? "GET" : "HEAD"} : ${settings.url} @ ${settings.frequency}s`
            : "";
        this.expander.set_subtitle(subtitle);
        this.serverSettingGroup.add(this.expander);

        // name text field
        this.nameRow = new Adw.EntryRow({
            title: "Name",
            text: settings?.name ?? "",
            show_apply_button: true,
        });
        this.nameRow.connect("apply", () => {
            this.update();
        });
        this.expander.add_row(this.nameRow);

        // url text field
        this.urlRow = new Adw.EntryRow({
            title: "URL",
            text: settings?.url ?? "",
            show_apply_button: true,
        });
        this.urlRow.connect("apply", () => {
            this.update();
        });
        this.expander.add_row(this.urlRow);

        // frequency spinner
        this.frequencyRow = Adw.SpinRow.new_with_range(10, 300, 10);
        this.frequencyRow.set_value(settings?.frequency ?? 120);
        this.frequencyRow.set_title("Frequency (secs.)");
        this.frequencyRow.connect("input", () => {
            this.update();
        });
        this.expander.add_row(this.frequencyRow);

        // 'use GET' switch
        this.useGetSwitchRow = new Adw.SwitchRow({
            title: "Use GET rather than HEAD",
        });
        const isGet = settings?.isGet ?? false;
        this.useGetSwitchRow.set_active(isGet);
        this.useGetSwitchRow.connect("notify::active", () => {
            this.update();
        });
        this.expander.add_row(this.useGetSwitchRow);

        // move up/down row
        const moveRow = new Adw.ActionRow({
            title: "Move Up/Down",
        });
        const moveUpButton = Gtk.Button.new_from_icon_name("go-up-symbolic");
        moveUpButton.connect("clicked", () => {
            // does a move actually happen?
            if (this.moveUp(preferences.serverGroups)) {
                preferences.reorder();
                preferences.save();
            }
        });
        const moveDownButton =
            Gtk.Button.new_from_icon_name("go-down-symbolic");
        moveDownButton.connect("clicked", () => {
            // does a move actually happen?
            if (this.moveDown(preferences.serverGroups)) {
                preferences.reorder();
                preferences.save();
            }
        });
        const moveButtonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        moveButtonBox.append(moveUpButton);
        moveButtonBox.append(moveDownButton);
        moveRow.add_suffix(moveButtonBox);
        this.serverSettingGroup.add(moveRow);

        // delete button
        const deleteRow = new Adw.ActionRow({
            title: "Delete this server",
        });
        const deleteButton = Gtk.Button.new_from_icon_name(
            "edit-delete-symbolic",
        );
        deleteButton.set_css_classes(["destructive-action"]);
        deleteRow.add_suffix(deleteButton);
        this.serverSettingGroup.add(deleteRow);
        deleteButton.connect("clicked", () => {
            const messageDialog = new Adw.MessageDialog({
                transient_for: preferences.window,
                destroy_with_parent: true,
                modal: true,
                heading: "Confirm Delete",
                body: "Are you sure you want to delete this server?",
            });
            messageDialog.add_response("cancel", "_Cancel");
            messageDialog.add_response("delete", "_Delete");
            messageDialog.set_response_appearance(
                "delete",
                Adw.ResponseAppearance.ADW_RESPONSE_DESTRUCTIVE,
            );
            messageDialog.set_default_response("cancel");
            messageDialog.set_close_response("cancel");
            messageDialog.connect("response", (_, response) => {
                if (response === "delete") {
                    this.createServerSettings();
                    this.removeGroup(this.id, preferences.serverGroups);
                    preferences.page.remove(this.serverSettingGroup);
                    preferences.save();
                }
                messageDialog.destroy();
            });
            messageDialog.present();
        });

        this.createServerSettings();

        if (settings === null) {
            this.expander.set_expanded(true);
            this.nameRow.grab_focus();
        }
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
     * @returns {String}
     */
    getTitle() {
        return this.nameRow.text;
    }

    /**
     * Get the subtitle based on user input.
     *
     * @returns {String}
     */
    getSubtitle() {
        const url = this.urlRow.text;
        const freq = this.frequencyRow.text;
        const httpMethod = this.useGetSwitchRow.active ? "GET" : "HEAD";
        return httpMethod + " : " + url + " @ " + freq + "s";
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
     * @param {ServerGroup} array of `ServerGroup`s
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
     * @param {ServerGroup} array of `ServerGroup`s
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
     * @param {ServerGroup} array of `ServerGroup`s
     * @returns int
     * @throws Error if index cannot be determined
     */
    getPosition(serverGroups) {
        for (let i = 0; i < serverGroups.length; i++) {
            const serverGroup = serverGroups[i];
            if (serverGroup.id === this.id) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Move `this` in provided array using provided 'from' index and 'to' index.
     *
     * @param {int} fromIndex the position being moved from
     * @param {int} toIndex the move destination
     * @param {ServerGroup} array of `ServerGroup`s
     */
    move(fromIndex, toIndex, serverGroups) {
        const serverGroup = serverGroups[fromIndex];
        serverGroups.splice(fromIndex, 1);
        serverGroups.splice(toIndex, 0, serverGroup);
    }

    /**
     * Return this group's server settings.
     *
     * @returns {ServerSetting}
     */
    getSettings() {
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
            this.frequencyRow.value,
            this.useGetSwitchRow.active,
        );
    }

    /**
     * Create a unique ID for this group.
     *
     * @returns {String}
     */
    createUID() {
        const buffer = [];
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charlen = chars.length;
        for (let i = 0; i < 32; i++) {
            buffer[i] = chars.charAt(Math.floor(Math.random() * charlen));
        }
        return buffer.join("");
    }

    /**
     * Remove the group with supplied id from the provided set of groups.
     *
     * @param {String} id the id of the group to remove
     * @param {ServerGroup} array of `ServerGroup`s without group with supplied id
     */
    removeGroup(id, serverGroups) {
        for (let i = 0; i < serverGroups.length; i++) {
            const candidate = serverGroups[i];
            if (candidate.id === id) {
                serverGroups.splice(i, 1);
                break;
            }
        }
    }
}
