'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { ServerSetting } from './serverSetting.js';

/**
 * A new group is displayed when Add is clicked in the preferences dialog. 
 * It displays controls for settings for a server.
 */
export class ServerGroup {

	/**
	 * Constructor.
	 * 
	 * @param {ServerStatusPreferences} preferences 
	 * @param {Function} saveCallback
	 * @param {Function} reorderCallback
	 * @param {ServerSetting} settings, may be null
	 */
	constructor(preferences, saveCallback, reorderCallback, settings) {
		this.id = this.createUID();
		this.preferences = preferences;
		this.window = window;

		this.serverSettingGroup = new Adw.PreferencesGroup({});

		// expander
		this.expander = Adw.ExpanderRow.new();
		let title = '';
		if (settings != undefined) {
			title = settings.name;
		}
		this.expander.set_title(title);
		let subtitle = '';
		if (settings != undefined) {
			subtitle = (settings.is_get == 'true' ? 'GET' : 'HEAD') + ' : ' + settings.url + ' @ ' + settings.frequency + 's';
		}
		this.expander.set_subtitle(subtitle);
		this.serverSettingGroup.add(this.expander);

		// name text field
		this.nameRow = new Adw.EntryRow({
			title: 'Name',
			text: (settings != undefined) ? settings.name : '',
			show_apply_button: true,
		});
		this.nameRow.connect('apply', () => {
			this.createServerSettings();
			saveCallback(preferences.serverGroups, preferences.prefSettings);
			this.updateExpander();
		});
		this.expander.add_row(this.nameRow);

		// url text field
		this.urlRow = new Adw.EntryRow({
			title: 'URL',
			text: (settings != undefined) ? settings.url : '',
			show_apply_button: true,
		});
		this.urlRow.connect('apply', () => {
			this.createServerSettings();
			saveCallback(this.serverGroups, prefSettings);
			this.updateExpander();
		});
		this.expander.add_row(this.urlRow);

		// frequency spinner
		this.frequencyRow = Adw.SpinRow.new_with_range(10, 300, 10);
		this.frequencyRow.set_value((settings != undefined) ? settings.frequency : 30);
		this.frequencyRow.set_title('Frequency (secs.)');
		this.frequencyRow.connect('input', () => {
			this.createServerSettings();
			saveCallback(preferences.serverGroups, preferences.prefSettings);
			this.updateExpander();
		})
		this.expander.add_row(this.frequencyRow);

		// 'use GET' switch
		this.useGetSwitchRow = new Adw.SwitchRow({
			title: 'Use GET rather than HEAD',
			active: (settings != undefined) ? !settings.is_get : false,
		});
		this.useGetSwitchRow.connect('notify::active', () => {
			this.createServerSettings();
			saveCallback(preferences.serverGroups, preferences.prefSettings);
			this.updateExpander();
		});
		this.expander.add_row(this.useGetSwitchRow);

		// move up/down row
		const moveRow = new Adw.ActionRow({
			title: 'Move Up/Down',
		});
		const moveUpButton = Gtk.Button.new_from_icon_name('go-up-symbolic');
		moveUpButton.connect('clicked', () => {
			this.moveUp();
			saveCallback(preferences.serverGroups, preferences.prefSettings);
			reorderCallback(preferences, saveCallback);
		});
		const moveDownButton = Gtk.Button.new_from_icon_name('go-down-symbolic');
		moveDownButton.connect('clicked', () => {
			this.moveDown();
			saveCallback(preferences.serverGroups, preferences.prefSettings);
			reorderCallback(preferences, saveCallback);
		});
		const moveButtonBox = Gtk.Box.new(Gtk.Orientation.GTK_ORIENTATION_HORIZONTAL, 10);
		moveButtonBox.append(moveUpButton);
		moveButtonBox.append(moveDownButton);
		moveRow.add_suffix(moveButtonBox);
		this.serverSettingGroup.add(moveRow);

		// delete button
		const deleteRow = new Adw.ActionRow({
			title: 'Delete this server',
		});
		const deleteButton = Gtk.Button.new_from_icon_name('edit-delete-symbolic');
		deleteButton.set_css_classes(['destructive-action']);
		deleteRow.add_suffix(deleteButton);
		this.serverSettingGroup.add(deleteRow);
		deleteButton.connect('clicked', () => {
			const messageDialog = new Adw.MessageDialog({
				transient_for: this.preferences.window,
				destroy_with_parent: true,
				modal: true,
				heading: 'Confirm Delete',
				body: 'Are you sure you want to delete this server?',
			});
			messageDialog.add_response('cancel', '_Cancel');
			messageDialog.add_response('delete', '_Delete');
			messageDialog.set_response_appearance('delete', Adw.ResponseAppearance.ADW_RESPONSE_DESTRUCTIVE);
			messageDialog.set_default_response('cancel');
			messageDialog.set_close_response('cancel');
			messageDialog.connect('response', (_, response) => {
				if (response === 'delete') {
					this.createServerSettings();
					this.removeGroup(this.getId());
					saveCallback(this.preferences.serverGroups, this.preferences.prefSettings);
					this.page.remove(this.serverSettingGroup);
				}
				messageDialog.destroy();
			});
			messageDialog.present();
		});

		this.createServerSettings();

		if (settings == undefined) {
			this.expander.set_expanded(true);
			this.nameRow.grab_focus();
		}
	}

	getTitle() {
		if (this.settings == undefined || this.settings.name == undefined) {
			return '';
		} else {
			return (this.settings.name.length > 0) ? this.settings.name : 'unnamed';
		}
	}

	getSubtitle() {
		if (this.settings == undefined || this.settings.url == undefined || this.settings.frequency == undefined || this.settings.is_get == undefined) {
			return '';
		} else {
			return (this.settings.is_get == 'true' ? 'GET' : 'HEAD') + ' : ' + this.settings.url + ' @ ' + this.settings.frequency + 's';
		}
	}

	updateExpander() {
		this.expander.set_title(this.getTitle());
		this.expander.set_subtitle(this.getSubtitle());
	}

	moveUp() {
		const position = this.getPosition();
		if (position > 0) {
			this.move(position, position - 1);
		}
	}

	moveDown() {
		const position = this.getPosition();
		if (position < this.preferences.serverGroups.length) {
			this.move(position, position + 1);
		}
	}

	getPosition() {
		for (let i = 0; i < this.preferences.serverGroups.length; i++) {
			let candidate = this.preferences.serverGroups[i];
			if (candidate.getId() === this.getId()) {
				return i;
			}
		}
		return -1;
	}

	move(fromIndex, toIndex) {
		var serverGroup = this.preferences.serverGroups[fromIndex];
		this.preferences.serverGroups.splice(fromIndex, 1);
		this.preferences.serverGroups.splice(toIndex, 0, serverGroup);
	}

	/**
	 * Return this group's server settings.
	 */
	getSettings() {
		return this.settings;
	}

	/**
	 * Return this group.
	 */
	getGroup() {
		return this.serverSettingGroup;
	}

	/**
	 * Returns the URL EntryRow.
	 */
	getNameInput() {
		return this.nameRow;
	}

	/**
	 * Create a <Code>ServerSetting</code> based on control values.
	 */
	createServerSettings() {
		this.settings = new ServerSetting(
			this.nameRow.text,
			this.urlRow.text,
			this.frequencyRow.value,
			this.useGetSwitchRow.active
		);
	}

	/**
	 * Create a unique ID for this group.
	 */
	createUID() {
		const buf = [];
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charlen = chars.length;
		for (let i = 0; i < 32; i++) {
			buf[i] = chars.charAt(Math.floor(Math.random() * charlen));
		}
		return buf.join('');
	}

	/**
	 * Return this group's unique ID.
	 */
	getId() {
		return this.id;
	}

	/**
	 * Remove this group from the set of all groups.
	 */
	removeGroup(id) {
		for (let i = 0; i < this.serverGroups.length; i++) {
			let candidate = this.serverGroups[i];
			if (candidate.getId() === id) {
				this.serverGroups.splice(i, 1);
				break;
			}
		}
	}
}