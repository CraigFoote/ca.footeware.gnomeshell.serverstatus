'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const serverSetting = Me.imports.serverSetting;
const serverPanel = Me.imports.serverPanel;
const prefSettings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');
const serverPanels = [];
let serversBox;

/**
 * Used for any one-time setup.
 */
var init = function () {
}

/**
 * Called when the preferences window is first created to build and return a Gtk widget.
 */
var buildPrefsWidget = function () {

  // get preferences from gsettings
  const savedSettings = getPreferences();

  // css for all widgets
  readCss();

  // main container
  const mainBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 20,
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
  mainBox.append(helpLabel);

  // scrolling container for all server panels
  const scroller = new Gtk.ScrolledWindow({
    min_content_width: 1000,
    min_content_height: 300,
    css_classes: ['bordered', 'lighter'],
  });
  mainBox.append(scroller);

  serversBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    vexpand: true,
    homogeneous: false,
  });
  scroller.set_child(serversBox);

  // create a panel for each entry in serverSettings
  for (let i = 0; i < savedSettings.length; i++) {
    const aSetting = savedSettings[i];
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
  mainBox.append(addButton);

  return mainBox;
}

/**
 * Read and parse preferences from GSettings.
 * 
 * @returns a list of ServerSetting objects
 */
const getPreferences = function () {
  const variant = prefSettings.get_value('server-settings');
  const saved = variant.deep_unpack();
  const serverSettings = [];
  for (let i = 0; i < saved.length; i++) {
    const rawSetting = saved[i];
    const url = rawSetting['url'];
    const frequency = rawSetting['frequency'];
    const is_get = rawSetting['is_get'];
    const setting = new serverSetting.ServerSetting(url, frequency, is_get);
    serverSettings.push(setting);
  }
  return serverSettings;
}

/**
 * Read CSS file and provide styles to all widgets specifying `css_classes` property.
 */
const readCss = function () {
  const cssProvider = new Gtk.CssProvider();
  cssProvider.load_from_path(Me.dir.get_path() + '/styles.css');
  Gtk.StyleContext.add_provider_for_display(
    Gdk.Display.get_default(),
    cssProvider,
    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
}

/**
 * Remove the received `ServerPanel` from list whose settings are 
 * saved as preferences, and remove the `Gtk.Grid` widget from display.
 * 
 * @param {ServerPanel} panel 
 */
const removePanel = function (panel) {
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
  for (let i = 0; i < serverPanels.length; i++) {
    const panel = serverPanels[i];
    const setting = panel.getSetting();
    stringify(setting);
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

/**
 * Convert non-string property values to strings.
 * 
 * @param {ServerSetting} setting 
 */
const stringify = function (setting) {
  setting.frequency = setting.frequency.toString();
  setting.is_get = setting.is_get ? 'true' : 'false';
}
