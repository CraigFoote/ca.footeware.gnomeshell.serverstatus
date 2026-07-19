'use strict';

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export class DragDropSupport {
    /**
     * Constructor.
     *
     * @param {Gtk.ListBox} gtkListBox
     */
    constructor(gtkListBox) {
        this.gtkListBox = gtkListBox;
        this.dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow, Gdk.DragAction.MOVE);
        gtkListBox.add_controller(this.dropTarget);
    }

    /**
     * Add drag and drop support.
     *
     * @param {Gtk.ListBoxRow} gtkListBoxRow
     * @param {Adw.PreferencesRow} titleRow
     * @param {Function} afterDrop
     */
    add(gtkListBoxRow, titleRow, afterDrop) {
        let dragX;
        let dragY;

        const dropController = new Gtk.DropControllerMotion();

        const dragSource = new Gtk.DragSource({
            actions: Gdk.DragAction.MOVE,
        });

        gtkListBoxRow.add_controller(dragSource);
        gtkListBoxRow.add_controller(dropController);

        // prepare
        this.#createPrepareListener(gtkListBoxRow, dragSource, dragX, dragY);

        // begin
        this.#createBeginListener(gtkListBoxRow, titleRow, dragSource, dragX, dragY);

        // enter
        dropController.connect('enter', () => {
            this.gtkListBox.drag_highlight_row(gtkListBoxRow);
        });

        // leave
        dropController.connect('leave', () => {
            this.gtkListBox.drag_unhighlight_row();
        });

        // drop
        this.#createDropListener(afterDrop);
    }

    /**
     *
     * @param {Gtk.ListBoxRow} gtkListBoxRow
     * @param {Gtk.DragSource} dragSource
     * @param {number} dragX
     * @param {number} dragY
     */
    // eslint-disable-next-line no-unused-vars
    #createPrepareListener(gtkListBoxRow, dragSource, dragX, dragY) {
        dragSource.connect('prepare', (_source, x, y) => {
            dragX = x;
            dragY = y;

            const value = new GObject.Value();
            value.init(Gtk.ListBoxRow);
            value.set_object(gtkListBoxRow);

            return Gdk.ContentProvider.new_for_value(value);
        });
    }

    #createBeginListener(gtkListBoxRow, titleRow, dragSource, dragX, dragY) {
        dragSource.connect('drag-begin', (_source, drag) => {
            const dragWidget = new Gtk.ListBox();
            dragWidget.set_size_request(gtkListBoxRow.get_width(), gtkListBoxRow.get_height());
            dragWidget.add_css_class('boxed-list');

            // add title
            const dragRow = new Adw.ActionRow();
            dragRow.set_title(titleRow.get_title());

            // add icon
            dragRow.add_prefix(
                new Gtk.Image({
                    icon_name: 'list-drag-handle-symbolic',
                })
            );

            dragWidget.append(dragRow);
            dragWidget.drag_highlight_row(dragRow);

            const icon = Gtk.DragIcon.get_for_drag(drag);
            icon.child = dragWidget;

            drag.set_hotspot(dragX, dragY);
        });
    }

    #createDropListener(callback) {
        this.dropTarget.connect('drop', (_drop, value, _x, y) => {
            const targetRow = this.gtkListBox.get_row_at_y(y);

            if (!value || !targetRow || value === targetRow)
                return false;

            const targetIndex = targetRow.get_index();

            this.gtkListBox.remove(value);
            this.gtkListBox.insert(value, targetIndex);
            targetRow.set_state_flags(Gtk.StateFlags.NORMAL, true);

            callback();

            // If everything is successful, return true to accept the drop
            return true;
        });
    }
}
