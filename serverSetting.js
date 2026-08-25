'use strict';

/**
 * Encapsulates the settings for a {ServerGroup}.
 */
export class ServerSetting {
    /**
     * Constructor.
     *
     * @param {string} name
     * @param {string} url
     * @param {number} frequency
     * @param {number} timeout
     * @param {string} verb
     * @param {boolean} notifies
     * @param {boolean} visible
     * @param {boolean} ignoreTLSErrors
     * @param {boolean} ignoreRedirects http status 3xx
     * @param {[Header]} headers array of request header objects
     */
    constructor(name, url, frequency, timeout, verb, notifies, visible, ignoreTLSErrors, ignoreRedirects, headers) {
        this.name = name;
        this.url = url;
        this.frequency = frequency;
        this.timeout = timeout;
        this.verb = verb;
        this.notifies = notifies;
        this.visible = visible;
        this.ignoreTLSErrors = ignoreTLSErrors;
        this.ignoreRedirects = ignoreRedirects;
        this.headers = headers;
    }
}
