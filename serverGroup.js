'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ServerSetting} from './serverSetting.js';
import {HeadersDialog} from './headersDialog.js';

/**
 * A new group is displayed when _Add_ is clicked in the preferences dialog.
 * It displays controls for the settings of a server.
 */
export class ServerGroup {
    /**
     * Constructor.
     *
     * @param {ServerStatusPreferences} preferences
     * @param {ServerSetting} settings will be null for new configs in which case the fields remain empty,
     *          expander is automatically opened and name field focused.
     */
    constructor(preferences, settings) {
        this.settings = settings;
        this.preferences = preferences;

        this.id = this.#createUID();
        this.serverSettingGroup = new Adw.PreferencesGroup();
        this.visible = this.settings?.visible ?? true;

        const expanderRow = this.#getExpanderRow();
        this.serverSettingGroup.add(expanderRow);

        if (this.settings === null) {
            this.headers = [];
            this.expanderRow.set_expanded(true);
            this.nameRow.grab_focus();
        } else {
            this.headers = this.settings.headers;
        }
        this.#createServerSettings();
    }

    /**
     * Create a unique ID for this group.
     *
     * @returns {string}
     */
    #createUID() {
        const buffer = [];
        const chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charlen = chars.length;
        for (let i = 0; i < 32; i++)
            buffer[i] = chars.charAt(Math.floor(Math.random() * charlen));

        return buffer.join('');
    }

    /**
     * Create the expander row with all the controls for this server group.
     *
     * @returns {Adw.ExpanderRow}
     */
    #getExpanderRow() {
        this.expanderRow = new Adw.ExpanderRow();
        // disable pango as it fails on & in url query strings
        this.expanderRow.set_use_markup(false);

        // title
        this.expanderRow.set_title(this.settings?.name ?? '');
        // subtitle
        this.expanderRow.set_subtitle(this.#initSubtitle());

        // handle icon for drag & drop as prefix
        this.expanderRow.add_prefix(new Gtk.Image({
            icon_name: 'list-drag-handle-symbolic',
        }));

        // suffix: indicator icons and buttons
        const suffixBox = this.#getSuffixBox();
        this.expanderRow.add_suffix(suffixBox);

        const nameRow = this.#getNameRow();
        this.expanderRow.add_row(nameRow);

        const urlRow = this.#getUrlRow();
        this.expanderRow.add_row(urlRow);

        const frequencyRow = this.#getFrequencyRow();
        this.expanderRow.add_row(frequencyRow);

        const timeoutRow = this.#getTimeoutRow();
        this.expanderRow.add_row(timeoutRow);

        const verbRow = this.#getVerbRow();
        this.expanderRow.add_row(verbRow);

        const ignoreTLSErrorsRow = this.#getIgnoreTLSErrorsRow();
        this.expanderRow.add_row(ignoreTLSErrorsRow);

        const ignoreRedirectsRow = this.#getIgnoreRedirectsRow();
        this.expanderRow.add_row(ignoreRedirectsRow);

        const useNotificationsRow = this.#getUseNotificationsRow();
        this.expanderRow.add_row(useNotificationsRow);

        const headersRow = this.#getHeadersRow();
        this.expanderRow.add_row(headersRow);

        return this.expanderRow;
    }

    #getSuffixBox() {
        const suffixBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 4,
        });

        // assemble and add indicators
        suffixBox.append(this.#getIndicatorsBox());

        // assemble and add buttons
        suffixBox.append(this.#getExpanderButtonsBox());

        return suffixBox;
    }

    /**
     * Assemble the indicators in a suffix box.
     *
     * @returns {Gtk.Box}
     */
    #getIndicatorsBox() {
        const indicatorsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 2,
        });

        this.ignoreTLSErrorsImage = Gtk.Image.new_from_file(`${this.preferences.path}/assets/warning-outline-symbolic.svg`);
        this.ignoreTLSErrorsImage.set_tooltip_text('Ignore TLS certificate errors');

        this.ignoreRedirectsImage = Gtk.Image.new_from_file(`${this.preferences.path}/assets/stop-sign-outline-symbolic.svg`);
        this.ignoreRedirectsImage.set_tooltip_text('Do not follow redirects');

        this.notifiesImage = Gtk.Image.new_from_file(`${this.preferences.path}/assets/bell-outline-symbolic.svg`);
        this.notifiesImage.set_tooltip_text('Notify when down');

        this.headersImage = Gtk.Image.new_from_file(`${this.preferences.path}/assets/h-symbolic.svg`);
        this.headersImage.set_tooltip_text('Headers are set');

        indicatorsBox.append(this.ignoreTLSErrorsImage);
        indicatorsBox.append(this.ignoreRedirectsImage);
        indicatorsBox.append(this.notifiesImage);
        indicatorsBox.append(this.headersImage);

        this.#updateIndicators();

        return indicatorsBox;
    }

    /**
     * Update the visibility of icons indicating 'Ignore TLS errors', 'Do not follow redirects' and 'Notify when down'.
     */
    #updateIndicators() {
        this.ignoreTLSErrorsImage.set_visible(this.settings?.ignoreTLSErrors ?? false);
        this.ignoreRedirectsImage.set_visible(this.settings?.ignoreRedirects ?? false);
        this.notifiesImage.set_visible(this.settings?.notifies ?? false);
        const hasHeaders = this.settings && this.settings.headers && this.settings.headers.length > 0;
        this.headersImage.set_visible(hasHeaders);
    }

    /**
     * Gets the box containing delete and visibility buttons.
     *
     * @returns {Gtk.Box}
     */
    #getExpanderButtonsBox() {
        const buttonsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 2,
        });

        // visibility button
        const visibilityIcon = this.visible ? 'view-reveal-symbolic' : 'view-conceal-symbolic';
        this.visibilityButton = Gtk.Button.new_from_icon_name(visibilityIcon);
        this.visibilityButton.set_valign(Gtk.Align.CENTER);
        this.visibilityHandlerId = this.visibilityButton.connect('clicked', () => {
            this.visible = !this.visible;
            const newIcon = this.visible ? 'view-reveal-symbolic' : 'view-conceal-symbolic';
            this.visibilityButton.set_icon_name(newIcon);
            this.update();
        });
        this.visibilityButton.set_tooltip_text('Show in menu');

        // delete button
        this.deleteButton = Gtk.Button.new_from_icon_name(
            'edit-delete-symbolic'
        );
        this.deleteButton.set_css_classes(['destructive-action']);
        this.deleteButton.set_valign(Gtk.Align.CENTER);
        this.deleteHandlerId = this.deleteButton.connect('clicked', () => {
            this.preferences.doDelete(this);
        });
        this.deleteButton.set_tooltip_text('Delete this server');

        buttonsBox.append(this.visibilityButton);
        buttonsBox.append(this.deleteButton);

        return buttonsBox;
    }

    #getNameRow() {
        this.nameRow = new Adw.EntryRow({
            title: 'Name',
            text: this.settings?.name ?? '',
            show_apply_button: true,
        });
        this.nameHandlerId = this.nameRow.connect('apply', () => {
            this.update();
        });
        return this.nameRow;
    }

    #getUrlRow() {
        this.urlRow = new Adw.EntryRow({
            title: 'URL',
            text: this.settings?.url ?? '',
            show_apply_button: true,
        });
        this.urlHandlerId = this.urlRow.connect('apply', () => {
            this.update();
        });
        return this.urlRow;
    }

    #getFrequencyRow() {
        this.frequencyRow = Adw.SpinRow.new_with_range(10, 300, 10);
        this.frequencyRow.set_value(this.settings?.frequency ?? 120);
        this.frequencyRow.set_title('Frequency (secs.)');
        this.frequencyHandlerId = this.frequencyRow.connect('notify::value', () => {
            this.update();
        });
        return this.frequencyRow;
    }

    #getTimeoutRow() {
        this.timeoutRow = Adw.SpinRow.new_with_range(1, 300, 1);
        this.timeoutRow.set_value(this.settings?.timeout ?? 10);
        this.timeoutRow.set_title('Timeout (secs.)');
        this.timeoutHandlerId = this.timeoutRow.connect('notify::value', () => {
            this.update();
        });
        return this.timeoutRow;
    }

    #getVerbRow() {
        this.verbRow = new Adw.ComboRow({
            title: 'Request action verb',
        });
        const verbModel = Gtk.StringList.new(['HEAD', 'GET']); // TODO ping
        this.verbRow.set_model(verbModel);
        // init
        const verb = this.settings?.verb ?? null;
        if (verb) {
            const numItems = verbModel.get_n_items();
            for (let i = 0; i < numItems; i++) {
                if (verbModel.get_item(i) === verb) {
                    this.verbRow.set_selected(i);
                    break;
                }
            }
        }
        this.verbHandlerId = this.verbRow.connect('notify::selected', () => {
            this.update();
        });
        return this.verbRow;
    }

    #getIgnoreTLSErrorsRow() {
        this.ignoreTLSErrorsRow = new Adw.SwitchRow({
            title: 'Ignore TLS certificate errors',
            subtitle: 'self-signed, etc.',
        });
        const ignoreTLSErrors = this.settings?.ignoreTLSErrors ?? false;
        this.ignoreTLSErrorsRow.set_active(ignoreTLSErrors);
        this.ignoreTLSErrorsHandlerId = this.ignoreTLSErrorsRow.connect('notify::active', () => {
            this.update();
        });
        return this.ignoreTLSErrorsRow;
    }

    #getIgnoreRedirectsRow() {
        this.ignoreRedirectsRow = new Adw.SwitchRow({
            title: 'Do not follow redirects',
            subtitle: 'Treat 3xx status codes as success.',
        });
        const ignoreRedirects = this.settings?.ignoreRedirects ?? false;
        this.ignoreRedirectsRow.set_active(ignoreRedirects);
        this.ignoreRedirectsHandlerId = this.ignoreRedirectsRow.connect('notify::active', () => {
            this.update();
        });
        return this.ignoreRedirectsRow;
    }

    #getUseNotificationsRow() {
        this.useNotificationsRow = new Adw.SwitchRow({
            title: 'Notify when down',
            subtitle: 'Displays a desktop notification.',
        });
        const notifies = this.settings?.notifies ?? false;
        this.useNotificationsRow.set_active(notifies);
        this.useNotificationsHandlerId = this.useNotificationsRow.connect('notify::active', () => {
            this.update();
        });
        return this.useNotificationsRow;
    }

    #getHeadersRow() {
        const headersRow = new Adw.ButtonRow({
            title: 'Request Headers',
        });
        headersRow.set_end_icon_name('go-next');
        headersRow.connect('activated', () => {
            this.#openHeadersDialog();
        });
        return headersRow;
    }

    #openHeadersDialog() {
        const title = this.settings?.name ?? 'Unnamed Server';
        const headers = this.settings?.headers ?? [];
        this.headersDialog = new HeadersDialog(title, headers);
        this.headersDialogHandlerId = this.headersDialog.connect('closed', () => {
            const newHeaders = this.headersDialog.getHeaders();
            this.headers = newHeaders;
            this.update();
            this.headersDialog.destroy();
            this.headersDialog = null;
            this.preferences.doSave();
        });
        this.headersDialog.present(this.preferences.window);
    }

    /**
     * Set the initial subtitle based on provided settings.
     *
     * @returns {string}
     */
    #initSubtitle() {
        if (!this.settings)
            return '';

        return `${this.settings.verb} ${this.settings.url} @ ${this.settings.frequency}s with ${this.settings.timeout}s timeout`;
    }

    /**
     * Get the title based on user input.
     *
     * @returns {string}
     */
    getTitle() {
        return this.nameRow.text;
    }

    /**
     * Get the subtitle based on user input.
     *
     * @returns {string}
     */
    getSubtitle() {
        const httpMethod = this.verbRow.selected_item.get_string();
        const url = this.urlRow.text;
        const freq = this.frequencyRow.text;
        const timeout = this.timeoutRow.text;

        return `${httpMethod} ${url} @ ${freq}s with ${timeout}s timeout`;
    }

    /**
     * Renew #serverSettings, save them and update UI.
     */
    update() {
        this.#createServerSettings();
        this.preferences.doSave();
        this.updateExpander();
    }

    /**
     * Update the expander title & subtitle.
     */
    updateExpander() {
        this.expanderRow.set_title(this.getTitle());
        this.expanderRow.set_subtitle(this.getSubtitle());
        this.#updateIndicators(this.settings);
    }

    /**
     * Return this group's server settings, creating it if null.
     *
     * @returns {ServerSetting}
     */
    getSettings() {
        if (!this.settings)
            this.#createServerSettings();

        return this.settings;
    }

    /**
     * Return this preference group.
     *
     * @returns {Adw.PreferencesGroup}
     */
    getGroup() {
        return this.serverSettingGroup;
    }

    /**
     * Returns the _Name_ `EntryRow`.
     *
     * @returns {Adw.EntryRow}
     */
    getNameInput() {
        return this.nameRow;
    }

    /**
     * Create a `ServerSetting` based on control values.
     */
    #createServerSettings() {
        const index = this.verbRow.selected;
        const verbText = index >= 0 ? this.verbRow.get_model().get_string(index) : '';
        this.settings = new ServerSetting(
            this.nameRow.text,
            this.urlRow.text,
            Number(this.frequencyRow.text),
            Number(this.timeoutRow.text),
            verbText,
            this.useNotificationsRow.active,
            this.visible,
            this.ignoreTLSErrorsRow.active,
            this.ignoreRedirectsRow.active,
            this.headers
        );
    }

    /**
     * Disconnect listeners and dispose of boxed lists, icons, and instance variables.
     */
    destroy() {
        this.#unplug(this.visibilityButton, this.visibilityHandlerId);
        this.#unplug(this.deleteButton, this.deleteHandlerId);
        this.#unplug(this.nameRow, this.nameHandlerId);
        this.#unplug(this.urlRow, this.urlHandlerId);
        this.#unplug(this.frequencyRow, this.frequencyHandlerId);
        this.#unplug(this.timeoutRow, this.timeoutHandlerId);
        this.#unplug(this.verbRow, this.verbHandlerId);
        this.#unplug(this.ignoreTLSErrorsRow, this.ignoreTLSErrorsHandlerId);
        this.#unplug(this.ignoreRedirectsRow, this.ignoreRedirectsHandlerId);
        this.#unplug(this.useNotificationsRow, this.useNotificationsHandlerId);
        this.#unplug(this.headersDialog, this.headersDialogHandlerId);

        this.ignoreTLSErrorsImage = null;
        this.ignoreRedirectsImage = null;
        this.notifiesImage = null;
        this.headersImage = null;

        this.id = null;
        this.preferences = null;
        this.serverSettingGroup = null;
        this.expanderRow = null;
    }

    /**
     * Disconnect the handlerId from the control and set both to null.
     *
     * @param {Adw.*} control
     * @param {string} handlerId
     */
    #unplug(control, handlerId) {
        if (control && handlerId) {
            control.disconnect(handlerId);
            handlerId = null;
            control = null;
        }
    }
}
