"use strict";

import Gio from "gi://Gio";
import { Status } from "./status.js";

/**
 * Provides gicons and their statuses.
 */
export class IconProvider {
    /**
     * Constructor.
     *
     * @param {String} assetPath path to image resources
     */
    constructor(assetPath) {
        this.serverIcon = Gio.icon_new_for_string(assetPath + "/server.svg");
        this.serverUpIcon = Gio.icon_new_for_string(
            assetPath + "/server-up.svg",
        );
        this.serverDownIcon = Gio.icon_new_for_string(
            assetPath + "/server-down.svg",
        );
        this.serverBadIcon = Gio.icon_new_for_string(
            assetPath + "/server-bad.svg",
        );
    }

    /**
     * Get a gicon for the provided {Status}.
     *
     * @param {Status} status
     * @returns {Gio.icon}
     */
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

    /**
     * Get a {Status} for the provided gicon.
     *
     * @param {Gio.icon} icon
     */
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

    /**
     * Sets all status-related gicons to null for garbage collection.
     */
    destroy() {
        this.serverIcon = null;
        this.serverUpIcon = null;
        this.serverDownIcon = null;
        this.serverBadIcon = null;
    }
}
