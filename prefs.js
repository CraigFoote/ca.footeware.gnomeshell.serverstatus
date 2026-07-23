'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {ServerGroup} from './serverGroup.js';
import {SettingsParser} from './settingsParser.js';
import {DragDropSupport} from './dragDropSupport.js';

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
        window.connect('close-request', () => {
            this.destroy();
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
            file: `${this.path}/assets/server-init.svg`,
            pixel_size: 36,
        });
        const serverInitDesc = new Gtk.Label({
            label: 'Initializing...',
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
            file: `${this.path}/assets/server-down.svg`,
            pixel_size: 36,
        });
        const serverDownDesc = new Gtk.Label({
            label: 'If you get a server-down indicator, try switching to GET.\nHTTP HEAD is faster but not always supported.',
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
            file: `${this.path}/assets/server-bad.svg`,
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
            file: `${this.path}/assets/server-up.svg`,
            pixel_size: 36,
        });
        const serverUpDesc = new Gtk.Label({
            label: 'The desired server-up indicator.',
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
            title: 'Add a new server',
        });
        const addButton = Gtk.Button.new_from_icon_name('list-add-symbolic');
        addButton.set_css_classes(['suggested-action']);
        addRow.add_suffix(addButton);
        addButton.connect('clicked', () => {
            this.doAdd();
        });
        operationsGroup.add(addRow);
        this.page.add(operationsGroup);

        /*
         * serversGroup - contains a list of Adw.PreferencesGroups, one per server
         * and each a list of Adw.PreferencesRows.
         *
         * The whole structure is:
         *   Adw.PreferencesPage
         *    Adw.PreferencesGroup (helpGroup)
         *    Adw.PreferencesGroup (operationsGroup)
         *    Adw.PreferencesGroup (serversGroup)
         *     Gtk.ListBox (this.listBox)
         *      n * Gtk.ListBoxRow (this.listBox#get_child) (automatically injected)
         *       Adw.PreferencesGroup (serverGroup#getGroup)
         *        n * Adw.PreferencesRow (serverGroup#getGroup#get_row)
         *
         * @see DragDropSupport jsdoc
         */
        const serversGroup = new Adw.PreferencesGroup({
            title: 'Your Servers',
            description: 'Drag and drop to reorder.',
        }
        );
        // create one server group per discovered settings
        const parsedSettings = SettingsParser.parse(this.savedSettings);
        this.page.add(serversGroup);
        // add a Gtk.ListBox intermediate to facilitate drag and drop
        this.listBox = new Gtk.ListBox({
            css_classes: ['boxed-list'],
        });
        serversGroup.add(this.listBox);

        // create the actual `ServerGroup`s and their widgets
        this.createServerGroups(parsedSettings);

        // add drag & drop to `this.listBox` items
        this.dragDropSupport = new DragDropSupport(this.listBox);
        // add drag & drop to the listBoxRows of the listBox
        for (const listBoxRow of this.listBox) {
            // use title of expander row
            // pass row to get fresh value at time of 'drag-begin'
            const titleRow = listBoxRow.get_child().get_row(0);
            this.dragDropSupport.add(listBoxRow, titleRow, () => {
                this.updateModel(); // reset serverGroups[] after drop
                this.save();
            });
        }

        window.add(this.page);
    }

    /**
     * Add a new `ServerGroup` to the top of the list.
     */
    doAdd() {
        // ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
        const newGroup = new ServerGroup(this, null); // widgets will not be initialized but group will be expanded
        this.listBox.prepend(newGroup.getGroup()); // add to _beginning_ of PreferencesGroup
        this.serverGroups.unshift(newGroup); // add to beginning of array
        this.save();

        // find the Gtk.ListBoxRow for drag & drop
        // serverGroup.getGroup() > Adw.PreferencesGroup.parent
        const listBoxRow = newGroup.getGroup();

        // Use title of expander row, a Adw.PreferencesRow.
        // Pass row to get fresh value at time of 'drag-begin'
        const preferencesGroup = listBoxRow.parent;
        this.dragDropSupport.add(listBoxRow, preferencesGroup, () => {
            this.updateModel(); // reset serverGroups[] after drop
            this.save();
        });

        // make name field focused
        newGroup.getNameInput().grab_focus();
    }

    /**
     * Handle clicking the delete button on a server group.
     *
     * @param {ServerGroup} serverGroup
     */
    doDelete(serverGroup) {
        const messageDialog = new Adw.MessageDialog({
            transient_for: this.window,
            destroy_with_parent: true,
            modal: true,
            heading: 'Confirm Delete',
            body: 'Are you sure you want to delete this server?',
        });
        messageDialog.add_response('cancel', '_Cancel');
        messageDialog.add_response('delete', '_Delete');
        messageDialog.set_response_appearance(
            'delete',
            Adw.ResponseAppearance.ADW_RESPONSE_DESTRUCTIVE
        );
        messageDialog.set_default_response('cancel');
        messageDialog.set_close_response('cancel');
        messageDialog.connect('response', (_, response) => {
            if (response === 'delete') {
                this.removeGroup(serverGroup);
                this.save();
            }
            messageDialog.destroy();
        });
        messageDialog.present();
    }

    /**
     * Remove the group with supplied id from the provided set of groups.
     *
     * @param {ServerGroup} serverGroup
     */
    removeGroup(serverGroup) {
        // remove ServerGroup (model) by id
        for (let i = 0; i < this.serverGroups.length; i++) {
            const candidate = this.serverGroups[i];
            if (candidate.id === serverGroup.id) {
                this.serverGroups.splice(i, 1); // remove i'th group
                break;
            }
        }
        // remove widget
        this.listBox.remove(serverGroup.getGroup().parent);
        serverGroup.destroy();
        serverGroup = null;
    }

    /**
     * Create `ServerGroup`s per provided settings.
     *
     * @param {ServerSetting} settings
     */
    createServerGroups(settings) {
        for (const savedSetting of settings) {
            // ServerGroup is a wrapper around an AdwPreferenceGroup, returned by getGroup()
            const newGroup = new ServerGroup(this, savedSetting);
            this.listBox.append(newGroup.getGroup());
            this.serverGroups.push(newGroup);
        }
    }

    /**
     * Destroy all the `ServerGroup`s and null allocated variables.
     */
    destroy() {
        this.dragDropSupport = null;

        for (const serverGroup of this.serverGroups)
            serverGroup.destroy();

        this.serverGroups = null;
        this.savedSettings = null;
        this.listBox = null;
        this.page = null;
    }

    /**
     * Sort the `ServerGroup`s in their new order.
     */
    updateModel() {
        const newOrder = [];
        for (const listBoxRow of this.listBox) {
            const preferencesGroup = listBoxRow.get_child();
            for (const serverGroup of this.serverGroups) {
                if (serverGroup.getGroup() === preferencesGroup) {
                    newOrder.push(serverGroup);
                    break;
                }
            }
        }
        this.serverGroups = newOrder;
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
                    settings.notifies = settings.notifies.toString();
                    settings.visible = settings.visible.toString();
                    settings.ignoreTLSErrors = settings.ignoreTLSErrors.toString();
                    serverSettings.push(settings);
                }
            }
        }
        this.savedSettings.set_value(
            'server-settings',
            new GLib.Variant('aa{ss}', serverSettings)
        );
        // persist
        Gio.Settings.sync();
    }
}
