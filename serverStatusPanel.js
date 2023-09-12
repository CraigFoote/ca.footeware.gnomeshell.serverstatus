'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import { Status } from './status.js';

let updateTaskbarCallback;

export const ServerStatusPanel = GObject.registerClass({
	GTypeName: 'ServerStatusPanel',
}, class ServerStatusPanel extends St.BoxLayout {
	_init({
		server_setting,
		update_icon_callback,
		icon_provider,
		...otherProps
	} = {}) {
		super._init(otherProps);

		this.style_class = 'main-box';

		this.setting = server_setting;
		this.updateTaskbarCallback = update_icon_callback;
		this.iconProvider = icon_provider;

		this.session = new Soup.Session({
			timeout: 10, //seconds
		});

		this.panelIcon = new St.Icon({
			gicon: this.iconProvider.getIcon(Status.Init),
			style_class: 'icon',
		});
		this.add_child(this.panelIcon);

		const settingsLabel = new St.Label({
			style_class: 'label',
			y_align: Clutter.ActorAlign.CENTER,
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
				GLib.source_remove(this.intervalID);
				this.intervalID = null;
			}
			delete this.panelIcon, this;
		});
	}

	getStatus() {
		return this.iconProvider.getStatus(this.panelIcon?.gicon);
	}

	update(url) {
		const httpMethod = this.setting.is_get == 'true' ? 'GET' : 'HEAD';
		this.get(httpMethod, url, this.panelIcon);
		return GLib.SOURCE_CONTINUE;
	}

	get(httpMethod, url, icon) {
		let message = Soup.Message.new(httpMethod, url);
		if (message) {
			this.session.send_and_read_async(
				message,
				GLib.PRIORITY_DEFAULT,
				null,
				(session, result) => {
					let gicon;
					if (message.get_status() === Soup.Status.OK) {
						gicon = this.iconProvider.getIcon(Status.Up);
					} else {
						gicon = this.iconProvider.getIcon(Status.Down);
					}
					if (icon) {
						icon.gicon = gicon;
						this.updateTaskbarCallback?.();
					}
					return GLib.SOURCE_REMOVE;
				}
			)
		} else {
			// message was null because of malformed url
			icon.gicon = this.iconProvider.getIcon(Status.Bad);
			this.updateTaskbarCallback?.();
		}
	}

	setInterval(func, delay) {
		return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
	}
})
