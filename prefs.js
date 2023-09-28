'use strict';

import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { ServerSetting } from './serverSetting.js';
import { ServerGroup } from './serverGroup.js';

/**
 * The main preferences class that creates server groups and saves to gsettings.
 */
export default class ServerStatusPreferences extends ExtensionPreferences {

	fillPreferencesWindow(window) {
		const page = new Adw.PreferencesPage();
		const serverGroups = [];
		const prefSettings = this.getSettings();

		// help group
		const helpGroup = new Adw.PreferencesGroup({
			description: `HTTP HEAD is faster than GET but not always supported.\n
If you get a red indicator, try switching to GET.\n
If you get a yellow indicator, there's something wrong with the URL.\n
It should be of format http[s]://host[:port][/path].`,
		});
		page.add(helpGroup);

		// add group
		const addGroup = new Adw.PreferencesGroup({});
		const addRow = new Adw.ActionRow({
			title: 'Add a new server',
		});
		const addButton = Gtk.Button.new_from_icon_name('list-add-symbolic');
		addRow.add_suffix(addButton);
		addButton.connect('clicked', () => {
			// ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
			const newGroup = new ServerGroup(
				window,
				page,
				serverGroups,
				prefSettings,
				this.saveSettings,
				null); // widgets will not be initialized
			newGroup.getGroup().insert_after(addGroup.parent, addGroup);
			serverGroups.push(newGroup);
			// make url field focused
			newGroup.getUrlInput().grab_focus();
			this.saveSettings(serverGroups, prefSettings)
		});
		addGroup.add(addRow);
		page.add(addGroup);

		// create one server group per discovered settings
		const parsedSettings = this.parseSettings(prefSettings);
		for (const savedSettings of parsedSettings) {
			// ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
			const newGroup = new ServerGroup(
				window,
				page,
				serverGroups,
				prefSettings,
				this.saveSettings,
				savedSettings);
			newGroup.getGroup().insert_after(addGroup.parent, addGroup);
			serverGroups.push(newGroup);
		}

		window.add(page);
	}

	/**
	 * Create <code>ServerSetting</code> objects, one per gsettings entry.
	 */
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

	/**
	 * Save current server settings to gsettings.
	 */
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