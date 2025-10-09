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
     * @param {boolean} isGet
     */
    constructor(name, url, frequency, isGet) {
        this.name = name;
        this.url = url;
        this.frequency = frequency;
        this.isGet = isGet;
    }
}
