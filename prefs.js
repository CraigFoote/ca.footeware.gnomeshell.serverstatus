'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

// It's common practice to keep GNOME API and JS imports in separate blocks
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


// Like `extension.js` this is used for any one-time setup like translations.
function init() {
    log(`initializing ${Me.metadata.name} Preferences`);
}


// This function is called when the preferences window is first created to build
// and return a Gtk widget. As an example we'll create and return a GtkLabel.
function buildPrefsWidget() {

    this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.serverstatus');

    let grid = new Gtk.Grid();

    // At the time buildPrefsWidget() is called, the window is not yet prepared
    // so if you want to access the headerbar you need to use a small trick
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        // In GTK4 (GNOME 40), call `get_root()` instead of `get_toplevel()`
        let window = grid.get_toplevel();
        let headerBar = window.get_titlebar();
        headerBar.title = `${Me.metadata.name} Preferences`;
        
        return GLib.SOURCE_REMOVE;
    });
    
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

