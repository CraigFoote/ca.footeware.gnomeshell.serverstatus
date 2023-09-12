'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { ServerSetting } from './serverSetting.js';

export class ServerGroup {

	constructor(window, page, saveCallback, serverGroups, prefSettings, settings) {
		this.window = window;
		this.page = page;
		this.saveCallback = saveCallback;
		this.serverGroups = serverGroups;
		this.prefSettings = prefSettings;
		this.settings = settings;
		this.id = this.guid();
		this.initComponents();
		this.createServerSettings();
		this.saveCallback(this.prefSettings);
	}

	initComponents() {
		this.serverSettingGroup = new Adw.PreferencesGroup({});

		// url text field
		this.urlRow = new Adw.EntryRow({
			title: 'URL',
			text: (this.settings != undefined) ? this.settings.url : '',
			show_apply_button: true,
		});
		this.urlRow.connect('apply', () => {
			this.createServerSettings();
			this.saveCallback(this.prefSettings);
		});
		this.serverSettingGroup.add(this.urlRow);

		// frequency spinner
		this.frequencyRow = Adw.SpinRow.new_with_range(10, 300, 10);
		this.frequencyRow.set_value((this.settings != undefined) ? this.settings.frequency : 30);
		this.frequencyRow.set_title('Frequency (secs.)');
		this.frequencyRow.connect('input', () => {
			this.createServerSettings();
			this.saveCallback(this.prefSettings);
		})
		this.serverSettingGroup.add(this.frequencyRow);

		// 'use GET' switch
		this.useGetSwitch = new Adw.SwitchRow({
			title: 'Use GET rather than HEAD',
			active: (this.settings != undefined) ? !this.settings.is_get : false,
		});
		this.useGetSwitch.connect('notify::active', () => {
			this.createServerSettings();
			this.saveCallback(this.prefSettings);
		});
		this.serverSettingGroup.add(this.useGetSwitch);

		// delete button
		const deleteRow = new Adw.ActionRow({
			title: 'Delete this server',
		});
		deleteRow.connect('activated', () => {
			const messageDialog = new Adw.MessageDialog({
				transient_for: this.window,
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
			messageDialog.connect('response', (widget, responseId) => {
				if (responseId === 'delete') {
					this.createServerSettings();
					this.removeServer();
					this.saveCallback(this.prefSettings);
					this.page.remove(this.serverSettingGroup);
				}
				messageDialog.destroy();
			});
			messageDialog.present();
		});
		const deleteImage = Gtk.Image.new_from_icon_name('edit-delete-symbolic');
		deleteRow.add_suffix(deleteImage);
		deleteRow.set_activatable_widget(deleteImage);
		this.serverSettingGroup.add(deleteRow);
	}

	removeServer() {
		for (let i = 0; i < this.serverGroups.length; i++) {
			let candidate = this.serverGroups[i];
			if (candidate.getId() === this.getId()) {
				this.serverGroups.splice(i, 1);
				break;
			}
		}
	}

	getSettings() {
		return this.settings;
	}

	getGroup() {
		return this.serverSettingGroup;
	}

	createServerSettings() {
		this.settings = new ServerSetting(
			this.urlRow.text,
			this.frequencyRow.value,
			this.useGetSwitch.active
		);
	}

	guid() {
		const buf = [];
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charlen = chars.length;
		for (let i = 0; i < 32; i++) {
			buf[i] = chars.charAt(Math.floor(Math.random() * charlen));
		}
		return buf.join('');
	}

	getId() {
		return this.id;
	}
}