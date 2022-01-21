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
const PopupMenu = imports.ui.popupMenu;

let serverStatus;
let session;
let icon;
let serverIcon;
let serverUpIcon;
let serverDownIcon;
let serverBadIcon;
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
		serverBadIcon = Gio.icon_new_for_string(path + '/server-bad.svg');

		icon = new St.Icon({
			gicon: serverIcon,
			style_class: 'system-status-icon',
		});
		this.add_child(icon);
		
		let settingsLabel = new St.Label();
		this.menu.box.add(settingsLabel);
		
	    this.menu.connect('open-state-changed', (open) => {
			if (open){
			    settingsLabel.set_text(' ' + getURL() + ' @ ' + getFrequency() + ' seconds ');
			}
		});
	}
});

function enable() {
	serverStatus = new ServerStatus();
	Main.panel.addToStatusArea('Server Status', serverStatus, 1);
	session = new Soup.SessionAsync();
	clearInterval = GLib.source_remove;
	intervalID = setInterval(() => update(getURL()), getFrequency() * 1000);
}

function disable() {
	clearInterval(intervalID)
	if (serverStatus !== null) {
		serverStatus.destroy();
	}
	serverIcon = null;
    serverUpIcon = null;
    serverDownIcon = null;
    serverBadIcon = null;
}

function update(url) {
    get(url, function(message) {
        icon.gicon = (message.status_code == 200) ? serverUpIcon : serverDownIcon;
        return GLib.SOURCE_REMOVE; 
    });
    return GLib.SOURCE_CONTINUE;
}

function get(url, callback) { 
    let request = Soup.Message.new('HEAD', url);
    
    try{
        session.queue_message(request, (session, message) => {
            callback(message);
        });
    } catch (e){
        // occurs when message is null from bad url
        icon.gicon = serverBadIcon;
    }    
}

function setInterval(func, delay) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
}

function getURL(){
    return settings.get_string('url');
}

function getFrequency(){
    return settings.get_int('frequency');
}




