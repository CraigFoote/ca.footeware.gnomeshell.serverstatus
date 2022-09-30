'use strict';

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const prefSettings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');
const serverPanel = Me.imports.serverPanel;

var serverPanels = [];
var serversBox;

/**
 * A panel of widgets to specify the settings for servers to poll.
 * 
 * @param {ServerSetting[]} savedSettings 
 */
var SettingsEditor = class SettingsEditor {

  /**
   * Constructor.
   * 
   * @param {ServerSetting[]} savedSettings 
   */
  constructor(savedSettings) {
    this.savedSettings = savedSettings;
    /* 
    Not sure why I have to reset this array between openings 
    of prefs dialog but it retains values from previous runs.
    It had to be external to class to be used by #remove and #save.
    */
    serverPanels = [];
  }

  /**
   * Build the widgets.
   */
  create() {
    // main container
    this.mainBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 10,
      css_classes: ['padded'],
      homogeneous: false,
    });

    // help label
    const helpLabel = new Gtk.Label({
      label: `HTTP HEAD is faster than GET but not always supported.\n
If you get a red indicator, try switching to GET.\n\n
If you get a yellow indicator, there's something wrong with the URL.\n
It should be of format http[s]://host[:port][/path].`,
      halign: Gtk.Align.CENTER,
    });
    this.mainBox.append(helpLabel);

    // scrolling container for all server panels
    const scroller = new Gtk.ScrolledWindow({
      min_content_width: 700,
      min_content_height: 300,
      css_classes: ['bordered', 'lighter'],
    });
    this.mainBox.append(scroller);

    serversBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      vexpand: true,
      homogeneous: false,
    });
    scroller.set_child(serversBox);

    // create a panel for each entry in serverSettings
    for (const aSetting of this.savedSettings) {
      const newPanel = new serverPanel.ServerPanel(serversBox, removePanel, save);
      newPanel.load(aSetting);
      newPanel.create();
      serverPanels.push(newPanel);
      save();
    }

    // add new server button
    const addButton = Gtk.Button.new_with_label('Add New Server');
    addButton.connect("clicked", function () {
      const newPanel = new serverPanel.ServerPanel(serversBox, removePanel, save);
      newPanel.create();
      serverPanels.push(newPanel);
      save();
    });
    this.mainBox.append(addButton);
  }

  /**
   * Get the base widget.
   * 
   * @returns Gtk.Box
   */
  getWidget() {
    return this.mainBox;
  }
}

/**
 * Remove the received `ServerPanel` from list whose settings are 
 * saved as preferences, and remove the `Gtk.Grid` widget from display.
 * 
 * @param {ServerPanel} panel 
 */
var removePanel = function (panel) {
  for (let i = 0; i < serverPanels.length; i++) {
    let serverPanel = serverPanels[i];
    if (serverPanel.getId() === panel.getId()) {
      // remove from js array
      serverPanels.splice(i, 1);
      // remove widget
      serversBox.remove(panel.getGrid());
      break;
    }
  }
  save();
}

/**
 * Save the settings from all the server panels.
 */
var save = function () {
  const settings = [];
  for (const panel of serverPanels) {
    const setting = panel.getSetting();
    // convert non-string property values to strings
    setting.frequency = setting.frequency.toString();
    setting.is_get = setting.is_get.toString();
    settings.push(setting);
  }
  if (settings.length == 0) {
    prefSettings.reset('server-settings');
    Gio.Settings.sync();
  } else {
    prefSettings.set_value(
      'server-settings',
      new GLib.Variant(
        'aa{ss}',
        settings
      ),
    );
    Gio.Settings.sync();
  }
}