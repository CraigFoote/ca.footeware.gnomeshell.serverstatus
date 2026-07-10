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
            this.panelIcon.connect("destroy", () => {
                panelIconDisposed = true;
            });
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

            // schedule recurring http requests
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
                // remove id to recurring http calls
                if (this.intervalID) {
                    GLib.Source.remove(this.intervalID);
                    this.intervalID = null;
                }

                // clear all pending requests
                if (this.pendingCancellables) {
                    this.pendingCancellables.forEach((cancellable) => {
                        if (!cancellable.is_cancelled()) {
                            cancellable.cancel();
                            this.pendingCancellables.delete(cancellable);
                            cancellable = null;
                        }
                    });
                    this.pendingCancellables = null;
                }

                // Clean up the HTTP session
                if (this.session) {
                    this.session.abort();
                    this.session = null;
                }

                // Clean up instance properties
                this.panelIcon.destroy();
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
            const httpMethod = this.serverSetting.isGet ? "GET" : "HEAD";
            this.makeRequest(
                httpMethod,
                url,
                this.panelIcon,
                panelIconDisposed,
                durationIndicator,
                durationIndicatorDisposed,
            );
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
                    (session, result, error) => {
                        // response received, complete duration calc.
                        const duration = Date.now() - start;

                        // remove completed request from pending set
                        this.pendingCancellables?.delete(cancellable);
                        if (cancellable.is_cancelled()) {
                            return;
                        }

                        let newIcon;
                        let timedOut = false;
                        let reason;

                        if (error) {
                            // extension unable to send request
                            if (panelIcon && !panelIconDisposed && this.iconProvider) {
                                reason = error.toString();
                                newIcon = this.iconProvider.getIcon(Status.Init);
                            }
                        }

                        if (!newIcon) {
                            try {
                                // we aren't interested in the result if there is one, make this call to get exception
                                session.send_and_read_finish(result);
                            } catch (e) {
                                if (panelIcon && !panelIconDisposed && this.iconProvider) {
                                    // do not check for Gio.TlsError as it's handled later
                                    if (e instanceof Gio.IOErrorEnum) {
                                        if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                                            newIcon = this.iconProvider.getIcon(Status.Init);
                                        } else if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.TIMED_OUT)) {
                                            // Let duration calc below handle time outs; no icon or reason here.
                                            // This allows for duration display as well as notification.
                                        } else {
                                            reason = e.message;
                                            newIcon = this.iconProvider.getIcon(Status.Down);
                                        }
                                    } else if (e instanceof Gio.ResolverError) {
                                        newIcon = this.iconProvider.getIcon(Status.Init);
                                    }
                                }
                            }
                        }

                        if (!newIcon) {
                            // process response to get it
                            [reason, newIcon, timedOut] = this.processResponse(duration, message, httpMethod, url, panelIcon, panelIconDisposed);
                        }

                        // update UI
                        this.updateGUI(reason, newIcon, timedOut, duration, panelIcon, panelIconDisposed, durationIndicator, durationIndicatorDisposed);
                    });
            } else {
                // message was null because of malformed url
                if (panelIcon && !panelIconDisposed && this.iconProvider) {
                    panelIcon.gicon = this.iconProvider.getIcon(Status.Bad);
                    this.updateTaskbarCallback?.();
                }
            }
        }

        /**
         * Process the provided message; determine new icon and, if failure, reason and 
         * whether or not the request exceeded set timeout.
         * 
         * @param {number} duration 
         * @param {Soup.Message} message 
         * @param {Gio.icon} panelIcon 
         * @param {boolean} panelIconDisposed 
         * @param {St.Label} durationIndicator 
         * @param {boolean} durationIndicatorDisposed 
         * @returns [reason, newIcon, timedOut] {String}, {Gio.Icon}, {boolean}
         */
        processResponse(duration, message, httpMethod, url, panelIcon, panelIconDisposed) {
            let reason;
            let newIcon;
            let timedOut = false;

            // parse result if emoji widget hasn't been destroyed
            if (panelIcon && !panelIconDisposed && this.iconProvider) {

                // 429 Too Many Requests causes a 'bad Soup enum' error 🤨; use try-catch
                try {
                    const soupStatus = message.status_code;
                    const soupStatusText = message.reason_phrase;

                    /*
                     * Check for timeout first. Soup supposedly uses status code 1 for 
                     * timeouts but I haven't seen it or REQUEST_TIMEOUT (408).
                     * Also there's https://gitlab.gnome.org/GNOME/libsoup/-/issues/155.
                     * Use duration calc. for now.
                     */
                    if (
                        soupStatus === 1 ||
                        soupStatus === Soup.Status.REQUEST_TIMEOUT ||
                        duration > (this.session.get_timeout() * 1000)
                    ) {
                        // request timed out
                        timedOut = true;
                        reason = `This server timed out after ${duration / 1000} seconds.`;
                        newIcon = this.iconProvider.getIcon(
                            Status.Down,
                        );
                    } else if (
                        // consider 200 through 399 success result
                        soupStatus >= 200 &&
                        soupStatus < 400
                    ) {
                        // success
                        newIcon = this.iconProvider.getIcon(
                            Status.Up,
                        );
                        // no error, no reason, no notification
                    } else if (soupStatus >= 400 && soupStatus < 500) {
                        // client-side error
                        reason = `Client-side error: ${soupStatus} ${soupStatusText}`;
                        newIcon = this.iconProvider.getIcon(Status.Down);
                    } else if (soupStatus >= 500) {
                        // server-side error
                        reason = `Server-side error: ${soupStatus} ${soupStatusText}`;
                        newIcon = this.iconProvider.getIcon(Status.Down);
                    } else if (soupStatus === 0) {
                        // no status set, incomplete response
                        [reason, newIcon] = this.handleZeroStatus(message);
                    } else {
                        // wut?
                        reason = `Unknown status: ${soupStatus} ${soupStatusText}`;
                        newIcon = this.iconProvider.getIcon(Status.Down);
                    }
                } catch (e) {
                    // 429 or another status missing from the soup enum?
                    reason = `This server is down: ${e.message}.`;
                    newIcon = this.iconProvider.getIcon(Status.Down);
                }
            }
            return [reason, newIcon, timedOut];
        }

        /**
         * Reflect the response. Update the icons, panel text and possibly notify user.
         * 
         * @param {String} reason 
         * @param {Gio.icon} newIcon 
         * @param {boolean} timedOut 
         * @param {number} duration 
         * @param {Gio.icon} panelIcon
         * @param {boolean}  panelIconDisposed
         * @param {St.Label} durationIndicator 
         * @param {boolean} durationIndicatorDisposed 
         */
        updateGUI(reason, newIcon, timedOut, duration, panelIcon, panelIconDisposed, durationIndicator, durationIndicatorDisposed) {
            if (panelIcon && !panelIconDisposed && this.iconProvider) {
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
                urgency: MessageTray.Urgency.NORMAL,
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
            Gio.AppInfo.launch_default_for_uri_async(
                url,
                null,
                null,
                (appInfo, result) => {
                    try {
                        Gio.AppInfo.launch_default_for_uri_finish(result);
                    } catch {
                        // fail silently
                    }
                }
            );
        }

        /**
         * Prompt the user with a notification asking whether to trust the server's presented certificate. 
         * On acceptance, the provided callback is invoked to re-issue the request.
         *
         * @param {Soup.Message} message
         * @param {Gio.TlsCertificateFlags} certificateErrors
         * @param {String} url
         * @param {Function} callback
         */
        handleCertificateErrors(message, certificateErrors) {
            const subject = message.get_tls_peer_certificate()?.get_subject_name();
            const errorNames = this.getErrorNames(certificateErrors);
            return [`The server certificate for ${subject} has errors: ${errorNames} `, this.iconProvider.getIcon(Status.Down)];
        }

        /**
         * Get the concatenated string of all the error names in the provided flags.
         * 
         * @param {Gio.TlsCertificateFlags} errorFlags
         * @returns {String}
         */
        getErrorNames(errorFlags) {
            if (errorFlags === 0) {
                return "NO_FLAGS";
            }
            const names = [];
            for (const [name, value] of Object.entries(Gio.TlsCertificateFlags)) {
                // skip 0 (already handled above)
                // bitwise &'ing to find matching values then store their names
                if (value !== 0 && ((errorFlags & value) === value)) {
                    names.push(name);
                }
            }
            return names.join(", ");
        }

        /**
         * Determine the reason string and the new icon from the provided message.
         * 
         * @param {Soup.Message} message 
         * @returns [{String}, {Gio.icon}]
         */
        handleZeroStatus(message) {
            let reason, newIcon;

            if (message.status_code === 0) {
                // cert failure?
                const certificateErrors = message.get_tls_peer_certificate_errors();
                if (certificateErrors) {
                    if (this.serverSetting.ignoreTLSErrors) {
                        // consider this server up
                        newIcon = this.iconProvider.getIcon(Status.Up);
                    } else {
                        const errorNames = this.getErrorNames(certificateErrors);
                        const subject = message.get_tls_peer_certificate()?.get_subject_name();
                        reason = `This server is down.The certificate for ${subject} was presented with errors: ${errorNames} `;
                        newIcon = this.iconProvider.getIcon(Status.Down);
                    }
                } else {
                    // no status or cert errors set, just notify user
                    reason = "This server is down. No status or certificate errors were returned.";
                    newIcon = this.iconProvider.getIcon(Status.Down);
                }
            }
            return [reason, newIcon];
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
            this.pendingCancellables.forEach((c) => {
                if (!c.is_cancelled()) {
                    c.cancel();
                }
            });
            this.pendingCancellables.clear();
            if (this.panelIcon) {
                this.panelIcon.gicon = this.iconProvider.getIcon(Status.Init);
            }
        }

        /**
         * Restart polling after a resume event.
         */
        resume() {
            this.update(
                this.serverSetting.url,
                this.panelIconDisposed,
                this.durationIndicator,
                this.durationIndicatorDisposed,
            );
            this.intervalID = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.serverSetting.frequency * 1000,
                () => {
                    this.update(
                        this.serverSetting.url,
                        this.panelIconDisposed,
                        this.durationIndicator,
                        this.durationIndicatorDisposed,
                    );
                    return GLib.SOURCE_CONTINUE;
                },
            );
        }
    }
);
