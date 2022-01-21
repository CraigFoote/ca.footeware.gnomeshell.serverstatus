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
        label: 'Enter an URL to poll:',
        halign: Gtk.Align.END,
    });
    grid.attach(urlLabel, 0, 0, 1, 1);
    
    // URL entry
    let urlEntry = new Gtk.Entry({
        width_chars: 50,
    });
    grid.attach(urlEntry, 1, 0, 3, 1);
    
    // frequency label
    let pollLabel = new Gtk.Label({
        label: 'Poll frequency (sec.):',
        halign: Gtk.Align.END,
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
    
    // HTTP method label
    let methodLabel = new Gtk.Label({
        label: 'HTTP method:',
        halign: Gtk.Align.END,
    });    
    grid.attach(methodLabel, 0, 2, 1, 1);

    // GET toggle
    let getToggle = Gtk.ToggleButton.new_with_label('GET');
    
    // HEAD toggle
    let headToggle = Gtk.ToggleButton.new_with_label('HEAD');
    headToggle.set_active(true);
    
    // add them to the same group
    getToggle.set_group(headToggle);
    //headToggle.set_group(getToggle);
    
    grid.attach(getToggle, 1, 2, 1, 1);
    grid.attach(headToggle, 2, 2, 1, 1);
    
    // help label
    let helpLabel = new Gtk.Label({
        label: 'HTTP HEAD is faster than GET but not always supported. If you get a red indicator, try switching to GET.\n\nIf you get a yellow indicator, there\'s something wrong with the URL. It should be of format [http|https]://host[:port][/path].',
        halign: Gtk.Align.CENTER,
    });    
    grid.attach(helpLabel, 0, 3, 4, 1);
    
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
    settings.bind(
        'is-get',
        getToggle,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
    
    return grid;
}

