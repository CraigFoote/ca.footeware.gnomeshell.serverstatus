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
let panelIcon;
let statusPanels;
let extensionListenerId;

/**
 * The taskbar indicator with a clickable icon showing worst status of all server statuses.
 */
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

/**
 * The main extension class. Creates an <code>Indicator</code> and keeps 
 * it updated based on status of specified servers settings.
 */
export default class ServerStatusIndicatorExtension extends Extension {
	enable() {
		iconProvider = new IconProvider(this.path + '/assets/');

		this.settings = this.getSettings();
		this.indicator = new Indicator();

		Main.panel.addToStatusArea(this.uuid, this.indicator);
		this.savedSettings = this.parseSettings();

		// panel items, one per server setting
		for (const savedSetting of this.savedSettings) {
			const panel = this.getPanel(savedSetting);
			this.indicator.menu.box.add(panel);
			statusPanels.push(panel);
		}

		// listen for changes to server settings and update display
		extensionListenerId = this.settings.connect('changed', () => {
			this.onPrefChanged();
		});
	}

	/**
	 * Destroys and nulls artifacts for garbage collection.
	 */
	disable() {
		this.settings.disconnect(extensionListenerId);
		this.savedSettings = null;
		this.indicator.destroy();
		this.indicator = null;
		this.settings = null;
		if (iconProvider) {
			iconProvider.destroy();
			iconProvider = null;
		}
		panelIcon = null;
		statusPanels = [];
	}
	
	/**
	 * Creates <code>ServerSettings</code> objects based on discovered gsettings entries.
	 */
	parseSettings() {
		const variant = this.settings.get_value('server-settings');
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

	/**
	 * Preferences have changed the set of server settings so we can update the indicator icon.
	 */
	onPrefChanged() {
		panelIcon.gicon = iconProvider.getIcon(Status.Init);
		statusPanels = [];
		this.indicator.menu.box.destroy_all_children();
		this.savedSettings = this.parseSettings();
		// panel items, one per server setting
		for (const savedSetting of this.savedSettings) {
			const panel = this.getPanel(savedSetting);
			this.indicator.menu.box.add(panel);
			statusPanels.push(panel);
		}
		this.updateIcon();
	}

	/**
	 * Create a <code>ServerStatusPanel</code> with a set of server settings.
	 */
	getPanel(setting) {
		return new ServerStatusPanel(setting, this.updateIcon, iconProvider);
	}

	/**
	 * Update the indicator icon based on changes in server settings.
	 */
	updateIcon() {
		const statusList = [];
		for (const statusPanel of statusPanels) {
			const status = statusPanel.getStatus();
			statusList.push(status);
		}
		// determine worst status
		let haveDown = false;
		let haveBad = false;
		let haveUp = false;
		for (const s of statusList) {
			if (s === Status.Down) {
				haveDown = true;
			} else if (s === Status.Bad) {
				haveBad = true;
			} else if (s === Status.Up) {
				haveUp = true;
			}
		}
		if (panelIcon) {
			if (haveDown) {
				panelIcon.gicon = iconProvider.getIcon(Status.Down);
			} else if (haveBad) {
				panelIcon.gicon = iconProvider.getIcon(Status.Bad);
			} else if (haveUp) {
				panelIcon.gicon = iconProvider.getIcon(Status.Up);
			} else {
				panelIcon.gicon = iconProvider.getIcon(Status.Init);
			}
		}
	}
}