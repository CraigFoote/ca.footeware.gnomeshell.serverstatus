"use strict";

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import St from "gi://St";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import { Status } from "./status.js";

let notificationSource;

/**
 * A series of these panels are shown when the indicator icon is clicked.
 * Each shows a server status and name, and opens a browser to its URL when clicked.
 */
export const ServerStatusPanel = GObject.registerClass(
    {
        GTypeName: "ServerStatusPanel",
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
            this.style_class = "server-panel";

            // track pending requests for cleanup
            this.pendingCancellables = new Set();

            // flag to indicate panel is disposed and to ignore returning requests
            this.isDestroyed = false;

            // click to open browser
            this.connect("button-press-event", () => {
                this.openBrowser(serverSetting.url);
                return Clutter.EVENT_PROPAGATE;
            });

            // session from which to fire http requests
            this.session = new Soup.Session({
                timeout: serverSetting.timeout,
            });

            // icon displaying status by emoji icon
            this.panelIcon = new St.Icon({
                gicon: this.iconProvider.getIcon(Status.Init),
                style_class: "icon-lg padded",
            });
            let panelIconDisposed = false;
            this.panelIcon.connect("destroy", () => (panelIconDisposed = true));
            this.add_child(this.panelIcon);

            // server name display
            const nameLabel = new St.Label({
                text: serverSetting.name,
                style_class: "padded",
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(nameLabel);

            // duration indicator
            const durationIndicator = new St.Label({
                text: "",
                style_class: "duration",
            });
            let durationIndicatorDisposed = false;
            durationIndicator.connect(
                "destroy",
                () => (durationIndicatorDisposed = true),
            );
            const durationIndicatorContainer = new St.Bin({
                style_class: "bin",
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
                child: durationIndicator,
            });
            this.add_child(durationIndicatorContainer);

            // call once then schedule
            this.update(
                serverSetting.url,
                panelIconDisposed,
                durationIndicator,
                durationIndicatorDisposed,
            );

            // schedule recurring http calls
            this.intervalID = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                serverSetting.frequency * 1000,
                () => {
                    this.update(
                        serverSetting.url,
                        panelIconDisposed,
                        durationIndicator,
                        durationIndicatorDisposed,
                    );
                    return GLib.SOURCE_CONTINUE;
                },
            );

            this.connect("destroy", () => {
                // prevent other functions from acting on received responses
                this.isDestroyed = true;

                // remove id to recurring http calls
                if (this.intervalID) {
                    GLib.source_remove(this.intervalID);
                    this.intervalID = null;
                }

                // clear all pending requests
                if (this.pendingCancellables) {
                    this.pendingCancellables.forEach((cancellable) => {
                        if (!cancellable.is_cancelled()) {
                            cancellable.cancel();
                        }
                    });
                    this.pendingCancellables.clear();
                    this.pendingCancellables = null;
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
            });
        }

        /**
         * Returns the status of the server this panel represents.
         *
         * @return {Status}
         */
        getStatus() {
            return this.iconProvider.getStatus(this.panelIcon?.gicon);
        }

        /**
         * Invoked on a schedule, make request with provided URL.
         *
         * @param {String} url
         * @param {boolean} panelIconDisposed whether the panel icon has been disposed
         * @param {St.Label} durationIndicator
         * @param {boolean} durationIndicatorDisposed
         */
        update(
            url,
            panelIconDisposed,
            durationIndicator,
            durationIndicatorDisposed,
        ) {
            if (!this.isDestroyed) {
                const httpMethod = this.serverSetting.isGet ? "GET" : "HEAD";
                this.makeRequest(
                    httpMethod,
                    url,
                    this.panelIcon,
                    panelIconDisposed,
                    durationIndicator,
                    durationIndicatorDisposed,
                );
            }
            return GLib.SOURCE_CONTINUE;
        }

        /**
         * Execute the URL invocation asynchronously and trigger the update of the GUI.
         *
         * @param {String} httpMethod
         * @param {String} url
         * @param {St.Icon} panelIcon
         * @param {boolean} panelIconDisposed
         * @param {St.Label} durationIndicator
         * @param {boolean} durationIndicatorDisposed
         */
        makeRequest(
            httpMethod,
            url,
            panelIcon,
            panelIconDisposed,
            durationIndicator,
            durationIndicatorDisposed,
        ) {
            if (this.isDestroyed) {
                return;
            }
            // create http object, `new Soup.Message()` constructor is deprecated in favor of '.new' 🤨
            const message = Soup.Message.new(httpMethod, url);
            if (message) {
                // create a cancellable for this request
                const cancellable = new Gio.Cancellable();
                this.pendingCancellables.add(cancellable);

                // start duration calc.
                const start = Date.now();

                // do the actual http call
                this.session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    cancellable,
                    () => {
                        // response received, complete duration calc.
                        const duration = Date.now() - start;

                        if (this.isDestroyed || !this.pendingCancellables) {
                            return;
                        }

                        this.processResponse(cancellable, duration, message, panelIcon, panelIconDisposed, durationIndicator, durationIndicatorDisposed);
                    });
            } else {
                // message was null because of malformed url
                panelIcon.gicon = this.iconProvider.getIcon(Status.Bad);
                this.updateTaskbarCallback?.();
            }
        }

        /**
         * Process the provided message and update the UI accordingly.
         * 
         * @param {Gio.Cancellable} cancellable 
         * @param {number} duration 
         * @param {Soup.Message} message 
         * @param {Gio.icon} panelIcon 
         * @param {boolean} panelIconDisposed 
         * @param {St.Label} durationIndicator 
         * @param {boolean} durationIndicatorDisposed 
         */
        processResponse(cancellable, duration, message, panelIcon, panelIconDisposed, durationIndicator, durationIndicatorDisposed) {
            // remove completed request from pending set
            this.pendingCancellables.delete(cancellable);

            // parse result if emoji widget hasn't been destroyed
            if (panelIcon && !panelIconDisposed) {
                let newIcon;
                let timedOut = false;
                let reason;

                // 429 Too Many Requests causes a 'bad Soup enum' error 🤨; use try-catch
                try {
                    const soupStatus = message.status_code;

                    /*
                     * Check for timeout first. Soup supposedly uses status code 1 for 
                     * timeouts but I haven't seen it or REQUEST_TIMEOUT.
                     * Also there's https://gitlab.gnome.org/GNOME/libsoup/-/issues/155.
                     * Use duration calc. for now.
                     */
                    if (
                        soupStatus === 1 ||
                        soupStatus === Soup.Status.REQUEST_TIMEOUT ||
                        duration > (this.session.get_timeout() * 1000)
                    ) {
                        // request timed out
                        newIcon = this.iconProvider.getIcon(
                            Status.Down,
                        );
                        timedOut = true;
                        reason = `This server timed out after ${duration / 1000} seconds.`;
                    } else if (
                        // consider 200 through 399 success result
                        soupStatus >= 200 &&
                        soupStatus < 400
                    ) {
                        // success
                        newIcon = this.iconProvider.getIcon(
                            Status.Up,
                        );
                    } else if (soupStatus === 0) {
                        // incomplete response
                        newIcon = this.iconProvider.getIcon(Status.Down);
                        reason = "This server is down. No status was received.";
                    } else {
                        // HTTP error
                        newIcon = this.iconProvider.getIcon(
                            Status.Down,
                        );
                        reason = `This server is down: ${soupStatus} ${message.reason_phrase}.`;
                    }
                } catch (e) {
                    // 429 or another status missing from the soup enum?
                    newIcon = this.iconProvider.getIcon(Status.Down);
                    reason = `This server is down: ${e.message}.`;
                }

                this.updateGUI(panelIcon, newIcon, durationIndicator, durationIndicatorDisposed, timedOut, duration, reason);
            }
        }

        /**
         * Handle the response. Update the icons, panel text and possibly notify user.
         * 
         * @param {Gio.icon} panelIcon 
         * @param {Gio.icon} newIcon 
         * @param {St.Label} durationIndicator 
         * @param {boolean} durationIndicatorDisposed 
         * @param {boolean} timedOut 
         * @param {number} duration 
         * @param {String} reason 
         */
        updateGUI(panelIcon, newIcon, durationIndicator, durationIndicatorDisposed, timedOut, duration, reason) {
            // update row icon
            panelIcon.gicon = newIcon;

            // update response time label if it hasn't been destroyed
            if (
                durationIndicator &&
                !durationIndicatorDisposed
            ) {
                durationIndicator.text = timedOut ? `timed out @ ${this.session.get_timeout()}s` :
                    `${duration}ms`;
            }

            // notify user if we are notifying and status is down
            if (this.serverSetting.notifies && (this.iconProvider.getStatus(newIcon) === Status.Down)) {
                this.fireNotification(newIcon, reason);
            }

            // update main indicator icon
            this.updateTaskbarCallback?.();
        }

        /**
         * Show a desktop notification using the provided icon and this panel's name.
         * 
         * @param {Gio.icon} icon 
         * @param {String} reason
         */
        fireNotification(icon, reason) {
            const source = this.getNotificationSource();
            const notification = new MessageTray.Notification({
                source: source,
                title: _(this.serverSetting.name),
                body: _(reason),
                gicon: icon,
                urgency: MessageTray.Urgency.HIGH,
            });
            source.addNotification(notification);
        }

        /**
         * Lazily creates and returns a notification source.
         * 
         * @returns {MessageTray.Source}
         */
        getNotificationSource() {
            if (!notificationSource) {
                notificationSource = new MessageTray.Source({
                    title: _("Server Status Indicator"),
                    iconName: "dialog-warning",
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
         * @param {String} url
         */
        openBrowser(url) {
            Gio.AppInfo.launch_default_for_uri_async(url, null, null, null);
        }
    }
);

