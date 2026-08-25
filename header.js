'use strict';

/**
 * Encapsulates the settings for a http request header.
 */
export class Header {
    /**
     * Constructor.
     *
     * @param {string} name
     * @param {string} value
     */
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}
