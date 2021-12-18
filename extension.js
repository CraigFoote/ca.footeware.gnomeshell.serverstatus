'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const PanelMenu = imports.ui.panelMenu;

let serverStatus;
let session;
let icon;
let serverIcon;
let serverUpIcon;
let serverDownIcon;
let intervalID;
let clearInterval;
let settings;

function init() {
}

const ServerStatus = GObject.registerClass({
	GTypeName: 'ServerStatus',
}, class ServerStatus extends PanelMenu.Button {
	_init() {
		super._init(0);
		
		settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');
		
		let path = Extension.dir.get_path();
		serverIcon = Gio.icon_new_for_string(path + '/server.svg');
		serverUpIcon = Gio.icon_new_for_string(path + '/server-up.svg');
		serverDownIcon = Gio.icon_new_for_string(path + '/server-down.svg');

		icon = new St.Icon({
			gicon: serverIcon,
			style_class: 'system-status-icon',
		});
		this.add_child(icon);			
	}
});

function enable() {
	serverStatus = new ServerStatus();
	Main.panel.addToStatusArea('Server Status', serverStatus, 1);
	session = new Soup.SessionAsync();
	clearInterval = GLib.source_remove;
	intervalID = setInterval(() => update(getURL()), 10000);
}

function disable() {
	clearInterval(intervalID)
	if (serverStatus !== null) {
		serverStatus.destroy();
	}
	serverIcon = null;
    serverUpIcon = null;
    serverDownIcon = null;
}

function update(url) {
    get(url, function(status_code, body) {
        icon.gicon = (status_code == 200) ? serverUpIcon : serverDownIcon;
        return GLib.SOURCE_REMOVE; 
    });
    return GLib.SOURCE_CONTINUE;
}

function get(url, callback) { 
    let request = Soup.Message.new('GET', url);
    
    session.queue_message(request, (session, message) => {
        callback(message.status_code, request.response_body.data);
    });
}

function setInterval(func, delay) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
}

function getURL(){
    return settings.get_string('url');
}
