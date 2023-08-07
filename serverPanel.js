'use strict';

const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const serverSetting = Me.imports.serverSetting;

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
    this.id = this.guid();
  }

  /**
   * Set a `ServerSetting` for use in initializing controls.
   * 
   * @param {ServerSetting} savedSetting 
   */
  load(savedSetting) {
    this.savedSetting = savedSetting;
  }

  /**
   * Create the controls.
   */
  create() {
    this.grid = new Gtk.Grid({
      hexpand: true,
      vexpand: false,
      row_homogeneous: false,
      column_homogeneous: false,
      column_spacing: 5,
      row_spacing: 5,
      margin_start: 5,
      margin_top: 5,
      margin_end: 5,
      margin_bottom: 5,
      halign: Gtk.Align.CENTER,
      css_classes: ['bordered', 'padded', 'shadowed', 'lighter'],
    });

    this.parent.append(this.grid);

    // URL label
    const urlLabel = new Gtk.Label({
      label: 'Enter an URL to poll:',
      halign: Gtk.Align.CENTER,
    });
    this.grid.attach(urlLabel, 0, 0, 1, 1);

    // URL entry
    this.urlEntry = new Gtk.Entry({
      width_chars: 40,
    });
    if (this.savedSetting && this.savedSetting.url) {
      this.urlEntry.text = this.savedSetting.url;
    }
    this.grid.attach(this.urlEntry, 1, 0, 2, 1);
    this.urlEntry.connect('changed', () => {
      this.createSetting();
      this.saveCallback();
    });

    // frequency label
    const pollLabel = new Gtk.Label({
      label: 'Poll frequency (sec.):',
      halign: Gtk.Align.END,
    });
    this.grid.attach(pollLabel, 0, 1, 1, 1);

    // frequency spinButton
    const adjustment = new Gtk.Adjustment({
      value: 60,
      lower: 10,
      upper: 300,
      step_increment: 10,
      page_increment: 60,
      page_size: 0
    });

    this.freqButton = new Gtk.SpinButton({
      adjustment: adjustment,
      value: this.savedSetting && this.savedSetting.frequency ? this.savedSetting.frequency : 60,
    });
    this.grid.attach(this.freqButton, 1, 1, 2, 1);
    this.freqButton.connect('changed', () => {
      this.createSetting();
      this.saveCallback();
    });

    // HTTP method label
    const methodLabel = new Gtk.Label({
      label: 'HTTP method:',
      halign: Gtk.Align.END,
    });
    this.grid.attach(methodLabel, 0, 2, 1, 1);

    // GET toggle
    this.getToggle = Gtk.ToggleButton.new_with_label('GET');
    this.getToggle.set_active(this.savedSetting && this.savedSetting.is_get ? this.savedSetting.is_get === 'true' : false);
    this.getToggle.connect('toggled', () => {
      this.createSetting();
      this.saveCallback();
    });

    // HEAD toggle
    const headToggle = Gtk.ToggleButton.new_with_label('HEAD');
    headToggle.set_active(this.savedSetting && this.savedSetting.is_get ? this.savedSetting.is_get === 'false' : true);
    headToggle.connect('toggled', () => {
      this.createSetting();
      this.saveCallback();
    });

    // add them to the same group
    this.getToggle.set_group(headToggle);

    this.grid.attach(this.getToggle, 1, 2, 1, 1);
    this.grid.attach(headToggle, 2, 2, 1, 1);

    // remove server button
    const removeButton = Gtk.Button.new_with_label('Remove Server');
    removeButton.connect("clicked", () => { this.removeCallback(this); });
    this.grid.attach(removeButton, 0, 3, 3, 1);

    this.createSetting();
  }

  /**
   * Get the root widget.
   * 
   * @returns Gtk.Grid
   */
  getGrid() {
    return this.grid;
  }

  /**
   * Get the settings specified in this panel's controls.
   * 
   * @returns ServerSetting
   */
  getSetting() {
    return this.setting;
  }

  createSetting() {
    this.setting = new serverSetting.ServerSetting(
      this.urlEntry.text,
      this.freqButton.value,
      this.getToggle.active
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
    return this.id;
  }
}
