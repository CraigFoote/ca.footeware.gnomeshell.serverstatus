'use strict';

import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { ServerSetting } from './serverSetting.js';
import { ServerGroup } from './serverGroup.js';

let serverGroups;
let prefSettings;

export default class ServerStatusPreferences extends ExtensionPreferences {

	fillPreferencesWindow(window) {
		this.page = new Adw.PreferencesPage();
		serverGroups = [];
		prefSettings = this.getSettings();

		const helpGroup = new Adw.PreferencesGroup({
			description: `HTTP HEAD is faster than GET but not always supported.\n
If you get a red indicator, try switching to GET.\n
If you get a yellow indicator, there's something wrong with the URL.\n
It should be of format http[s]://host[:port][/path].`,
		});
		this.page.add(helpGroup);

		this.addGroup = new Adw.PreferencesGroup({});
		const addRow = new Adw.ActionRow({
			title: 'Add a new server',
		});
		addRow.connect('activated', () => {
			let newGroup = new ServerGroup(window, this.page, this.saveSettings, this.removeServer, null);
			this.page.add(newGroup.getGroup());
			serverGroups.push(newGroup);
			this.saveSettings();
		});
		const addImage = Gtk.Image.new_from_icon_name('list-add-symbolic');
		addRow.add_suffix(addImage);
		addRow.set_activatable_widget(addImage);
		this.addGroup.add(addRow);
		this.page.add(this.addGroup);

		const parsedSettings = this.parseSettings(prefSettings);
		for (const savedSettings of parsedSettings) {
			let newGroup = new ServerGroup(window, this.page, this.saveSettings, this.removeServer, savedSettings);
			this.page.add(newGroup.getGroup());
			serverGroups.push(newGroup);
		}

		window.add(this.page);
	}

	parseSettings(rawSettings) {
		const variant = rawSettings.get_value('server-settings');
		const savedRawSettings = variant.deep_unpack();
		const settings = [];
		for (const rawSetting of savedRawSettings) {
			const url = rawSetting['url'];
			const frequency = rawSetting['frequency'];
			const is_get = rawSetting['is_get'];
			const setting = new ServerSetting(url, frequency, is_get);
			settings.push(setting);
		}
		return settings;
	}

	removeServer(server) {
		for (let i = 0; i < serverGroups.length; i++) {
			let candidate = serverGroups[i];
			if (candidate.getId() === server.getId()) {
				serverGroups.splice(i, 1);
				break;
			}
		}
	}

	saveSettings() {
		const serverSettingList = [];
		for (const serverGroup of serverGroups) {
			const settings = serverGroup.getSettings();
			if (settings) {
				settings.url = settings.url.trim();
				settings.frequency = settings.frequency.toString();
				settings.is_get = settings.is_get.toString();
				serverSettingList.push(settings);
			}
		}
		// persist
		if (serverSettingList.length == 0) {
			prefSettings.reset('server-settings');
		} else {
			prefSettings.set_value(
				'server-settings',
				new GLib.Variant(
					'aa{ss}',
					serverSettingList
				)
			);
		}
		Gio.Settings.sync();
	}
}