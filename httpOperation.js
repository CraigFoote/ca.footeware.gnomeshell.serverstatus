'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import {Status} from './status.js';

/**
 * Make a HTTP request.
 */
export class HttpOperation {
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
        this.panelIcon = panel.panelIcon;
        this.iconProvider = panel.iconProvider;
        this.panel = panel;

        this.cancellable = new Gio.Cancellable();

        panel.connect('destroy', () => {
            this.cancellable.cancel();
            this.cancellable = null;

            this.settings = null;
            this.session = null;
            this.panelIcon = null;
            this.iconProvider = null;
            this.panel = null;
            this.completeCallback = null;
        });
    }

    /**
     * Make the HTTP request and examine result.
     */
    run() {
        // create http object, `new Soup.Message()` constructor is deprecated in favor of '.new' 🤨
        const message = Soup.Message.new(this.settings.verb, this.settings.url);
        if (message) {
            // do we automatically follow redirects
            if (this.settings.ignoreRedirects)
                message.set_flags(Soup.MessageFlags.NO_REDIRECT);

            // do we have custom headers to send
            if (this.settings.headers) {
                for (const header of this.settings.headers)
                    message.request_headers.append(header.name, header.value);
            }

            // start duration calc.
            const start = Date.now();

            // do the actual http call
            this.session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                this.cancellable,
                (session, result, error) => {
                    // response received, complete duration calc.
                    const duration = Date.now() - start;

                    if (!this.cancellable || this.cancellable.is_cancelled())
                        return;

                    let reason;
                    let newIcon;
                    let timedOut = false;

                    timedOut = duration > (this.session?.get_timeout() * 1000);
                    if (timedOut) {
                        newIcon = this.iconProvider.getIcon(Status.Down);
                        reason = `Timed out at ${duration / 1000}s`;
                    } else if (error) {
                        // extension unable to send request
                        if (this.iconProvider) {
                            reason = error.toString();
                            newIcon = this.iconProvider.getIcon(Status.Bad);
                        }
                    }

                    if (!newIcon) {
                        try {
                            // we aren't interested in the result if there is one,
                            // make this call to get exception if exists
                            session.send_and_read_finish(result);
                        } catch (e) {
                            [reason, newIcon] = this.#handleReadFinishErrors(e, this.panelIcon);
                        }
                    }

                    if (!newIcon) {
                        // process response to get the icon and possibly a reason
                        [reason, newIcon, timedOut] = this.#processResponse(duration, message, this.panelIcon);
                    }

                    // update UI
                    this.panel.updateGUI(reason, newIcon, timedOut, duration);

                    this.completeCallback();
                });
        } else if (this.panelIcon && this.iconProvider) {
            // message was null because of malformed url
            this.panelIcon.gicon = this.iconProvider.getIcon(Status.Bad);
            this.updateTaskbarCallback?.();
        }
    }

    /**
     * Create a reason and appropriate icon from the provided error.
     *
     * @param {Gio.*} error
     * @param {St.Icon} panelIcon
     * @returns [{String}, {St.Icon}]
     */
    #handleReadFinishErrors(error, panelIcon) {
        let reason, newIcon;
        if (panelIcon && this.panel.iconProvider) {
            // do not check for Gio.TlsError as it's handled later
            if (error instanceof Gio.IOErrorEnum) {
                if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) ||
                    error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NETWORK_UNREACHABLE)) {
                    // Cancelled due to OS suspend & unreachable due to network outage.
                    // Neither should notify user when it returns - use init status.
                    // No reason & no notification.
                    newIcon = this.panel.iconProvider.getIcon(Status.Init);
                } else if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.TIMED_OUT)) {
                    // Let upcoming duration calc handle time outs; no icon or reason here.
                    // This allows for duration display as well as notification.
                } else {
                    // unknown error
                    reason = `An error occurred: ${error.message}`;
                    newIcon = this.panel.iconProvider.getIcon(Status.Down);
                }
            } else if (error instanceof Gio.ResolverError) {
                newIcon = this.panel.iconProvider.getIcon(Status.Init);
            }
        }
        return [reason, newIcon];
    }

    /**
     * Process the provided message; determine new icon and, if failure, reason and
     * whether or not the request exceeded set timeout.
     *
     * @param {number} duration
     * @param {Soup.Message} message
     * @param {Gio.icon} panelIcon
     * @returns [reason, newIcon, timedOut] [{String}, {Gio.Icon}, {boolean}]
     */
    #processResponse(duration, message, panelIcon) {
        let reason, newIcon;
        let timedOut = false;

        // parse result if emoji widget hasn't been destroyed
        if (panelIcon && this.iconProvider) {
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
                    reason = `Timed out at ${duration / 1000}s`;
                    newIcon = this.iconProvider.getIcon(Status.Down);
                } else if (soupStatus >= 200 && soupStatus < 300) {
                    // consider 200 through 299 success result
                    newIcon = this.iconProvider.getIcon(Status.Up); // success
                    // no error, no reason, no notification
                } else if (soupStatus >= 300 && soupStatus < 400) {
                    // redirects, treat as up unless Location header is missing or missing a value
                    [reason, newIcon] = this.#handleRedirects(soupStatus, soupStatusText, message);
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
                    [reason, newIcon] = this.#handleZeroStatus(message);
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
     * Determine the reason string and the new icon from the provided 3xx-status message.
     *
     * @param {string} soupStatus
     * @param {string} soupStatusText
     * @param {Soup.Message} message
     * @returns [string, string] [reason, status]
     */
    #handleRedirects(soupStatus, soupStatusText, message) {
        let reason, newIcon;
        if (soupStatus >= 300 && soupStatus < 400) {
            // check only those statuses that require a 'Location' response header
            if (soupStatus === 301 || soupStatus === 302 || soupStatus === 303 || soupStatus === 307 || soupStatus === 308) {
                const responseHeaders = message.get_response_headers();
                const locationHeader = responseHeaders.get_one('Location');
                if (!locationHeader || locationHeader.length === 0) {
                    reason = `Server returned ${soupStatus} ${soupStatusText} but there was no 'Location' response header to follow.`;
                    newIcon = this.panel.iconProvider.getIcon(Status.Down); // failure
                } else {
                    newIcon = this.panel.iconProvider.getIcon(Status.Up); // success
                    // no error, no reason, no notification
                }
            } else {
                // one of the other 3xx statuses that don't require a 'Location' response header
                newIcon = this.panel.iconProvider.getIcon(Status.Up); // success
                // no error, no reason, no notification
            }
        }
        return [reason, newIcon];
    }

    /**
     * Determine the reason string and the new icon from the provided 0-status message.
     *
     * @param {Soup.Message} message
     * @returns [reason, newIcon] [{String}, {Gio.icon}]
     */
    #handleZeroStatus(message) {
        let reason, newIcon;
        if (message.status_code === 0) {
            // cert failure?
            const certificateErrors = message.get_tls_peer_certificate_errors();
            if (certificateErrors) {
                if (this.serverSetting.ignoreTLSErrors) {
                    // consider this server up
                    newIcon = this.panel.iconProvider.getIcon(Status.Up);
                } else {
                    const errorNames = this.#getErrorNames(certificateErrors);
                    const subject = message.get_tls_peer_certificate()?.get_subject_name();
                    reason = `This server is down.The certificate for ${subject} was presented with errors: ${errorNames} `;
                    newIcon = this.panel.iconProvider.getIcon(Status.Down);
                }
            } else {
                // no status or cert errors set, just notify user
                reason = 'This server is down. No status or certificate errors were returned.';
                newIcon = this.panel.iconProvider.getIcon(Status.Down);
            }
        }
        return [reason, newIcon];
    }

    /**
     * Get the concatenated string of all the error names in the provided flags.
     *
     * @param {Gio.TlsCertificateFlags} errorFlags
     * @returns {string}
     */
    #getErrorNames(errorFlags) {
        if (errorFlags === 0)
            return 'NO_FLAGS';

        const names = [];
        for (const [name, value] of Object.entries(Gio.TlsCertificateFlags)) {
            // skip 0 (already handled above)
            // bitwise &'ing to find matching values then store their names
            if (value !== 0 && ((errorFlags & value) === value))
                names.push(name);
        }
        return names.join(', ');
    }

    /**
     * Cancel the current `HTTP Request` call.
     */
    cancel() {
        this.cancellable?.cancel();
    }
}
