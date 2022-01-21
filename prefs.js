'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;

// Like `extension.js` this is used for any one-time setup like translations.
function init() {
}

// This function is called when the preferences window is first created to build
// and return a Gtk widget.
function buildPrefsWidget() {

    let settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');

    let grid = new Gtk.Grid({
        hexpand: true,
        vexpand: true,
        row_homogeneous: false,
        column_homogeneous: false,
        column_spacing: 20,
        row_spacing: 20,
        margin_start: 20,
        margin_top: 20,
        margin_end: 20,
        margin_bottom: 20,
    });
    
    // URL label
    let urlLabel = new Gtk.Label({
        label: "Enter an URL to poll:",
    });
    grid.attach(urlLabel, 0, 0, 1, 1);
    
    // URL entry
    let urlEntry = new Gtk.Entry({
        width_chars: 50,
    });
    grid.attach(urlEntry, 1, 0, 2, 1);
    
    // frequency label
    let pollLabel = new Gtk.Label({
        label: "Poll frequency (sec.):",
    });    
    grid.attach(pollLabel, 0, 1, 1, 1);
    
    // frequency spinButton
    let adjustment = new Gtk.Adjustment ({
      value: 10,
      lower: 10,
      upper: 300,
      step_increment: 10,
      page_increment: 60,
      page_size: 0
    });
    let freqButton = new Gtk.SpinButton({
        adjustment: adjustment,
        value: 10,
    });
    grid.attach(freqButton, 1, 1, 1, 1);
    
    // bind to dconf gsettings
    settings.bind(
        'url',
        urlEntry,
        'text',
        Gio.SettingsBindFlags.DEFAULT
    );
    settings.bind(
        'frequency',
        freqButton,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );

    return grid;
}

