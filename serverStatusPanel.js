'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import { Status } from './status.js';

export const ServerStatusPanel = GObject.registerClass({
	GTypeName: 'ServerStatusPanel',
}, class ServerStatusPanel extends St.BoxLayout {
	_init(
		serverSetting,
		updateTaskbarCallback,
		iconProvider,
		...otherProps
	) {
		super._init(otherProps);
		this.serverSetting = serverSetting;
		this.updateTaskbarCallback = updateTaskbarCallback;
		this.iconProvider = iconProvider;

		this.style_class = 'main-box';

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
			(serverSetting.is_get == 'true' ? 'GET' : 'HEAD') + ' : ' + serverSetting.url + ' @ ' + serverSetting.frequency + 's'
		);
		this.add_child(settingsLabel);

		// call once then schedule
		this.update(serverSetting.url);
		this.intervalID = this.setInterval(() => this.update(serverSetting.url), serverSetting.frequency * 1000);

		this.connect('destroy', () => {
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
		const httpMethod = this.serverSetting.is_get == 'true' ? 'GET' : 'HEAD';
		this.get(httpMethod, url, this.panelIcon);
		return GLib.SOURCE_CONTINUE;
	}

	get(httpMethod, url, panelIcon) {
		let message = Soup.Message.new(httpMethod, url);
		if (message) {
			this.session.send_and_read_async(
				message,
				GLib.PRIORITY_DEFAULT,
				null,
				() => {
					if (panelIcon) {
						let newIcon;
						if (message.get_status() === Soup.Status.OK) {
							newIcon = this.iconProvider.getIcon(Status.Up);
						} else {
							newIcon = this.iconProvider.getIcon(Status.Down);
						}
						panelIcon.gicon = newIcon;
						this.updateTaskbarCallback?.();
					}
					return GLib.SOURCE_REMOVE;
				}
			)
		} else {
			// message was null because of malformed url
			panelIcon.gicon = this.iconProvider.getIcon(Status.Bad);
			this.updateTaskbarCallback?.();
		}
	}

	setInterval(func, delay) {
		return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
	}
})
