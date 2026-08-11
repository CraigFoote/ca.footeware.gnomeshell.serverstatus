'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {Header} from './header.js';

export const HeadersDialog = GObject.registerClass(
    {
        GTypeName: 'HeadersDialog',
    },
    class HeadersDialog extends Adw.Dialog {
        constructor(dialogTitle, headers) {
            super();
            super.set_size_request(500, 400);

            this.#buildUI(dialogTitle);

            this.headers = headers ? headers : [];
            for (const header of this.headers) {
                const headerGroup = this.#addRequestHeader(header);
                this.contentBox.prepend(headerGroup);
            }
        }

        #buildUI(dialogTitle) {
            const toolbarView = new Adw.ToolbarView();
            super.set_child(toolbarView);

            const headerBar = this.#getHeaderBar(dialogTitle);
            toolbarView.add_top_bar(headerBar);

            const addButton = this.#getAddButton();
            headerBar.pack_start(addButton);

            const saveButton = this.#getSaveButton();
            headerBar.pack_end(saveButton);

            const scroller = new Gtk.ScrolledWindow();

            const clamp = new Adw.Clamp();
            clamp.set_maximum_size(450);
            clamp.set_tightening_threshold(400);
            scroller.set_child(clamp);

            this.contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10,
                margin_start: 10,
                margin_end: 10,
                spacing: 10,
            });
            clamp.set_child(this.contentBox);

            toolbarView.set_content(scroller);
        }

        #getHeaderBar(dialogTitle) {
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

        #getAddButton() {
            this.addButton = new Gtk.Button();
            this.addButton.add_css_class('suggested-action');
            this.addButton.set_tooltip_text('Add a Request Header for this Server');
            this.addHandlerId = this.addButton.connect('clicked', () => {
                const headerGroup = this.#addRequestHeader(null);
                this.contentBox.prepend(headerGroup);
                this.#updateSaveButtonEnablement();
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

        #addRequestHeader(header) {
            const preferencesGroup = new Adw.PreferencesGroup({
                title: 'Request Header',
            });

            this.deleteButton = Gtk.Button.new_from_icon_name(
                'edit-delete-symbolic'
            );
            this.deleteButton.set_css_classes(['destructive-action']);
            this.deleteButton.set_valign(Gtk.Align.CENTER);
            this.deleteHandlerId = this.deleteButton.connect('clicked', () => {
                this.contentBox.remove(preferencesGroup);
                this.#updateSaveButtonEnablement();
            });
            this.deleteButton.set_tooltip_text('Delete this Header');
            preferencesGroup.set_header_suffix(this.deleteButton);

            this.nameRow = new Adw.EntryRow({
                title: 'Name',
                text: header?.name ?? '',
                show_apply_button: false,
            });
            this.nameHandlerId = this.nameRow.connect('changed', () => {
                this.#updateSaveButtonEnablement();
            });
            preferencesGroup.add(this.nameRow);

            this.valueRow = new Adw.EntryRow({
                title: 'Value',
                text: header?.value ?? '',
                show_apply_button: false,
            });
            this.valueHandlerId = this.valueRow.connect('changed', () => {
                this.#updateSaveButtonEnablement();
            });
            preferencesGroup.add(this.valueRow);

            super.set_focus(this.nameRow);

            return preferencesGroup;
        }

        #updateSaveButtonEnablement() {
            // empty?
            if (!this.contentBox.get_first_child()) {
                this.saveButton.set_sensitive(true);
            } else {
                let allValidInputs = true;
                let preferencesGroup = this.contentBox.get_first_child();
                while (preferencesGroup) {
                    const name = preferencesGroup.get_row(0).text.trim();
                    const value = preferencesGroup.get_row(1).text.trim();
                    if (name.length === 0 || value.length === 0) {
                        allValidInputs = false;
                        break;
                    }
                    preferencesGroup = preferencesGroup.get_next_sibling();
                }
                this.saveButton.set_sensitive(allValidInputs);
            }
        }

        #saveHeaders() {
            this.headers.length = 0; // clear array and repopulate
            let preferencesGroup = this.contentBox.get_first_child();
            while (preferencesGroup) {
                const name = preferencesGroup.get_row(0).text.trim();
                const value = preferencesGroup.get_row(1).text.trim();
                const header = new Header(name, value);
                this.headers.push(header);
                preferencesGroup = preferencesGroup.get_next_sibling();
            }
        }

        getHeaders() {
            return this.headers;
        }

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
            if (this.deleteButton && this.deleteHandlerId) {
                this.deleteButton.disconnect(this.deleteHandlerId);
                this.deleteHandlerId = null;
                this.deleteButton = null;
            }
            if (this.nameRow && this.nameHandlerId) {
                this.nameRow.disconnect(this.nameHandlerId);
                this.nameHandlerId = null;
                this.nameRow = null;
            }
            if (this.valueRow && this.valueHandlerId) {
                this.valueRow.disconnect(this.valueHandlerId);
                this.valueHandlerId = null;
                this.valueRow = null;
            }
            this.contentBox = null;
            this.headers = null;
        }
    });
