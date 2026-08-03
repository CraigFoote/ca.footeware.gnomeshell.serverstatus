'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

export const HeadersDialog = GObject.registerClass(
    {
        GTypeName: 'HeadersDialog',
    },
    class HeadersDialog extends Adw.Dialog {
        _init(settings) {
            super._init();

            super.set_size_request(400, 200);

            const toolbarView = new Adw.ToolbarView();
            super.set_child(toolbarView);

            const headerBar = new Adw.HeaderBar(); // has close button
            const title = new Gtk.Label({
                label: settings?.name,
            });
            headerBar.set_title_widget(title);
            toolbarView.add_top_bar(headerBar);

            this.addButton = new Gtk.Button();
            this.addButton.add_css_class('suggested-action');
            this.addButton.set_tooltip_text('Add a Request Header for this Server');
            this.addHandlerId = this.addButton.connect('clicked', () => {
                const header = this.#addRequestHeader();
                content.append(header);
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
            headerBar.pack_start(this.addButton);

            this.saveButton = new Gtk.Button();
            this.saveButton.add_css_class('suggested-action');
            this.saveButton.set_tooltip_text('Save the Headers');
            this.saveHandlerId = this.saveButton.connect('clicked', () => {
                // TODO
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
            headerBar.pack_end(this.saveButton);

            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
                spacing: 10,
            });
            toolbarView.set_content(content);
        }

        #addRequestHeader() {
            const preferencesGroup = new Adw.PreferencesGroup({
                title: 'Request Header',
            });

            this.deleteButton = Gtk.Button.new_from_icon_name(
                'edit-delete-symbolic'
            );
            this.deleteButton.set_css_classes(['destructive-action']);
            this.deleteButton.set_valign(Gtk.Align.CENTER);
            this.deleteHandlerId = this.deleteButton.connect('clicked', () => {
                // TODO
            });
            this.deleteButton.set_tooltip_text('Delete this Header');
            preferencesGroup.set_header_suffix(this.deleteButton);

            this.nameRow = new Adw.EntryRow({
                title: 'Name',
                show_apply_button: true,
            });
            this.nameHandlerId = this.nameRow.connect('apply', () => {
                // this.update();
            });
            preferencesGroup.add(this.nameRow);

            this.valueRow = new Adw.EntryRow({
                title: 'Value',
                show_apply_button: true,
            });
            this.valueHandlerId = this.valueRow.connect('apply', () => {
                // this.update();
            });
            preferencesGroup.add(this.valueRow);

            this.nameRow.grab_focus();

            return preferencesGroup;
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
        }
    });
