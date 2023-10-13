'use strict';

import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { SettingsParser } from './settingsParser.js';
import { ServerGroup } from './serverGroup.js';

/**
 * The main preferences class that creates server groups and saves to gsettings.
 */
export default class ServerStatusPreferences extends ExtensionPreferences {

	fillPreferencesWindow(window) {
		this.window = window;
		this.page = new Adw.PreferencesPage();
		this.serverGroups = [];
		this.prefSettings = this.getSettings();

		// help group
		const helpGroup = new Adw.PreferencesGroup({
			description: `HTTP HEAD is faster than GET but not always supported.\n
If you get a red indicator, try switching to GET.\n
If you get a yellow indicator, there's something wrong with the URL.\n
It should be of format http[s]://host[:port][/path].`,
		});
		this.page.add(helpGroup);

		// add group
		this.addGroup = new Adw.PreferencesGroup({});
		const addRow = new Adw.ActionRow({
			title: 'Add a new server',
		});
		const addButton = Gtk.Button.new_from_icon_name('list-add-symbolic');
		addButton.set_css_classes(['suggested-action']);
		addRow.add_suffix(addButton);
		addButton.connect('clicked', () => {
			// ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
			const newGroup = new ServerGroup(
				this,
				this.saveSettings,
				this.reorder,
				null); // widgets will not be initialized
			newGroup.getGroup().insert_after(this.addGroup.parent, this.addGroup); // add group to top of groups
			this.serverGroups.push(newGroup);
			// make url field focused
			newGroup.getNameInput().grab_focus();
			this.saveSettings(this.serverGroups, this.prefSettings)
		});
		this.addGroup.add(addRow);
		this.page.add(this.addGroup);

		// create one server group per discovered settings
		const parsedSettings = SettingsParser.parse(this.prefSettings);
		for (const savedSettings of parsedSettings) {
			// ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
			const newGroup = new ServerGroup(
				this,
				this.saveSettings,
				this.reorder,
				savedSettings);
			newGroup.getGroup().insert_after(this.addGroup.parent, this.addGroup);
			this.serverGroups.push(newGroup);
		}

		window.add(this.page);
	}

	reorder(preferences, saveSettings) {
		// remove all groups and...
		for (const serverGroup of preferences.serverGroups) {
			const group = serverGroup.getGroup();
			preferences.page.remove(group);
		}
		preferences.serverGroups = [];

		// ...add them back in new order
		const parsedSettings = SettingsParser.parse(preferences.prefSettings);
		for (const savedSettings of parsedSettings) {
			// ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
			const newGroup = new ServerGroup(
				preferences,
				preferences.saveSettings,
				preferences.reorder,
				savedSettings,
				false);
			preferences.page.add(newGroup.getGroup());
			preferences.serverGroups.push(newGroup);
		}
		saveSettings(preferences.serverGroups, preferences.prefSettings);
	}

	/**
	 * Save current server settings to gsettings.
	 */
	saveSettings(serverGroups, prefSettings) {
		const serverSettingList = [];
		for (const serverGroup of serverGroups) {
			const settings = serverGroup.getSettings();
			if (settings) {
				settings.name = settings.name.trim();
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