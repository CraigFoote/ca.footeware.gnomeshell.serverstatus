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
     * @param {boolean} is_get
     */
    constructor(name, url, frequency, is_get) {
        this.name = name;
        this.url = url;
        this.frequency = frequency;
        this.is_get = is_get;
    }
}
