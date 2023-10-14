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

	/**
	 * Called by system when preferences are opened.
	 * 
	 * @param {Gtk.Window} window 
	 */
	fillPreferencesWindow(window) {
		this.window = window;
		this.page = new Adw.PreferencesPage();
		const serverGroups = [];
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
				serverGroups,
				this.save,
				this.reorder,
				null); // widgets will not be initialized but it will be expanded
			newGroup.getGroup().insert_after(this.addGroup.parent, this.addGroup); // add group to top of groups
			serverGroups.unshift(newGroup); // add to beginning of array
			// make url field focused
			newGroup.getNameInput().grab_focus();
			this.save(this, serverGroups)
		});
		this.addGroup.add(addRow);
		this.page.add(this.addGroup);

		// create one server group per discovered settings
		const parsedSettings = SettingsParser.parse(this.prefSettings);
		// reverse to match order in prefs editor
		const reversedSettings = parsedSettings.reverse();
		for (const savedSettings of reversedSettings) {
			// ServerGroup is a wrapper around a PreferenceGroup, returned by getGroup()
			const newGroup = new ServerGroup(
				this,
				serverGroups,
				this.save,
				this.reorder,
				savedSettings);
			newGroup.getGroup().insert_after(this.addGroup.parent, this.addGroup);
			serverGroups.unshift(newGroup); // add to beginning of array
		}

		window.add(this.page);
	}

	/**
	 * Render the displayed groups in their new order.
	 * 
	 * @param {ExtensionPreferences} preferences
	 * @param {ServerGroup[]} serverGroups
	 */
	reorder(preferences, serverGroups) {
		// remove all Adw.PreferenceGroups related to ServerGroups and...
		for (const serverGroup of serverGroups) {
			// remove it from whatever position it's in
			preferences.page.remove(serverGroup.getGroup());
		}

		// ...add them back in new order
		for (const serverGroup of serverGroups) {
			// add sequentially
			preferences.page.add(serverGroup.getGroup());
		}
	}

	/**
	 * Save current server settings to gsettings.
	 * 
	 * @param {ExtensionPreferences} preferences
	 * @param {ServerGroup[]} serverGroups
	 */
	save(preferences, serverGroups) {
		const serverSettingList = [];
		for (const serverGroup of serverGroups) {
			const settings = serverGroup.settings;
			if (settings) {
				settings.name = settings.name.trim();
				settings.url = settings.url.trim();
				settings.frequency = settings.frequency.toString();
				settings.is_get = settings.is_get.toString();
				serverSettingList.push(settings);
			}
		}
		// persist
		preferences.prefSettings.set_value(
			'server-settings',
			new GLib.Variant(
				'aa{ss}',
				serverSettingList
			)
		);
		Gio.Settings.sync();
	}
}