'use strict';

const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const serverSetting = Me.imports.serverSetting;

let grid;
let setting;
let urlEntry;
let freqButton;
let getToggle;
let id;

/**
 * A `Gtk.Grid` displaying the controls to create a `ServerSetting`.
 * 
 * @param {Widget} parent 
 * @param {Function} removeCallback 
 * @param {Function} saveCallback
 */
var ServerPanel = class ServerPanel {
  /**
   * Constructor.
   * 
   * @param {Widget} parent 
   * @param {Function} removeCallback
   * @param {Function} saveCallback
   */
  constructor(parent, removeCallback, saveCallback) {
    this.parent = parent;
    this.removeCallback = removeCallback;
    this.saveCallback = saveCallback;

    id = this.guid();
  }

  /**
   * Set a `ServerSetting` for use in initializing controls.
   * 
   * @param {ServerSetting} savedSetting 
   */
  load(savedSetting) {
    this.existingSetting = savedSetting;
  }

  /**
   * Create the controls.
   */
  create() {
    grid = new Gtk.Grid({
      hexpand: true,
      vexpand: false,
      row_homogeneous: false,
      column_homogeneous: false,
      column_spacing: 20,
      row_spacing: 20,
      margin_start: 20,
      margin_top: 20,
      margin_end: 20,
      margin_bottom: 20,
      css_classes: ['bordered', 'padded', 'shadowed', 'lighter'],
    });

    this.parent.append(grid);

    // URL label
    const urlLabel = new Gtk.Label({
      label: 'Enter an URL to poll:',
      halign: Gtk.Align.CENTER,
    });
    grid.attach(urlLabel, 0, 0, 1, 1);

    // URL entry
    urlEntry = new Gtk.Entry({
      width_chars: 50,
    });
    if (this.existingSetting && this.existingSetting.url) {
      urlEntry.text = this.existingSetting.url;
    }
    grid.attach(urlEntry, 1, 0, 2, 1);
    urlEntry.connect('changed', () => {
      this.createSetting();
      this.saveCallback();
    });

    // frequency label
    const pollLabel = new Gtk.Label({
      label: 'Poll frequency (sec.):',
      halign: Gtk.Align.END,
    });
    grid.attach(pollLabel, 0, 1, 1, 1);

    // frequency spinButton
    let adjustment = new Gtk.Adjustment({
      value: 10,
      lower: 10,
      upper: 300,
      step_increment: 10,
      page_increment: 60,
      page_size: 0
    });

    freqButton = new Gtk.SpinButton({
      adjustment: adjustment,
      value: this.existingSetting && this.existingSetting.frequency ? this.existingSetting.frequency : 60,
    });
    grid.attach(freqButton, 1, 1, 1, 1);
    freqButton.connect('changed', () => {
      this.createSetting();
      this.saveCallback();
    });

    // HTTP method label
    const methodLabel = new Gtk.Label({
      label: 'HTTP method:',
      halign: Gtk.Align.END,
    });
    grid.attach(methodLabel, 0, 2, 1, 1);

    // GET toggle
    getToggle = Gtk.ToggleButton.new_with_label('GET');
    getToggle.connect('toggled', () => {
      this.createSetting();
      this.saveCallback();
    });
    // getToggle.set_active(this.serverSetting ? this.serverSetting.is_get : false);
    getToggle.set_active(this.existingSetting && this.existingSetting.is_get ? this.existingSetting.is_get === 'true' : false);

    // HEAD toggle
    const headToggle = Gtk.ToggleButton.new_with_label('HEAD');
    headToggle.connect('toggled', () => {
      this.createSetting();
      this.saveCallback();
    });
    headToggle.set_active(this.existingSetting && this.existingSetting.is_get ? this.existingSetting.is_get === 'false' : true);

    // add them to the same group
    getToggle.set_group(headToggle);

    grid.attach(getToggle, 1, 2, 1, 1);
    grid.attach(headToggle, 2, 2, 1, 1);

    // remove server button
    const removeButton = Gtk.Button.new_with_label('Remove Server');
    removeButton.connect("clicked", () => { this.removeCallback(this); });
    grid.attach(removeButton, 0, 3, 3, 1);
  }

  /**
   * Get the root widget.
   * 
   * @returns 'Gtk.Grid`
   */
  getGrid() {
    return grid;
  }

  /**
   * Get the settings specified in this panel's controls.
   * 
   * @returns `ServerSetting`
   */
  getSetting() {
    return setting;
  }

  createSetting() {
    setting = new serverSetting.ServerSetting(
      urlEntry.text,
      freqButton.value,
      getToggle.active
    );
  }

  guid() {
    const buf = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charlen = chars.length;
    for (let i = 0; i < 32; i++) {
      buf[i] = chars.charAt(Math.floor(Math.random() * charlen));
    }
    return buf.join('');
  }

  getId() {
    return id;
  }
}
