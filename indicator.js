import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { Status } from "./status.js";

/**
 * The taskbar indicator with an icon showing worst status of all server statuses.
 * Upon clicking, a series of `ServerStatusPanel`s displays individual server statuses.
 */
export const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(extensionName, iconProvider) {
            super._init(0.0, extensionName);

            this.iconProvider = iconProvider;

            this.panelIcon = new St.Icon({
                gicon: iconProvider?.getIcon(Status.Init),
                style_class: "system-status-icon",
            });
            this.add_child(this.panelIcon);

            this.statusPanels = [];
        }

        /**
         * Gets the panel's leading icon widget.
         * @returns {St.Icon}
         */
        getPanelIcon() {
            return this.panelIcon;
        }

        /**
         * Gets the set of `ServerStatusPanel`s, one per server setting.
         * @returns {ServerStatusPanel} array
         */
        getStatusPanels() {
            return this.statusPanels;
        }

        /**
         * Add a `ServerStatusPanel` to the set of #statusPanels.
         * @param {ServerStatusPanel} panel
         */
        addStatusPanel(panel) {
            this.statusPanels.push(panel);
        }

        /**
         * Remove all `ServerStatusPanel`s from the indicator menu.
         */
        clearStatusPanels() {
            if (this.statusPanels) {
                this.statusPanels.forEach((panel) => {
                    panel.destroy();
                });
                this.statusPanels = [];
            }
        }

        /**
         * Replace the current icon with the one appropriate for the provided status.
         * @param {Status} status
         */
        updatePanelIcon(status) {
            if (this.panelIcon && this.iconProvider) {
                this.panelIcon.gicon = this.iconProvider.getIcon(status);
            }
        }
    },
);
