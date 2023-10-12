'use strict';

/**
 * Encapsulates the settings for a `ServerGroup`.
 * 
 * @param {String} name
 * @param {String} url 
 * @param {Number} frequency 
 * @param {boolean} is_get 
 */
export class ServerSetting {
	constructor(name, url, frequency, is_get) {
		this.name = name;
		this.url = url;
		this.frequency = frequency;
		this.is_get = is_get;
	};
};