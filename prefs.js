'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;

// Like `extension.js` this is used for any one-time setup like translations.
function init() {
}

// This function is called when the preferences window is first created to build
// and return a Gtk widget. As an example we'll create and return a GtkLabel.
function buildPrefsWidget() {

    this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');

    let grid = new Gtk.Grid();
    
    let label = new Gtk.Label({
        label: "   Enter an URL to poll:  ",
    });
    grid.attach(label, 0, 0, 1, 1);
    
    let textbox = new Gtk.Entry();
    grid.attach(textbox, 1, 0, 2, 1);
    
    this.settings.bind(
        'url',
        textbox,
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );

    return grid;
}
