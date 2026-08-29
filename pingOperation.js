'use strict';

import Gio from 'gi://Gio';

import {Status} from './status.js';

/**
 * Make a ping call.
 */
export class PingOperation {
    /**
     * Constructor.
     *
     * @param {ServerStatusPanel} panel
     * @param {Function} completeCallback
     */
    constructor(panel, completeCallback) {
        this.completeCallback = completeCallback;
        this.settings = panel.serverSetting;
        this.session = panel.session;
        this.iconProvider = panel.iconProvider;
        this.panel = panel;

        this.cancellable = new Gio.Cancellable();

        panel.connect('destroy', () => {
            this.cancellable.cancel();
            this.cancellable = null;
            this.settings = null;
            this.session = null;
            this.iconProvider = null;
            this.panel = null;
            this.completeCallback = null;
        });
    }

    /**
     * Make the `ping` call and examine result.
     */
    run() {
        let newIcon = this.iconProvider.getIcon(Status.Init);
        let reason = 'Unknown error';
        let timedOut = false;
        let duration = -1;

        try {
            const process = new Gio.Subprocess({
                argv: ['ping', '-c', '1', '-W', String(this.settings.timeout), this.settings.url],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });
            process.init(null);

            // start duration calc.
            const start = Date.now();
            process.communicate_utf8_async(null, this.cancellable, (proc, res) => {
                // response received, complete duration calc.
                duration = Date.now() - start;

                if (!this.cancellable || this.cancellable.is_cancelled())
                    return;

                timedOut = duration > (this.session?.get_timeout() * 1000);
                if (timedOut) {
                    newIcon = this.iconProvider.getIcon(Status.Down);
                    reason = `Timed out at ${duration / 1000}s`;
                } else {
                    const [_, __, error] = proc.communicate_utf8_finish(res);

                    if (error) {
                        if (error.includes('Name or service not known') ||
                            error.includes('Temporary failure in name resolution') ||
                            error.includes('Network is unreachable')) {
                            newIcon = this.iconProvider.getIcon(Status.Bad);
                            reason = error;
                        } else {
                            newIcon = this.iconProvider.getIcon(Status.Down);
                            reason = error;
                        }
                    } else {
                        const success = proc.get_successful();
                        if (success) {
                            newIcon = this.iconProvider.getIcon(Status.Up); // no need for reason
                        } else {
                            newIcon = this.iconProvider.getIcon(Status.Down);
                            reason = 'Ping failed';
                        }
                    }
                }
                this.panel.updateGUI(reason, newIcon, timedOut, duration);
                this.completeCallback();
            });
        } catch (e) {
            newIcon = this.iconProvider.getIcon(Status.Down);
            reason = e.toString();
            this.panel.updateGUI(reason, newIcon, timedOut, duration);
            this.completeCallback();
        }
    }

    /**
     * Cancel the current `ping` call.
     */
    cancel() {
        this.cancellable?.cancel();
    }
}
