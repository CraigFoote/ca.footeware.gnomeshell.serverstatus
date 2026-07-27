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
     * @param {boolean} isGet
     * @param {boolean} notifies
     * @param {boolean} visible
     * @param {boolean} ignoreTLSErrors
     * @param {boolean} ignoreRedirects http status 3xx
     */
    constructor(name, url, frequency, timeout, isGet, notifies, visible, ignoreTLSErrors, ignoreRedirects) {
        this.name = name;
        this.url = url;
        this.frequency = frequency;
        this.timeout = timeout;
        this.isGet = isGet;
        this.notifies = notifies;
        this.visible = visible;
        this.ignoreTLSErrors = ignoreTLSErrors;
        this.ignoreRedirects = ignoreRedirects;
    }
}
