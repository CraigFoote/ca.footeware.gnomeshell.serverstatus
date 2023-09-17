'use strict';

import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { ServerSetting } from './serverSetting.js';
import { ServerGroup } from './serverGroup.js';

export default class ServerStatusPreferences extends ExtensionPreferences {

	fillPreferencesWindow(window) {
		const page = new Adw.PreferencesPage();
		this.serverGroups = [];
		this.prefSettings = this.getSettings();

		const helpGroup = new Adw.PreferencesGroup({
			description: `HTTP HEAD is faster than GET but not always supported.\n
If you get a red indicator, try switching to GET.\n
If you get a yellow indicator, there's something wrong with the URL.\n
It should be of format http[s]://host[:port][/path].`,
		});
		page.add(helpGroup);

		const addGroup = new Adw.PreferencesGroup({});
		const addRow = new Adw.ActionRow({
			title: 'Add a new server',
		});
		addRow.connect('activated', () => {
			let newGroup = new ServerGroup(
				window,
				page,
				this.serverGroups,
				this.prefSettings,
				this.saveSettings,
				null); // widgets will not be initialized
			page.add(newGroup.getGroup());
			this.serverGroups.push(newGroup);
		});
		const addImage = Gtk.Image.new_from_icon_name('list-add-symbolic');
		addRow.add_suffix(addImage);
		addRow.set_activatable_widget(addImage);
		addGroup.add(addRow);
		page.add(addGroup);

		const parsedSettings = this.parseSettings(this.prefSettings);
		for (const savedSettings of parsedSettings) {
			let newGroup = new ServerGroup(
				window,
				page,
				this.serverGroups,
				this.prefSettings,
				this.saveSettings,
				savedSettings);
			page.add(newGroup.getGroup());
			this.serverGroups.push(newGroup);
		}

		window.add(page);
	}

	parseSettings(rawSettings) {
		const variant = rawSettings.get_value('server-settings');
		const savedRawSettings = variant.deep_unpack();
		const settings = [];
		for (const rawSetting of savedRawSettings) {
			const url = rawSetting['url'];
			const frequency = rawSetting['frequency'];

			let isGet;
			isGet = rawSetting['is_get'];

			const setting = new ServerSetting(url, frequency, isGet);
			settings.push(setting);
		}
		return settings;
	}

	saveSettings(serverGroups, prefSettings) {
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
		prefSettings.set_value(
			'server-settings',
			new GLib.Variant(
				'aa{ss}',
				serverSettingList
			)
		);
		Gio.Settings.sync();
	}
}