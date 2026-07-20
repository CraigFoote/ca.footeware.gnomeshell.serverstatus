'use strict';

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

/**
 * Provide drag and drop (move/reorder) functionality to `Adw.PreferencesRow`s in a `Gtk.ListBox`.
 *
 * @see [Workbench](https://flathub.org/en/apps/re.sonny.Workbench) application's Drag & Drop example
 */
export class DragDropSupport {
    /**
     * Constructor.
     *
     * @param {Gtk.ListBox} gtkListBox the containing box of rows
     */
    constructor(gtkListBox) {
        this.gtkListBox = gtkListBox;
        this.dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow, Gdk.DragAction.MOVE);
        this.gtkListBox.add_controller(this.dropTarget);
    }

    /**
     * Add drag and drop support to the provided `Gtk.ListBoxRow`.
     *
     * @param {Gtk.ListBoxRow} gtkListBoxRow the row to be dragged
     * @param {Adw.PreferencesRow} titleRow whose title is used at runtime while dragging, must have get_title()
     * @param {Function} afterDrop callback to run after drop is complete
     */
    add(gtkListBoxRow, titleRow, afterDrop) {
        let dragX;
        let dragY;
        let prepareSignalId = null;
        let beginSignalId = null;
        let enterSignalId = null;
        let leaveSignalId = null;
        let dropSignalId = null;

        const dropController = new Gtk.DropControllerMotion();

        const dragSource = new Gtk.DragSource({
            actions: Gdk.DragAction.MOVE,
        });

        gtkListBoxRow.add_controller(dragSource);
        gtkListBoxRow.add_controller(dropController);

        // prepare
        prepareSignalId = this.#createPrepareListener(gtkListBoxRow, dragSource, dragX, dragY);

        // begin
        beginSignalId = this.#createBeginListener(gtkListBoxRow, titleRow, dragSource, dragX, dragY);

        // enter
        enterSignalId = dropController.connect('enter', () => {
            this.gtkListBox.drag_highlight_row(gtkListBoxRow);
        });

        // leave
        leaveSignalId = dropController.connect('leave', () => {
            this.gtkListBox.drag_unhighlight_row();
        });

        // drop
        dropSignalId = this.#createDropListener(afterDrop);

        // disconnect and nullify everything when the provided `Gtk.ListBoxRow` is destroyed
        gtkListBoxRow.connect('destroy', () => {
            // controllers
            gtkListBoxRow.remove_controller(dragSource);
            gtkListBoxRow.remove_controller(dropController);

            // signal IDs
            if (prepareSignalId) {
                dragSource.disconnect(prepareSignalId);
                prepareSignalId = null;
            }
            if (beginSignalId) {
                dragSource.disconnect(beginSignalId);
                beginSignalId = null;
            }
            if (enterSignalId) {
                dropController.disconnect(enterSignalId);
                enterSignalId = null;
            }
            if (leaveSignalId) {
                dropController.disconnect(leaveSignalId);
                leaveSignalId = null;
            }
            if (dropSignalId) {
                this.dropTarget.disconnect(dropSignalId);
                dropSignalId = null;
            }

            // instance variables
            this.dropTarget = null;
            this.gtkListBox = null;
        });
    }

    /**
     * Create the drag's `prepare` listener.
     *
     * @param {Gtk.ListBoxRow} gtkListBoxRow
     * @param {Gtk.DragSource} dragSource
     * @param {number} dragX
     * @param {number} dragY
     * @returns {number} connection id
     */
    // eslint-disable-next-line no-unused-vars
    #createPrepareListener(gtkListBoxRow, dragSource, dragX, dragY) {
        return dragSource.connect('prepare', (_source, x, y) => {
            dragX = x;
            dragY = y;

            const value = new GObject.Value();
            value.init(Gtk.ListBoxRow);
            value.set_object(gtkListBoxRow);

            return Gdk.ContentProvider.new_for_value(value);
        });
    }

    /**
     * Create the drag's `drag-begin` listener.
     *
     * @param {Gtk.ListBoxRow} gtkListBoxRow
     * @param {Adw.PreferencesRow} titleRow requires a .get_title() method
     * @param {Gtk.DragSource} dragSource
     * @param {number} dragX
     * @param {number} dragY
     * @returns {number} connection id
     */
    #createBeginListener(gtkListBoxRow, titleRow, dragSource, dragX, dragY) {
        return dragSource.connect('drag-begin', (_source, drag) => {
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

    /**
     * Create the drag's `drop` listener.
     *
     * @param {Function} callback called after drop
     * @returns {number} connection id
     */
    #createDropListener(callback) {
        return this.dropTarget.connect('drop', (_drop, value, _x, y) => {
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
