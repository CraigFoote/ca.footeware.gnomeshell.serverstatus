"use strict";

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import St from "gi://St";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import { Status } from "./status.js";

/**
 * A series of these panels is shown when the indicator icon is clicked.
 * Each shows a server status and name, and opens a browser to the URL when clicked.
 */
export const ServerStatusPanel = GObject.registerClass(
    {
        GTypeName: "ServerStatusPanel",
    },
    class ServerStatusPanel extends St.BoxLayout {
        _init(
            serverSetting,
            updateTaskbarCallback,
            iconProvider,
            ...otherProps
        ) {
            super._init(otherProps);
            this.serverSetting = serverSetting;
            this.updateTaskbarCallback = updateTaskbarCallback;
            this.iconProvider = iconProvider;

            this.style_class = "server-panel";

            this.session = new Soup.Session({
                timeout: 10, //seconds
            });

            // icon displaying status by emoji icon
            this.panelIcon = new St.Icon({
                gicon: this.iconProvider.getIcon(Status.Init),
                style_class: "icon-lg padded",
            });
            let panelIconDisposed = false;
            this.panelIcon.connect("destroy", () => (panelIconDisposed = true));
            this.add_child(this.panelIcon);

            // server name display, click to open browser
            const nameButton = new St.Button({
                label: serverSetting.name,
                style_class: "padded",
                y_align: Clutter.ActorAlign.CENTER,
            });
            nameButton.connect("clicked", () =>
                this.openBrowser(serverSetting.url),
            );
            this.add_child(nameButton);

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

            // when destroyed, remove id to recurring http calls
            this.connect("destroy", () => {
                if (this.intervalID) {
                    GLib.source_remove(this.intervalID);
                    this.intervalID = null;
                }
                (delete this.panelIcon, this);
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
            const httpMethod =
                this.serverSetting.is_get == "true" ? "GET" : "HEAD";
            this.get(
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
         * Execute the URL invocation asynchronously and update the panel icon
         * appropriately then trigger the updating of the taskbar indicator icon appropriately.
         *
         * @param {String} httpMethod
         * @param {String} url
         * @param {Gio.Icon} panelIcon
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
            // create http object
            let message = Soup.Message.new(httpMethod, url);
            if (message) {
                // start duration calc.
                const start = Date.now();
                // do the actual http call
                this.session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    () => {
                        // response received
                        const duration = Date.now() - start;

                        // parse result if emoji widget hasn't been destroyed
                        if (panelIcon && !panelIconDisposed) {
                            // assume down until proven up
                            let newIcon = this.iconProvider.getIcon(
                                Status.Down,
                            );

                            try {
                                // 429 Too Many Requests causes a 'bad Soup enum' error 🤨
                                const httpStatus = message.get_status();

                                // treat 2xx and 3xx return codes as success
                                if (httpStatus >= 200 && httpStatus < 400) {
                                    newIcon = this.iconProvider.getIcon(
                                        Status.Up,
                                    );
                                }
                            } catch {
                                // ignore and use initial value for newIcon i.e. Down
                            }
                            panelIcon.gicon = newIcon;

                            // update response time label if it hasn't been destroyed
                            if (
                                durationIndicator &&
                                !durationIndicatorDisposed
                            ) {
                                durationIndicator.text =
                                    duration.toString() + "ms";
                            }

                            this.updateTaskbarCallback();
                            return GLib.SOURCE_CONTINUE;
                        }
                    },
                );
            } else {
                // message was null because of malformed url
                panelIcon.gicon = this.iconProvider.getIcon(Status.Bad);
                this.updateTaskbarCallback?.();
            }
            return GLib.SOURCE_CONTINUE;
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
