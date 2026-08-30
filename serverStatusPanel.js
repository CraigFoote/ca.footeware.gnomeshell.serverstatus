'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {Status} from './status.js';
import {HttpOperation} from './httpOperation.js';
import {PingOperation} from './pingOperation.js';

let notificationSource;

/**
 * A series of these panels are shown when the indicator icon is clicked.
 * Each shows a server status and name, and, when it's an HTTP or HTTPS url,
 * opens a browser to it when clicked. If it's a PING, no action occurs on click.
 */
export const ServerStatusPanel = GObject.registerClass(
    {
        GTypeName: 'ServerStatusPanel',
    },
    class ServerStatusPanel extends St.BoxLayout {
        constructor(
            serverSetting,
            updateTaskbarCallback,
            iconProvider,
            ...otherProps
        ) {
            super(otherProps);
            this.serverSetting = serverSetting;
            this.updateTaskbarCallback = updateTaskbarCallback;
            this.iconProvider = iconProvider;

            // mouse rollover
            this.track_hover = true;
            this.reactive = true;
            this.style_class = 'server-panel';

            // track pending requests for cleanup
            this.pendingOperations = new Set();

            // click to open browser
            this.connect('button-press-event', () => {
                this.#openBrowser(serverSetting.url);
                return Clutter.EVENT_PROPAGATE;
            });

            // session from which to fire http requests
            this.session = new Soup.Session({
                timeout: serverSetting.timeout,
            });

            // icon displaying status by emoji icon
            this.panelIcon = new St.Icon({
                gicon: this.iconProvider.getIcon(Status.Init),
                style_class: 'icon-lg padded',
            });
            this.add_child(this.panelIcon);

            // server name display
            const nameLabel = new St.Label({
                text: serverSetting.name,
                style_class: 'padded',
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(nameLabel);

            // duration indicator
            this.durationIndicator = new St.Label({
                text: '',
                style_class: 'duration',
            });
            const durationIndicatorContainer = new St.Bin({
                style_class: 'bin',
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
                child: this.durationIndicator,
            });
            this.add_child(durationIndicatorContainer);

            // call once then schedule
            this.#update();

            // schedule recurring requests
            this.intervalID = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                serverSetting.frequency * 1000,
                () => {
                    this.#update();
                    return GLib.SOURCE_CONTINUE;
                }
            );

            this.connect('destroy', () => {
                // remove id to recurring http calls
                if (this.intervalID) {
                    GLib.Source.remove(this.intervalID);
                    this.intervalID = null;
                }

                // clear all pending requests
                if (this.pendingOperations) {
                    this.pendingOperations.forEach(operation => {
                        operation.cancel();
                        this.pendingOperations.delete(operation);
                        operation = null;
                    });
                    this.pendingOperations = null;
                }

                // Clean up the HTTP session
                if (this.session) {
                    this.session.abort();
                    this.session = null;
                }

                // Clean up instance properties
                this.panelIcon = null;
                this.serverSetting = null;
                this.updateTaskbarCallback = null;
                this.iconProvider = null;
                this.durationIndicator = null;
            });
        }

        /**
         * Returns the status of the server this panel represents.
         *
         * @returns {Status}
         */
        getStatus() {
            return this.iconProvider.getStatus(this.panelIcon?.gicon);
        }

        /**
         * Stop polling and cancel in-flight requests. Resets icon to Init.
         * Called on system suspend.
         */
        suspend() {
            if (this.intervalID) {
                GLib.Source.remove(this.intervalID);
                this.intervalID = null;
            }
            this.pendingOperations.forEach(op => {
                op.cancel();
            });
            this.pendingOperations.clear();
            if (this.panelIcon)
                this.panelIcon.gicon = this.iconProvider.getIcon(Status.Init);
        }

        /**
         * Restart polling after a resume event.
         */
        resume() {
            this.#update();
            this.intervalID = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.serverSetting.frequency * 1000,
                () => {
                    this.#update();
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        /**
         * Invoked on a schedule, make request with provided URL.
         */
        #update() {
            const verb = this.serverSetting.verb ?? 'HEAD';

            let operation;
            if (verb === 'HEAD' || verb === 'GET') {
                operation = new HttpOperation(this, () => {
                    // callback is called to clean up after completion
                    this.pendingOperations.delete(operation);
                    operation = null;
                });
            } else if (verb === 'PING') {
                operation = new PingOperation(this, () => {
                    // callback is called to clean up after completion
                    this.pendingOperations.delete(operation);
                    operation = null;
                });
            }

            this.pendingOperations.add(operation);

            operation.run();
            return GLib.SOURCE_CONTINUE;
        }

        /**
         * Reflect the response. Update the icons, panel text and possibly notify user.
         *
         * @param {string} reason
         * @param {Gio.icon} newIcon
         * @param {boolean} timedOut
         * @param {number} duration
         */
        updateGUI(reason, newIcon, timedOut, duration) {
            if (this.panelIcon && this.iconProvider) {
                // update row icon
                this.panelIcon.gicon = newIcon;
                // update response time label if it hasn't been destroyed
                if (this.durationIndicator) {
                    let durationText = '';
                    if (timedOut)
                        durationText = `Timed out at ${duration}ms`;
                    else if (duration)
                        durationText = `${duration}ms`;
                    this.durationIndicator.text = durationText;
                }

                // notify user if we are notifying and status is down
                if (this.serverSetting.notifies && (this.iconProvider.getStatus(newIcon) === Status.Down))
                    this.#fireNotification(newIcon, reason);
            }

            // update main indicator icon
            this.updateTaskbarCallback?.();
        }

        /**
         * Show a desktop notification using the provided icon and this panel's name.
         *
         * @param {Gio.icon} icon
         * @param {string} reason
         */
        #fireNotification(icon, reason) {
            const source = this.#getNotificationSource();
            const notification = new MessageTray.Notification({
                source,
                title: this.serverSetting.name,
                body: reason,
                gicon: icon,
                urgency: MessageTray.Urgency.NORMAL,
            });
            source.addNotification(notification);
        }

        /**
         * Lazily creates and returns a notification source.
         *
         * @returns {MessageTray.Source}
         */
        #getNotificationSource() {
            if (!notificationSource) {
                notificationSource = new MessageTray.Source({
                    title: 'Server Status Indicator',
                    iconName: 'dialog-warning',
                    policy: new MessageTray.NotificationGenericPolicy(),
                });
                notificationSource.connect('destroy', _source => {
                    notificationSource = null;
                });
                Main.messageTray.add(notificationSource);
            }
            return notificationSource;
        }

        /**
         * Open a web browser at supplied URL.
         *
         * @param {string} url
         */
        async #openBrowser(url) {
            if (url.startsWith('http')) {
                await Gio.AppInfo.launch_default_for_uri_async(
                    url,
                    null,
                    null,
                    (appInfo, result) => {
                        Gio.AppInfo.launch_default_for_uri_finish(result);
                    }
                );
            }
        }
    }
);
