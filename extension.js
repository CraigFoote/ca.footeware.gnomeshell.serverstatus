'use strict';

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const statusPanel = Me.imports.statusPanel;
const serverSetting = Me.imports.serverSetting;
const Status = Me.imports.status;
const schemaId = 'org.gnome.shell.extensions.serverstatus';

let statusPanels = [];
let serverStatus;
let panelIcon;
let serverIcon;
let serverUpIcon;
let serverDownIcon;
let serverBadIcon;
let prefSettings;
let savedSettings;
let extensionSettings;
let extensionListenerId;

function init() {
    prefSettings = ExtensionUtils.getSettings(schemaId);
}

const ServerStatus = GObject.registerClass({
    GTypeName: 'ServerStatus',
}, class ServerStatus extends PanelMenu.Button {
    _init() {
        super._init(0);

        const path = Me.dir.get_path();
        serverIcon = Gio.icon_new_for_string(path + '/assets/server.svg');
        serverUpIcon = Gio.icon_new_for_string(path + '/assets/server-up.svg');
        serverDownIcon = Gio.icon_new_for_string(path + '/assets/server-down.svg');
        serverBadIcon = Gio.icon_new_for_string(path + '/assets/server-bad.svg');

        // taskbar icon
        panelIcon = new St.Icon({
            gicon: serverIcon,
            style_class: 'system-status-icon',
        });
        this.add_child(panelIcon);

        // get preferences from gsettings
        savedSettings = this.getPreferences();
        // panel items, one per server setting
        for (let i = 0; i < savedSettings.length; i++) {
            const savedSetting = savedSettings[i];
            const panel = new statusPanel.StatusPanel({
                server_setting: savedSetting,
                update_icon_callback: this.updateIcon,
            });
            this.menu.box.add_child(panel);
            statusPanels.push(panel);
        }

        extensionSettings = ExtensionUtils.getSettings();
        extensionListenerId = extensionSettings.connect('changed', () => {
            this.onPrefChanged();
        });
    }

    onPrefChanged() {
        statusPanels = [];
        this.menu.box.destroy_all_children();
        // get preferences from gsettings
        savedSettings = this.getPreferences();
        // panel items, one per server setting
        for (let i = 0; i < savedSettings.length; i++) {
            const savedSetting = savedSettings[i];
            const panel = new statusPanel.StatusPanel({
                server_setting: savedSetting,
                update_icon_callback: this.updateIcon,
            });
            this.menu.box.add(panel);
            statusPanels.push(panel);
        }
    }

    updateIcon() {
        const statusList = [];
        for (let i = 0; i < statusPanels.length; i++) {
            statusList.push(statusPanels[i].getStatus());
        }
        // determine worst status
        let haveDown = false;
        let haveBad = false;
        for (let i = 0; i < statusList.length; i++) {
            const s = statusList[i];
            if (s == Status.Status.Down) {
                haveDown = true;
            }
            else if (s == Status.Status.Bad) {
                haveBad = true;
            }
        }
        if (haveDown) {
            panelIcon.gicon = serverDownIcon;
        } else if (haveBad) {
            panelIcon.gicon = serverBadIcon;
        } else {
            panelIcon.gicon = serverUpIcon;
        }
    }

    /**
     * Read and parse preferences from GSettings.
     * 
     * @returns a list of ServerSetting objects
     */
    getPreferences() {
        const variant = prefSettings.get_value('server-settings');
        const saved = variant.deep_unpack();
        const serverSettings = [];
        for (let i = 0; i < saved.length; i++) {
            const rawSetting = saved[i];
            const url = rawSetting['url'];
            const frequency = rawSetting['frequency'];
            const is_get = rawSetting['is_get'];
            const setting = new serverSetting.ServerSetting(url, frequency, is_get);
            serverSettings.push(setting);
        }
        return serverSettings;
    }
});

function enable() {
    serverStatus = new ServerStatus();
    Main.panel.addToStatusArea('Server Status', serverStatus, 1);
}

function disable() {
    extensionSettings.disconnect(extensionListenerId);
    serverIcon = null;
    serverUpIcon = null;
    serverDownIcon = null;
    serverBadIcon = null;
    if (serverStatus !== null) {
        serverStatus.destroy();
    }
}
