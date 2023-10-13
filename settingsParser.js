'use strict';

import { ServerSetting } from './serverSetting.js';

export class SettingsParser {
	
	/**
	 * Parse gsettings into ServerSettings.
	 *
	 * @param {Gtk.Settings} rawSettings
	 * @returns ServerSetting[]
	 */
	static parse(rawSettings) {
		const variant = rawSettings.get_value('server-settings');
		const savedRawSettings = variant.deep_unpack();
		const settings = [];
		for (const rawSetting of savedRawSettings) {
			const name = (rawSetting['name'] != undefined) ? rawSetting['name'] : '';
			const url = (rawSetting['url'] != undefined) ? rawSetting['url'] : '';
			const frequency = (rawSetting['frequency'] != undefined) ? rawSetting['frequency'] : '60';
			const isGet = (rawSetting['is_get'] != undefined) ? rawSetting['is_get'] : 'false';
			const setting = new ServerSetting(name, url, frequency, isGet);
			settings.push(setting);
		}
		return settings;
	}
}