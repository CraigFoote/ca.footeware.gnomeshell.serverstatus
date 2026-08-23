'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {HeaderGroup} from './headerGroup.js';

/**
 * A dialog with controls describing existing, and allowing creation of, request headers.
 */
export const HeadersDialog = GObject.registerClass(
    {
        GTypeName: 'HeadersDialog',
    },
    class HeadersDialog extends Adw.Dialog {
        /**
         * Constructor.
         *
         * @param {string} dialogTitle
         * @param {[Header]} headers
         */
        constructor(dialogTitle, headers) {
            super();
            this.set_size_request(500, 400);

            this.#buildUI(dialogTitle);

            this.headers = headers ? headers : [];
            for (const header of this.headers) {
                const headerGroup = new HeaderGroup(header, this.contentBox, () => this.#updateSaveButtonEnablement());
                this.contentBox.prepend(headerGroup);
            }
        }

        /**
         * Create this dialog.
         *
         * @param {string} dialogTitle
         */
        #buildUI(dialogTitle) {
            const toolbarView = new Adw.ToolbarView();
            this.set_child(toolbarView);

            const headerBar = this.#getDialogHeaderBar(dialogTitle);
            toolbarView.add_top_bar(headerBar);

            const addButton = this.#getAddButton();
            headerBar.pack_start(addButton);

            const saveButton = this.#getSaveButton();
            headerBar.pack_end(saveButton);

            const scroller = new Gtk.ScrolledWindow();
            this.contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10,
                margin_start: 10,
                margin_end: 10,
                spacing: 10,
            });
            scroller.set_child(this.contentBox);

            toolbarView.set_content(scroller);
        }

        /**
         * Get the dialog header bar.
         *
         * @param {string} dialogTitle
         * @returns {Adw.HeaderBar}
         */
        #getDialogHeaderBar(dialogTitle) {
            const headerBar = new Adw.HeaderBar(); // has close button
            let title;
            if (dialogTitle && dialogTitle.trim().length > 0)
                title = dialogTitle.trim();
            else
                title = 'Unnamed Server';
            const titleLabel = new Gtk.Label({
                label: title,
            });
            headerBar.set_title_widget(titleLabel);
            return headerBar;
        }

        /**
         * Get the Add button.
         *
         * @returns {Gtk.Button}
         */
        #getAddButton() {
            this.addButton = new Gtk.Button();
            this.addButton.add_css_class('suggested-action');
            this.addButton.set_tooltip_text('Add a Request Header for this Server');
            this.addHandlerId = this.addButton.connect('clicked', () => {
                const headerGroup = new HeaderGroup(null, this.contentBox, () => this.#updateSaveButtonEnablement());
                this.contentBox.prepend(headerGroup);
                this.#updateSaveButtonEnablement();
                headerGroup.grab_focus();
            });
            const addWrapperBox = new Gtk.Box({
                spacing: 2,
            });
            const addIcon = new Gtk.Image({
                icon_name: 'list-add-symbolic',
            });
            addWrapperBox.append(addIcon);
            addWrapperBox.append(new Gtk.Label({
                label: 'Add',
            }));
            this.addButton.set_child(addWrapperBox);
            return this.addButton;
        }

        /**
         * Get the Save button.
         *
         * @returns {Gtk.Button}
         */
        #getSaveButton() {
            this.saveButton = new Gtk.Button();
            this.saveButton.add_css_class('suggested-action');
            this.saveButton.set_tooltip_text('Save the Headers');
            this.saveButton.set_sensitive(false);
            this.saveHandlerId = this.saveButton.connect('clicked', () => {
                this.#saveHeaders();
                this.saveButton.set_sensitive(false);
            });
            const saveWrapperBox = new Gtk.Box({
                spacing: 2,
            });
            const saveIcon = new Gtk.Image({
                icon_name: 'document-save-symbolic',
            });
            saveWrapperBox.append(saveIcon);
            saveWrapperBox.append(new Gtk.Label({
                label: 'Save',
            }));
            this.saveButton.set_child(saveWrapperBox);
            return this.saveButton;
        }

        /**
         * Update the dialog's save button enablement based on input state.
         */
        #updateSaveButtonEnablement() {
            // emptied?
            if (!this.contentBox.get_first_child()) {
                this.saveButton.set_sensitive(true);
            } else {
                let allValidInputs = true;
                let headerGroup = this.contentBox.get_first_child();
                while (headerGroup) {
                    const name = headerGroup.get_row(0).text.trim();
                    const value = headerGroup.get_row(1).text.trim();
                    if (name.length === 0 || value.length === 0) {
                        allValidInputs = false;
                        break;
                    }
                    headerGroup = headerGroup.get_next_sibling();
                }
                this.saveButton.set_sensitive(allValidInputs);
            }
        }

        /**
         * Saved the entered date as a new {Header} array.
         */
        #saveHeaders() {
            const temp = [];
            let preferencesGroup = this.contentBox.get_first_child();
            while (preferencesGroup) {
                temp.push(preferencesGroup.getHeader());
                preferencesGroup = preferencesGroup.get_next_sibling();
            }
            this.headers.length = 0; // clear array and repopulate
            this.headers = temp.reverse(); // we 'prepended' the groups
        }

        /**
         * Get the request headers.
         *
         * @returns {[Header]}
         */
        getHeaders() {
            return this.headers;
        }

        /**
         * Dispose of resources and disconnect listeners.
         */
        destroy() {
            if (this.addButton && this.addHandlerId) {
                this.addButton.disconnect(this.addHandlerId);
                this.addHandlerId = null;
                this.addButton = null;
            }
            if (this.saveButton && this.saveHandlerId) {
                this.saveButton.disconnect(this.saveHandlerId);
                this.saveHandlerId = null;
                this.saveButton = null;
            }

            let headerGroup = this.contentBox.get_first_child();
            while (headerGroup) {
                headerGroup.destroy();
                headerGroup = headerGroup.get_next_sibling();
            }

            this.contentBox = null;
            this.headers = null;
        }
    });
