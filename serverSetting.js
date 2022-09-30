'use strict';

/**
 * Encapsulates the settings for a `ServerPanel`.
 * 
 * @param {String} url 
 * @param {Number} frequency 
 * @param {boolean} is_get 
 */
var ServerSetting = class ServerSetting {
  constructor(url, frequency, is_get) {
    this.url = url;
    this.frequency = frequency;
    this.is_get = is_get;
  }
}