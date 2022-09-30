'use strict';

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const clearInterval = GLib.source_remove;
const serverSetting = Me.imports.serverSetting;
const Status = Me.imports.status;

let updateTaskbarCallback;

var StatusPanel = GObject.registerClass({
	GTypeName: 'StatusPanel',
}, class StatusPanel extends St.BoxLayout {
	_init({ server_setting, update_icon_callback, ...otherProps } = {}) {
		super._init(otherProps);

		this.setting = server_setting;
		this.updateTaskbarCallback = update_icon_callback;
		this.style_class = 'main-box';

		this.session = new Soup.Session({
			timeout: 10, //seconds
		});

		const path = Me.dir.get_path();
		this.serverIcon = Gio.icon_new_for_string(path + '/assets/server.svg');
		this.serverUpIcon = Gio.icon_new_for_string(path + '/assets/server-up.svg');
		this.serverDownIcon = Gio.icon_new_for_string(path + '/assets/server-down.svg');
		this.serverBadIcon = Gio.icon_new_for_string(path + '/assets/server-bad.svg');

		this.panelIcon = new St.Icon({
			gicon: this.serverIcon,
			style_class: 'icon',
		});
		this.add_child(this.panelIcon);

		const settingsLabel = new St.Label({
			style_class: 'label',
		});
		settingsLabel.set_text(
			(this.setting.is_get == 'true' ? 'GET' : 'HEAD') + ' : ' + this.setting.url + ' @ ' + this.setting.frequency + 's'
		);
		this.add_child(settingsLabel);

		// call once then schedule
		this.update(this.setting.url);
		this.intervalID = this.setInterval(() => this.update(this.setting.url), this.setting.frequency * 1000);

		this.connect('destroy', (actor) => {
			if (this.intervalID) {
				clearInterval(this.intervalID);
				this.intervalID = null;
			}
		});
	}

	getStatus() {
		if (this.panelIcon != null) {
			switch (this.panelIcon.gicon) {
				case this.serverUpIcon:
					return Status.Status.Up;
					break;
				case this.serverDownIcon:
					return Status.Status.Down;
					break;
				case this.serverBadIcon:
					return Status.Status.Bad;
					break;
				default:
					return Status.Status.Init;
			}
		} else {
			return Status.Status.Init;
		}
	}

	update(url) {
		const httpMethod = this.setting.is_get == 'true' ? 'GET' : 'HEAD';
		this.get(httpMethod, url, this.panelIcon);
		// not sure what this does
		return GLib.SOURCE_CONTINUE;
	}

	get(httpMethod, url, icon) {
		let message = Soup.Message.new(httpMethod, url);
		this.session.send_and_read_async(
			message,
			GLib.PRIORITY_DEFAULT,
			null,
			(session, result) => {
				let gicon;
				if (message.get_status() === Soup.Status.OK) {
					gicon = this.serverUpIcon;
				} else {
					gicon = this.serverDownIcon;
				}
				icon.gicon = gicon;
				this.updateTaskbarCallback();
				// not sure what this does
				return GLib.SOURCE_REMOVE;
			}
		)
	}

	setInterval(func, delay) {
		return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
	}
})
