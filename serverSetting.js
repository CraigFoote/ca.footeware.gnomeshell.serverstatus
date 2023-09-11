'use strict';

/**
 * Encapsulates the settings for a `ServerGroup`.
 * 
 * @param {String} url 
 * @param {Number} frequency 
 * @param {boolean} is_get 
 */
export class ServerSetting {
	constructor(url, frequency, is_get) {
		this.url = url;
		this.frequency = frequency;
		this.is_get = is_get;
	};
};