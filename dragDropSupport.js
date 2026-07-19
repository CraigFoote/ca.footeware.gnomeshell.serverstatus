'use strict';

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export class DragDropSupport {
    static addSupport(gtkListBox, afterDrop) {
        const dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow, Gdk.DragAction.MOVE);
        gtkListBox.add_controller(dropTarget);

        // Iterate over ListBox children
        for (const gtkListBoxRow of gtkListBox) {
            let dragX;
            let dragY;

            const dropController = new Gtk.DropControllerMotion();

            const dragSource = new Gtk.DragSource({
                actions: Gdk.DragAction.MOVE,
            });

            gtkListBoxRow.add_controller(dragSource);
            gtkListBoxRow.add_controller(dropController);

            // prepare
            dragSource.connect('prepare', (_source, x, y) => {
                dragX = x;
                dragY = y;

                const value = new GObject.Value();
                value.init(Gtk.ListBoxRow);
                value.set_object(gtkListBoxRow);

                return Gdk.ContentProvider.new_for_value(value);
            });

            // begin
            dragSource.connect('drag-begin', (_source, drag) => {
                // dragWidget > dragRow > icon/title
                const dragWidget = new Gtk.ListBox();
                dragWidget.set_size_request(gtkListBoxRow.get_width(), gtkListBoxRow.get_height());
                dragWidget.add_css_class('boxed-list');

                // add title
                // listBox > listBoxRow > adwPreferencesGroup > adwPreferencesRow
                const preferenceGroup = gtkListBoxRow.get_child();
                const firstRow = preferenceGroup.get_row(0);
                const dragRow = new Adw.ActionRow({
                    title: firstRow.title,
                });

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

            // enter
            dropController.connect('enter', () => {
                gtkListBox.drag_highlight_row(gtkListBoxRow);
            });

            // leave
            dropController.connect('leave', () => {
                gtkListBox.drag_unhighlight_row();
            });

            // drop
            dropTarget.connect('drop', (_drop, value, _x, y) => {
                const targetRow = gtkListBox.get_row_at_y(y);

                if (!value || !targetRow || value === targetRow)
                    return false;

                const targetIndex = targetRow.get_index();

                gtkListBox.remove(value);
                gtkListBox.insert(value, targetIndex);
                targetRow.set_state_flags(Gtk.StateFlags.NORMAL, true);

                // callback
                afterDrop();

                // If everything is successful, return true to accept the drop
                return true;
            });
        }
    }
}
