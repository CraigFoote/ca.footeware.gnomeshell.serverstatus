"use strict";

/**
 * Encapsulates the settings for a {ServerGroup}.
 */
export class ServerSetting {
    /**
     * Constructor.
     *
     * @param {String} name
     * @param {String} url
     * @param {Number} frequency
     * @param {Number} timeout
     * @param {boolean} isGet
     */
    constructor(name, url, frequency, timeout, isGet) {
        this.name = name;
        this.url = url;
        this.frequency = frequency;
        this.timeout = timeout;
        this.isGet = isGet;
    }
}
