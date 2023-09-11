'use strict';

import Gio from 'gi://Gio';
import { Status } from './status.js';

export class IconProvider {

	constructor(assetPath) {
		this.serverIcon = Gio.icon_new_for_string(assetPath + '/server.svg');
		this.serverUpIcon = Gio.icon_new_for_string(assetPath + '/server-up.svg');
		this.serverDownIcon = Gio.icon_new_for_string(assetPath + '/server-down.svg');
		this.serverBadIcon = Gio.icon_new_for_string(assetPath + '/server-bad.svg');
	}

	getIcon(status) {
		let icon;
		switch (status) {
			case Status.Up:
				icon = this.serverUpIcon;
				break;
			case Status.Down:
				icon = this.serverDownIcon;
				break;
			case Status.Bad:
				icon = this.serverBadIcon;
				break;
			default:
				icon = this.serverIcon;
		}
		return icon;
	}

	getStatus(icon) {
		let status;
		switch (icon) {
			case this.serverUpIcon:
				status = Status.Up;
				break;
			case this.serverDownIcon:
				status = Status.Down;
				break;
			case this.serverBadIcon:
				status = Status.Bad;
				break;
			default:
				status = Status.Init;
		}
		return status;
	}

	destroy() {
		this.serverIcon = null;
		this.serverUpIcon = null;
		this.serverDownIcon = null;
		this.serverBadIcon = null;
	}
}