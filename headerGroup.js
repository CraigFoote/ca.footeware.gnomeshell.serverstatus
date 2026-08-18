'use strict';

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {Header} from './header.js';

/**
 * A new group is displayed when _Add_ is clicked in the headers dialog.
 * It displays controls for the settings of a header, i.e. name and value strings.
 */
export const HeaderGroup = GObject.registerClass(
    {
        GTypeName: 'HeaderGroup',
    },
    class HeaderGroup extends Adw.PreferencesGroup {
        /**
         * Constructor.
         *
         * @param {Header} header will be null for new headers in which case the
         *          fields remain empty and the name field is focused.
         * @param {Gtk.Box} parent used to delete this
         * @param {Function} updateCallback called when the delete button is clicked or the name/value fields' values get changed
         */
        constructor(header, parent, updateCallback) {
            super();
            this.set_title('Request Header');

            this.deleteButton = Gtk.Button.new_from_icon_name(
                'edit-delete-symbolic'
            );
            this.deleteButton.set_css_classes(['destructive-action']);
            this.deleteButton.set_valign(Gtk.Align.CENTER);
            this.deleteHandlerId = this.deleteButton.connect('clicked', () => {
                parent.remove(this);
                updateCallback();
                this.destroy();
            });
            this.deleteButton.set_tooltip_text('Delete this Header');
            this.set_header_suffix(this.deleteButton);

            this.nameRow = new Adw.EntryRow({
                title: 'Name',
                text: header?.name ?? '',
                show_apply_button: false,
            });
            this.nameHandlerId = this.nameRow.connect('changed', () => {
                updateCallback();
            });
            this.add(this.nameRow);

            this.valueRow = new Adw.EntryRow({
                title: 'Value',
                text: header?.value ?? '',
                show_apply_button: false,
            });
            this.valueHandlerId = this.valueRow.connect('changed', () => {
                updateCallback();
            });
            this.add(this.valueRow);
        }

        /**
         * Get the `Header` with the name and value properties.
         *
         * @returns {Header}
         */
        getHeader() {
            return new Header(this.nameRow.text.trim(), this.valueRow.text.trim());
        }

        /**
         * Dispose of resources and disconnect listeners.
         */
        destroy() {
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
