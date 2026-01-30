"use strict";

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import St from "gi://St";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import { Status } from "./status.js";

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
         * Update this panel by invoking the URL on a schedule.
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
                this.get(
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
         * Execute the URL invocation asynchronously and update the panel icon
         * appropriately then trigger the updating of the taskbar indicator icon appropriately.
         *
         * @param {String} httpMethod
         * @param {String} url
         * @param {St.Icon} panelIcon
         * @param {boolean} panelIconDisposed
         * @param {St.Label} durationIndicator
         * @param {boolean} durationIndicatorDisposed
         */
        get(
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

                        // remove completed request from pending set
                        this.pendingCancellables.delete(cancellable);

                        // parse result if emoji widget hasn't been destroyed
                        if (panelIcon && !panelIconDisposed) {
                            let newIcon;
                            let timedOut = false;

                            // 429 Too Many Requests causes a 'bad Soup enum' error 🤨; use try-catch
                            try {
                                const soupStatus = message.status_code;

                                // Check for timeout, Soup supposedly uses status code 1 for 
                                // timeouts but I haven't seen it or REQUEST_TIMEOUT.
                                // Also there's https://gitlab.gnome.org/GNOME/libsoup/-/issues/155
                                // Use duration calc. for now.
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
                                } else if (
                                    // consider 200 through 399 success result
                                    soupStatus >= 200 &&
                                    soupStatus < 400
                                ) {
                                    // success
                                    newIcon = this.iconProvider.getIcon(
                                        Status.Up,
                                    );
                                } else {
                                    // HTTP error
                                    newIcon = this.iconProvider.getIcon(
                                        Status.Down,
                                    );
                                }
                            } catch {
                                newIcon = this.iconProvider.getIcon(Status.Bad);
                            }
                            panelIcon.gicon = newIcon;

                            // update response time label if it hasn't been destroyed
                            if (
                                durationIndicator &&
                                !durationIndicatorDisposed
                            ) {
                                durationIndicator.text = timedOut ? `timed out @ ${this.session.get_timeout()}s` :
                                    duration.toString() + "ms";
                            }

                            this.updateTaskbarCallback?.();
                        }
                    },
                );
            } else {
                // message was null because of malformed url
                panelIcon.gicon = this.iconProvider.getIcon(Status.Bad);
                this.updateTaskbarCallback?.();
            }
        }

        /**
         * Open a web browser at supplied URL.
         *
         * @param {String} url
         */
        openBrowser(url) {
            Gio.AppInfo.launch_default_for_uri_async(url, null, null, null);
        }
    },
);
