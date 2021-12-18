'use strict';

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const St = imports.gi.St;
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const PanelMenu = imports.ui.panelMenu;

let serverStatus;
let session = new Soup.SessionAsync();
let icon;
let serverIcon;
let serverUpIcon;
let serverDownIcon;
let intervalID;
let clearInterval = GLib.source_remove;
let settings;

function init() {
	log(`Initializing ${Extension.metadata.name} version ${Extension.metadata.version}`);
}

// Object prototype
const ServerStatus = GObject.registerClass(
	class ServerStatus extends PanelMenu.Button {
		_init() {
			super._init(0);
			
			let GioSSS = Gio.SettingsSchemaSource;
            let schemaSource = GioSSS.new_from_directory(
                Extension.dir.get_child("schemas").get_path(),
                GioSSS.get_default(),
                false
            );
            
            let schemaObj = schemaSource.lookup('org.gnome.shell.extensions.serverstatus', true);
            if (!schemaObj) {
                throw new Error('cannot find schemas');
            }
            settings = new Gio.Settings({ settings_schema : schemaObj });
			
			let path = Extension.dir.get_path();
			serverIcon = Gio.icon_new_for_string(path + '/server.svg');
			serverUpIcon = Gio.icon_new_for_string(path + '/server-up.svg');
			serverDownIcon = Gio.icon_new_for_string(path + '/server-down.svg');

			// panel button
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
	intervalID = setInterval(() => update(getURL()), 10000);
}

function disable() {
	log(`Disabling ${Extension.metadata.name} version ${Extension.metadata.version}`);
	clearInterval(intervalID)
	if (serverStatus !== null) {
		serverStatus.destroy();
	}
}

function update(url) {
    get(url, function(status_code, body) {
        icon.gicon = (status_code == 200) ? serverUpIcon : serverDownIcon;
        Mainloop.quit(true); 
    });
    Mainloop.run(true);
}

function get(url, callback) { 
    let request = Soup.Message.new('GET', url);
    session.queue_message(request, Lang.bind(this, function(session, message) {
        callback(message.status_code, request.response_body.data);
    }));
}

function setInterval(func, delay, ...args) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        func(...args);
        return GLib.SOURCE_CONTINUE;
    });
}

function getURL(){
    return settings.get_string('url');
}

