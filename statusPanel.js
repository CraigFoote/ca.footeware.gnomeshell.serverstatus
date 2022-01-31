'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const clearInterval = GLib.source_remove;
const serverSetting = Me.imports.serverSetting;
const Status = Me.imports.status;

let intervalID;
let updateTaskbarCallback;

var StatusPanel = GObject.registerClass({
  GTypeName: 'StatusPanel',
}, class StatusPanel extends St.BoxLayout {
  _init({ server_setting, update_icon_callback }) {
    super._init({
      style_class: 'main-box',
    });
    this.setting = server_setting;
    this.updateTaskbarCallback = update_icon_callback;

    this.session = new Soup.Session({
      timeout: 10, //seconds
    });

    const path = Me.dir.get_path();
    this.serverIcon = Gio.icon_new_for_string(path + '/assets/server.svg');
    this.serverUpIcon = Gio.icon_new_for_string(path + '/assets/server-up.svg');
    this.serverDownIcon = Gio.icon_new_for_string(path + '/assets/server-down.svg');
    this.serverBadIcon = Gio.icon_new_for_string(path + '/assets/server-bad.svg');

    this.panelIcon = new St.Icon({
      gicon: this.serverIcon,
      style_class: 'icon',
    });
    this.add_child(this.panelIcon);

    const settingsLabel = new St.Label({
      style_class: 'label',
    });
    settingsLabel.set_text(
      (this.setting.is_get == 'true' ? 'GET' : 'HEAD') + ' : ' + this.setting.url + ' @ ' + this.setting.frequency + 's'
    );
    this.add_child(settingsLabel);

    intervalID = this.setInterval(() => this.update(this.setting.url), this.setting.frequency * 1000);
  }

  run_dispose() {
    clearInterval(intervalID);
    this.serverIcon = null;
    this.serverUpIcon = null;
    this.serverDownIcon = null;
    this.serverBadIcon = null;
    super.run_dispose;
  }

  destroy(){
    this.run_dispose();
    super.destroy();
  }

  getStatus() {
    switch (this.panelIcon.gicon) {
      case this.serverUpIcon:
        return Status.Status.Up;
        break;
      case this.serverDownIcon:
        return Status.Status.Down;
        break;
      case this.serverBadIcon:
        return Status.Status.Bad;
        break;
      default:
        return Status.Status.Init;
    }
  }

  update(url) {
    const httpMethod = this.setting.is_get == 'true' ? 'GET' : 'HEAD';
    this.get(httpMethod, url, this.panelIcon);
    // not sure what this does
    return GLib.SOURCE_CONTINUE;
  }

  get(httpMethod, url, icon) {
    try {
      let request = Soup.Message.new(httpMethod, url);
      this.session.queue_message(request, (session, message) => {
        const gicon = (message.status_code == 200) ? this.serverUpIcon : this.serverDownIcon;
        log('before null check, icon is ' + icon);
        if (icon != null) {
          log('after null check, icon is ' + icon);
          icon.gicon = gicon;
          this.updateTaskbarCallback();
        }
      });
    } catch (e) {
      // thrown with malformed URL
      if (icon != null) {
        icon.gicon = this.serverBadIcon;
        this.updateTaskbarCallback();
      }
    } finally {
      // not sure what this does
      return GLib.SOURCE_REMOVE;
    }
  }

  setInterval(func, delay) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, func);
  }
})
