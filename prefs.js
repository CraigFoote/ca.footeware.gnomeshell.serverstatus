'use strict';

// const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
// const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const serverSetting = Me.imports.serverSetting;
// const serverPanel = Me.imports.serverPanel;
const settingsEditor = Me.imports.settingsEditor;
const prefSettings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');
// const serverPanels = [];
// let serversBox;
let savedSettings;

/**
 * Used for any one-time setup.
 */
var init = function () {
  // css for all widgets
  readCss();

  // get preferences from gsettings
  savedSettings = getPreferences();
}

/**
 * Called when the preferences window is first created to build and return a Gtk widget.
 */
var buildPrefsWidget = function () {
  const editor = new settingsEditor.SettingsEditor(savedSettings);
  editor.create();
  return editor.getWidget();
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

