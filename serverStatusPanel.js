'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import { Status } from './status.js';

/**
 * A series of these panels is shown when the indicator icon is clicked. 
 * Each shows a server status and settings.
 */
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
		let panelIconDisposed = false;
		this.panelIcon.connect("destroy", () => panelIconDisposed = true);
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
		this.update(serverSetting.url, panelIconDisposed);
		this.intervalID = this.setInterval(() => this.update(serverSetting.url), serverSetting.frequency * 1000);

		this.connect('destroy', () => {
			if (this.intervalID) {
				GLib.source_remove(this.intervalID);
				this.intervalID = null;
			}
			delete this.panelIcon, this;
		});
	}

	/**
	 * Returns the status of the server this panel represents.
	 * 
	 * @return <code>Status</code>
	 */
	getStatus() {
		return this.iconProvider.getStatus(this.panelIcon?.gicon);
	}

	/**
	 * Update this panel by invoking the URL on a schedule.
	 */
	update(url, panelIconDisposed) {
		const httpMethod = this.serverSetting.is_get == 'true' ? 'GET' : 'HEAD';
		this.get(httpMethod, url, this.panelIcon, panelIconDisposed);
		return GLib.SOURCE_CONTINUE;
	}

	/**
	 * Execute the URL invocation asynchronously and update the panel icon 
	 * appropriately then trigger the updating of the indicator icon appropriately.
	 */
	get(httpMethod, url, panelIcon, panelIconDisposed) {
		let message = Soup.Message.new(httpMethod, url);
		if (message) {
			this.session.send_and_read_async(
				message,
				GLib.PRIORITY_DEFAULT,
				null,
				() => {
					if (panelIcon && !panelIconDisposed) {
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

	/**
	 * Schedule the URL invocation.
	 */
	setInterval(func, delay) {
		return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
	}
})
