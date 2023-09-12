'use strict';

import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ServerSetting } from './serverSetting.js';
import { ServerStatusPanel } from './serverStatusPanel.js';
import { Status } from './status.js';
import { IconProvider } from './iconProvider.js';

let iconProvider;
let savedSettings;
let panelIcon;
let statusPanels;
let extensionListenerId;

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _('Server Status Indicator'));
			panelIcon = new St.Icon({
				gicon: iconProvider.getIcon(Status.Init),
				style_class: 'system-status-icon',
			});
			this.add_child(panelIcon);
			statusPanels = [];
		}
	});

export default class ServerStatusIndicatorExtension extends Extension {
	enable() {
		iconProvider = new IconProvider(this.path + '/assets/');

		this._settings = this.getSettings();
		this._indicator = new Indicator();

		Main.panel.addToStatusArea(this.uuid, this._indicator);
		savedSettings = this.parseSettings();

		// panel items, one per server setting
		for (const savedSetting of savedSettings) {
			const panel = this.getPanel(savedSetting);
			this._indicator.menu.box.add(panel);
			statusPanels.push(panel);
		}

		// listen for changes to server settings and update display
		extensionListenerId = this._settings.connect('changed', () => {
			this.onPrefChanged();
		});
	}

	disable() {
		this._settings.disconnect(extensionListenerId);
		this._indicator.destroy();
		this._indicator = null;
		this._settings = null;
		savedSettings = null;
		if (iconProvider) {
			iconProvider.destroy();
			iconProvider = null;
		}
		savedSettings = null;
		panelIcon = null;
		statusPanels = [];
	}

	parseSettings() {
		const variant = this._settings.get_value('server-settings');
		const saved = variant.deep_unpack();
		const savedSettings = [];
		for (const rawSetting of saved) {
			const url = rawSetting['url'];
			const frequency = rawSetting['frequency'];
			const is_get = rawSetting['is_get'];
			const setting = new ServerSetting(url, frequency, is_get);
			savedSettings.push(setting);
		}
		return savedSettings;
	}

	onPrefChanged() {
		panelIcon.gicon = iconProvider.getIcon(Status.Init);
		statusPanels = [];
		this._indicator.menu.box.destroy_all_children();
		savedSettings = this.parseSettings();
		// panel items, one per server setting
		for (const savedSetting of savedSettings) {
			const panel = this.getPanel(savedSetting);
			this._indicator.menu.box.add(panel);
			statusPanels.push(panel);
		}
	}

	getPanel(setting) {
		return new ServerStatusPanel({
			server_setting: setting,
			update_icon_callback: this.updateIcon,
			icon_provider: iconProvider,
		});
	}

	updateIcon() {
		const statusList = [];
		for (const element of statusPanels) {
			statusList.push(element?.getStatus());
		}
		// determine worst status
		let haveDown = false;
		let haveBad = false;
		for (const s of statusList) {
			if (s == Status.Down) {
				haveDown = true;
			} else if (s == Status.Bad) {
				haveBad = true;
			}
		}
		if (panelIcon) {
			if (haveDown) {
				panelIcon.gicon = iconProvider.getIcon(Status.Down);
			} else if (haveBad) {
				panelIcon.gicon = iconProvider.getIcon(Status.Bad);;
			} else {
				panelIcon.gicon = iconProvider.getIcon(Status.Up);;
			}
		}
	}
}