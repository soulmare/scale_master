/*
 * editor.vm.js
 * SVG View Model objects linkage, based on JsViews API
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2017 Alexander Bolohovetsky
 *
 */

// 1) editor.js
// 2) lib/jsviews.min.js

editor.vm = {};

(function(undef) {
    'use strict';

    editor.vm.svg_elem_types = ['arc', 'axe', 'div', 'line', 'plate', 'hole', 'meta', 'label', 'circle', 'circlecnt', 'image', 'rect'];
    editor.vm.clickable_elements = ['line', 'text', 'circle', 'path', 'rect', 'image'];
        
    editor.vm.init = function () {


        editor.vm.model = {
            background_color: null,
            selected_parent: null,
            selected_child: null,
            selected_object: null,
            display_parent_list: true,
            tpl_objects_enabled: true,
            tpl_context_enabled: true,
            drag_point: null,
            drag_angle: null,
            drag_radius: null,
            is_drag_click: false,
            is_drag_marker_click: false,
            objects: [
            ],
//            parents_list:  function () {
//            },
//            children_list: [
//            ],
            
            // @search can be idx property, or SVG element
            get: function(search) {
                if (typeof(search) == 'undefined')
                    return;
                for (var i in this.objects)
                    if ((this.objects[i].idx == search) || (this.objects[i].element == search))
                        return this.objects[i];
            },
/*
            remove: function(idx) {
                for (var i in this.objects)
                    if (this.objects[i].idx == idx) {
                        $.observable(this.objects).remove(i);
                    }
            },
*/
            select: function(idx) {
                var sel_obj = this.get(idx) || null;
//console.log('select',sel_obj);
                $.observable(this).setProperty("selected_object", sel_obj);
                if(sel_obj) {
                    if (sel_obj.id_parent > -1) {
                        $.observable(this).setProperty("selected_parent", sel_obj.id_parent);
                        $.observable(this).setProperty("selected_child", idx);
                    } else {
                        $.observable(this).setProperty("selected_parent", idx);
                        $.observable(this).setProperty("selected_child", null);
                    }
                } else {
                    $.observable(this).setProperty("selected_parent", null);
                    $.observable(this).setProperty("selected_child", null);
                }
            },
            
            get_new_idx: function() {
                // Get max unused @idx
                var idx = -1;
                for (var i in this.objects) {
                    if (idx < parseInt(this.objects[i].idx)){
                        idx = parseInt(this.objects[i].idx);
                    }
                }
                return ++idx;
            },
            
            add_element: function(element) {
                var idx = this.get_new_idx();
//                if (!element.hasAttribute('title'))
//                    element.setAttribute('title', idx)
                var obj = editor.vm.element_to_model(element);
                obj.idx = idx;
//console.log('+'+obj.idx, this.objects.length);
                this.register_object(obj, this.objects);
                $.observable(this.objects).insert(obj);
                if(editor.vm.clickable_elements.indexOf(obj.tag) >= 0) {
                    $(element, editor.document).bind('click', this.trigger_element_click)
                            .bind('dblclick', this.trigger_element_dblclick)
                            .bind('mousedown', this.trigger_element_mousedown)
                            .bind('mouseup', this.trigger_element_mouseup);
                }
                return obj.idx;
            },
            
            register_object: function(obj, objects_list) {
                if (typeof(objects_list) == 'undefined')
                    objects_list = this.objects;
                // @idx property is same as array index
                if (typeof(obj.idx) == 'undefined') {
                    obj.idx = -1;
                    for (var i in objects_list)
                        if (objects_list[i].element == obj.element)
                            obj.idx = i;
                }
                obj.id_parent = -1;
                // Create children-parent relations
                for (var j in objects_list)
                    if (objects_list[j].element == obj.parent_element){
                        obj.id_parent = objects_list[j].idx ? objects_list[j].idx : parseInt(j);
                        obj.parent_obj = objects_list[j];
                        objects_list[j].children_objs.push(obj);
                    }
                // Link attributes to data
                for (var j in obj.link_attributes) {
                    var attr = obj.link_attributes[j];
                    $.link(attr + "{:" + attr.replace(/-/g, '_') + "}", obj.element, obj);
                }
                // Link element inner text
                if (obj.is_text_node)
                    $.link('text', obj.element, obj);
                var dynamic_update_select_box = _.throttle(editor.update_select_box, 30);
                $.observe(obj, "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "shift_x", "shift_y",
                          "stroke_width", "stroke_width_val", "data_cx", "data_cy", "data_r",
                          "data_width", "data_height", "width", "height", "text", "font_size_val",
                          "font_family", "font_style_ext",
                          "angle", "arc_angle", "r", "radius",
                          dynamic_update_select_box);
/*
                $.observe(obj, "x", "y", function () {
                    editor.update_select_box();
                });
*/
            },
            
            reset: function(elements) {
                var objects = [];
                if (typeof(elements) == 'object') {
                    // Convert SVG DOM elements to model objects
                    for (var i in elements) {
                        var obj = editor.vm.element_to_model(elements[i]);
                        if (obj.type)
                            objects.push(obj);
                    }
                    for (var i in objects)
                        this.register_object(objects[i], objects);
                }
                $.observable(this).setProperty("objects", objects);
            },
//            indexOf: function(element) {
//                for (var i in this.objects)
//                    if (this.objects[i].element === element)
//                        return parseInt(i);
//                return -1;
//            },
            
            trigger_selection_change: function (ev, eventArgs) {
                var _this = ev.target;
                var obj = _this.selected_object;
//                $('._ed_sel', editor.document).removeClass('_ed_sel');
//                if (obj)
//                    $(obj.element).addClass('_ed_sel');
                editor.update_select_box();
            },
            
            trigger_select: function (ev, eventArgs) {
                if(eventArgs.value === null)
                    return;
                var _this = ev.target;
                var obj = _this.get(eventArgs.value);
//console.log('trigger_select',obj);
                if (obj) {
                    $.observable(_this).setProperty("selected_object", obj);
                } else {
                    $.observable(_this).setProperty("selected_object", null);
                    console.log('ERROR: Object #'+eventArgs.value+' not found in trigger_select()');
//                    console.trace();
//                    console.log(ev, eventArgs);
                }
            },

            trigger_element_click: function (e) {
//                if (e.button !== 0) return;
                var obj = editor.vm.model.get(this);
                if (obj && !editor.vm.model.is_drag_click)
                    editor.vm.model.select(obj.idx);
            },

            trigger_element_dblclick: function (e) {
//                if (e.button !== 0) return;
                var obj = editor.vm.model.get(this);
                if (obj){
                    var parent_obj = obj.parent_obj;
                    if (parent_obj && parent_obj.is_group)
                        setTimeout(function () {editor.vm.model.select(parent_obj.idx)}, 300);
                }
            },
            
            trigger_element_mousedown: function (e) {
//                if (e.button !== 0) return;
//console.log();
                var obj = editor.vm.model.get(this);
                var sel_obj = editor.vm.model.selected_object;
                if (!sel_obj) return;
                editor.vm.model.is_drag_marker_click = (this.getAttribute('id') == '_ed_select_marker');
                if ((obj === sel_obj) || editor.vm.model.is_drag_marker_click || (sel_obj && sel_obj.children_objs && (sel_obj.children_objs.indexOf(obj) >= 0))) {
                    
                    // Get cartesian position of drag point
                    var element_pos = [editor.px_to_units(sel_obj.shift_x() || 0), editor.px_to_units(sel_obj.shift_y() || 0)];
                    var pointer_pos = editor.coords_mouse_event_to_document(e);
                    //:TODO: make it correct with different document_origin_mode values
//                    var y_invert = editor.cfg.document_origin_mode == 1 ? -1 : 1;
                    // Drag point is fixed delta between pointer's position and element's position
                    editor.vm.model.drag_point = [element_pos[0] - pointer_pos[0], element_pos[1] - pointer_pos[1]];
//                    editor.vm.model.drag_angle = Math.atan2(pointer_pos[0], -pointer_pos[1]) * 180.0 / Math.PI;

                    // Get radius of drag point
                    var elem_radius = sel_obj.type == 'arc' ? sel_obj.radius() || 0 : sel_obj.data_r || 0;
                    // Get delta between element radius and pointer radius
                    editor.vm.model.drag_radius = editor.calc.distance(element_pos[0], element_pos[1], pointer_pos[0], pointer_pos[1]) - editor.px_to_units(elem_radius);
//                    var radius_delta = editor.vm.model.drag_radius - drag_radius;
//console.log('M', editor.vm.model.drag_radius, radius_delta, sel_obj[prop_name]);
//console.log('fix',editor.vm.model.drag_radius,elem_radius)
                    //this.getAttribute('id') == '_ed_select_marker'
                    
                    // Get angle of drag point (only for grouped elements)
                    if (sel_obj.parent_obj) {
                        var dx = pointer_pos[0] - editor.px_to_units(sel_obj.parent_obj.shift_x() || 0);
                        var dy = editor.px_to_units(sel_obj.parent_obj.shift_y() || 0) - pointer_pos[1];
                        var drag_angle = Math.atan2(dx, dy) * 180.0 / Math.PI - (sel_obj.parent_obj.angle() || 0);
                        // Fix angle overing period
                        if (Math.abs(drag_angle-sel_obj.parent_obj.angle()) > 360) {
                            drag_angle = 360 % drag_angle;
                            if (drag_angle-sel_obj.parent_obj.angle() > 0)
                                drag_angle = -drag_angle;
                        }
                        // Get delta between element angle and pointer angle
                        editor.vm.model.drag_angle = drag_angle - (sel_obj.angle_val() || 0);
//console.log('fix',drag_angle,editor.vm.model.drag_angle)
                    }
                }
            },

            trigger_element_mouseup: function (e) {
//                if (e.button !== 0) return;
//console.log('- elem');
                editor.vm.model.drag_point = null;
//                $('rect#background', editor.document).css({'cursor': ""});
                setTimeout(function () {editor.vm.model.is_drag_click = false;editor.vm.model.is_drag_marker_click = false;}, 200);
            },

            trigger_document_mouseup: function (e) {
//                if (e.button !== 0) return;
//console.log('- doc');
                editor.vm.model.drag_point = null;
//                $('rect#background', editor.document).css({'cursor': ""});
                setTimeout(function () {editor.vm.model.is_drag_click = false;editor.vm.model.is_drag_marker_click = false;}, 200);
            },
            
            trigger_document_mousemove: function (e) {
                var sel_obj = editor.vm.model.selected_object;
//console.log(editor.vm.model.drag_point,sel_obj)
                if (editor.vm.model.drag_point && sel_obj) {
                    editor.vm.model.is_drag_click = true;
//                    var cursor = 'cur_move.png';
                    var pointer_pos = editor.coords_mouse_event_to_document(e);
                    var element_pos = [editor.px_to_units(sel_obj.shift_x() || 0), editor.px_to_units(sel_obj.shift_y() || 0)];

                    if (editor.vm.model.is_drag_marker_click){

//console.log(drag_range,shift_y,radius)
/*
                        var drag_range = element_pos[1] - pointer_pos[1];
                        var shift_y = editor.units_round((sel_obj.shift_y() || 0) - editor.units_to_px(drag_range), 1);
                        var radius = editor.units_round((sel_obj.radius() || 0) - editor.units_to_px(drag_range), 1);
                        $.observable(sel_obj).setProperty('shift_y', shift_y);
                        $.observable(sel_obj).setProperty('radius', radius);
*/
                        // Move element
                        $.observable(sel_obj).setProperty('shift_x', editor.units_round(editor.units_to_px(pointer_pos[0] + editor.vm.model.drag_point[0]), 1));
                        $.observable(sel_obj).setProperty('shift_y', editor.units_round(editor.units_to_px(pointer_pos[1] + editor.vm.model.drag_point[1]), 1));
                    
                    } else if (!e.ctrlKey && (((sel_obj.type == 'div') && (sel_obj.tag == 'line')) || (sel_obj.parent_obj && (sel_obj.parent_obj.tag == 'g') && (sel_obj.tag == 'text')))) {
//console.log(e)
                        
                        // Turn element
                        if (sel_obj.parent_obj) {
                            var element_pos = [editor.px_to_units(sel_obj.parent_obj.shift_x() || 0), editor.px_to_units(sel_obj.parent_obj.shift_y() || 0)];
                            var dx = pointer_pos[0]-element_pos[0];
                            var dy = element_pos[1]-pointer_pos[1];
                            var drag_angle = Math.atan2(dx, dy) * 180.0 / Math.PI - (sel_obj.parent_obj.angle() || 0) - editor.vm.model.drag_angle;
//console.log('m',[dx, dy],Math.atan2(dx, dy),drag_angle,sel_obj.parent_obj.angle())
                            // Fix angle overing period
                            if (Math.abs(drag_angle-sel_obj.parent_obj.angle()) > 360) {
                                drag_angle = 360 % drag_angle;
                                if (drag_angle-sel_obj.parent_obj.angle() > 0)
                                    drag_angle = -drag_angle;
//console.log('fix')
                            }
                            // Fix jumping around near 3/4 rotation
                            if (Math.abs(drag_angle) > 180)
                                drag_angle = drag_angle > 0 ? drag_angle - 360 : drag_angle + 360;
                            $.observable(sel_obj).setProperty('angle_val', _.round(drag_angle, 1));
                        }

                    } else if (!e.ctrlKey && ((sel_obj.type == 'arc') || ((sel_obj.tag == 'g') && ((sel_obj.type == 'div') || (sel_obj.type == 'label'))))) {
                        // Change radius
//                        var cursor = 'cur_move_radial.png';
//console.log('Change radius');
                        var drag_radius = editor.calc.distance(element_pos[0], element_pos[1], pointer_pos[0], pointer_pos[1]);
//                        var radius_delta = editor.vm.model.drag_radius - drag_radius;
                        var prop_name = sel_obj.type == 'arc' ? 'radius' : 'data_r';
//console.log('M', drag_radius, editor.vm.model.drag_radius, sel_obj[prop_name]);
//                        $.observable(sel_obj).setProperty(prop_name, editor.units_round(editor.units_to_px(drag_radius), 1));
                        $.observable(sel_obj).setProperty(prop_name, editor.units_round(editor.units_to_px(drag_radius - editor.vm.model.drag_radius), 1));
                    } else {
                        // Move element
                        $.observable(sel_obj).setProperty('shift_x', editor.units_round(editor.units_to_px(pointer_pos[0] + editor.vm.model.drag_point[0]), 1));
                        $.observable(sel_obj).setProperty('shift_y', editor.units_round(editor.units_to_px(pointer_pos[1] + editor.vm.model.drag_point[1]), 1));
                    }
//                    $('rect#background', editor.document).css({'cursor': "url('images/"+cursor+"') 10 10, move"});
                }
            },
            
            // Delete current selected object, or object specified in @delete_obj
            delete: function (event, eventArgs, delete_obj) {
                if (typeof(delete_obj) == 'undefined')
                    delete_obj = this.selected_object;

                $.observable(this).setProperty("tpl_objects_enabled", false);
                
                var obj_name = '[' + $.i18n('type_'+delete_obj.tag+'_'+delete_obj.type) + ']';
                if (delete_obj.element.getAttribute('title'))
                    obj_name += ' ' + delete_obj.element.getAttribute('title');
                else
                    obj_name += ' #' + delete_obj.idx;
                if (delete_obj.children_objs.length)
                    var confirm_text = $.i18n('msg_confirm_delete_with_children').replace('%s', obj_name).replace('%s', delete_obj.children_objs.length);
                else
                    var confirm_text = $.i18n('msg_confirm_delete').replace('%s', obj_name);
                if (eventArgs && (eventArgs.change == 'click') && !confirm(confirm_text))
                    return;
                
                // Delete children
                var child = null;
                while (child = delete_obj.children_objs.pop()) {
                    // Delete node
                    delete_obj.element.removeChild(child.element);
                    // Find and delete model object
                    for (var i in this.objects)
                        if (child == this.objects[i]) {
//console.log('-child', child.idx, i);
                            $.observable(this.objects).remove(i);
                            break;
                        }
                }

                // Remove link from parent's children list
                if (delete_obj.parent_obj)
                    for (var i in delete_obj.parent_obj.children_objs)
                        if (delete_obj.parent_obj.children_objs[i] == delete_obj){
                            delete_obj.parent_obj.children_objs.splice(i, 1);
                            break;
                        }

                // Remove node from document
                var parent_element = delete_obj.element.parentNode;
                parent_element.removeChild(delete_obj.element);
                var id_parent = delete_obj.id_parent;
                // Remove object from model
                for (var i in this.objects)
                    if (this.objects[i] === delete_obj) {
//console.log('-', delete_obj.idx, i);
                        $.observable(this.objects).remove(i);
                        break;
                    }

                // Change current object selection
                $.observable(this).setProperty("tpl_objects_enabled", true);
                if (id_parent >= 0)
                    this.select(id_parent);
                else
                    this.select();
            },
            
            create_element: function (ev, eventArgs) {
                $('.dropdown').hide();
                if (ev.element_type)
                    var elem_data = ev.element_type.split('.');
                else
                    var elem_data = ev.target.getAttribute('data-element-type').split('.');
                var tag = elem_data.splice(0, 1)[0];
                var classnames = elem_data;

                // Get default values if possible
                var base_size = editor.units_mm_to_px(100);
                var sel_obj = editor.vm.model.selected_object;
                if (sel_obj)
                    var sel_group = sel_obj.tag === 'g' ? sel_obj : sel_obj.parent_obj || null;
                else
                    var sel_group = null;
                if (sel_group) {
                    if (sel_group.data_length)
                        editor.cfg.new_item.length = editor.px_to_units(sel_group.data_length);
                    if (sel_group.data_angle)
                        editor.cfg.new_item.angle = sel_group.data_angle;
                    if (sel_group.data_r)
                        editor.cfg.new_item.r = editor.px_to_units(sel_group.data_r);
                    if (sel_group.stroke_width_val())
                        editor.cfg.new_item.stroke_width = editor.px_to_units(sel_group.stroke_width_val());
                    if (sel_group.font_size)
                        editor.cfg.new_item.font_size = editor.px_to_units(sel_group.element.getAttribute('font-size'));
//console.log(sel_group.font_size)
                }
                // Prefer object over it's group
                if (sel_obj) {
                    if (sel_obj.line_length && sel_obj.line_length())
                        editor.cfg.new_item.length = editor.px_to_units(sel_obj.length);
                    if (sel_obj.data_angle)
                        editor.cfg.new_item.angle = sel_obj.data_angle;
                    if (sel_obj.r)
                        editor.cfg.new_item.r = editor.px_to_units(sel_obj.r);
                    if (sel_obj.stroke_width_val())
                        editor.cfg.new_item.stroke_width = editor.px_to_units(sel_obj.stroke_width_val());
                    if (sel_obj.font_size)
                        editor.cfg.new_item.font_size = editor.px_to_units(sel_obj.element.getAttribute('font-size'));
//console.log(sel_obj.font_size)
                }
                
                // Request new item parameters
                switch (tag) {
                    case 'g':
                        var items_count = 0;
                        if (classnames.indexOf('div') >= 0) {
                            items_count = prompt($.i18n('msg_divisions_count'), editor.cfg.new_item.items_count || 0);
                            if (items_count === null)
                                return;
                            else
                                editor.cfg.new_item.items_count = items_count;
                        }
                        if (classnames.indexOf('label') >= 0) {
                            items_count = prompt($.i18n('msg_labels_count'), editor.cfg.new_item.items_count || 0);
                            if (items_count === null)
                                return;
                            else
                                editor.cfg.new_item.items_count = items_count;
                        }
                        items_count = parseInt(items_count) || 0;
                        break;
                    case 'text':
                        var text = prompt($.i18n('msg_label_text'), editor.cfg.new_item.label_text || $.i18n('new_label'));
                        if (text === null)
                            return;
                        else
                            editor.cfg.new_item.label_text = text;
                        break;
                    case 'line':
                        var length = prompt($.i18n('msg_length'), editor.cfg.new_item.length || 0);
                        if (length === null)
                            return;
                        else
                            editor.cfg.new_item.length = length;
                        break;
                    case 'circle':
                        var radius = prompt($.i18n('msg_radius'), editor.cfg.new_item.r || 0);
                        if (radius === null)
                            return;
                        else
                            editor.cfg.new_item.r = radius;
                        break;
                    case 'path':
                        if (classnames.indexOf('plate-rectangular-top') > -1) {
                            var size = prompt($.i18n('msg_size'), editor.cfg.new_item.size || 0);
                            if (size === null)
                                return;
                            else
                                editor.cfg.new_item.size = size;
                        } else if ((classnames.indexOf('arc') > -1) || (classnames.indexOf('circlecnt') > -1)) {
                            var radius = prompt($.i18n('msg_radius'), editor.cfg.new_item.r || 0);
                            if (radius === null)
                                return;
                            else
                                editor.cfg.new_item.r = radius;
                        }
                        break;
                    case 'rect':
                        var size = prompt($.i18n('msg_size'), editor.cfg.new_item.size || 0);
                        if (size === null)
                            return;
                        else
                            editor.cfg.new_item.size = size;
                        break;
                }
                
                
                // Create new element
                var element = document.createElementNS(editor.ns_svg, tag);
                element.setAttribute('class', classnames.join(' '));

                // Set common attributes
                switch (tag) {
                    case 'line':
                    case 'circle':
                    case 'circlecnt':
                    case 'path':
                    case 'rect':
                        element.setAttribute('stroke-width', editor.units_to_px(editor.cfg.new_item.stroke_width || editor.cfg.styles.stroke_width));
                        element.setAttribute('stroke', this.obj_color());
                        element.setAttribute('fill', 'none');
                        break;
                }

                // Set special attributes
                switch (tag) {
                    case 'text':
                        element.setAttribute('x', 0);
//                        element.setAttribute('y', -editor.units_round(base_size*0.2));
                        element.setAttribute('y', 0);
                        element.setAttribute('text-anchor', 'middle');
//                        element.setAttribute('dominant-baseline', 'central');
                        element.setAttribute('dy', '0.3em');
                        element.setAttribute('fill', this.obj_color());
                        element.setAttribute('stroke', 'none');
                        element.setAttribute('font-family', editor.cfg.styles.font_family);
                        element.innerText = text;
//console.log(editor.cfg.new_item.font_size)
                        element.setAttribute('font-size', editor.units_to_px(editor.cfg.new_item.font_size || editor.cfg.styles.font_size));
                        break;
                    case 'line':
                        element.setAttribute('title', $.i18n('new_line'));
                        if (classnames.indexOf('h') >= 0) {
                            element.setAttribute('x1', -editor.units_to_px(length*0.5));
                            element.setAttribute('y1', 0);
                            element.setAttribute('x2', editor.units_to_px(length*0.5));
                            element.setAttribute('y2', 0);
                        } else if (classnames.indexOf('v') >= 0) {
                            element.setAttribute('x1', 0);
                            element.setAttribute('y1', editor.units_to_px(length*0.5));
                            element.setAttribute('x2', 0);
                            element.setAttribute('y2', -editor.units_to_px(length*0.5));
                        } else {
                            element.setAttribute('x1', editor.units_to_px(length*0.5));
                            element.setAttribute('y1', editor.units_to_px(length*0.5));
                            element.setAttribute('x2', -editor.units_to_px(length*0.5));
                            element.setAttribute('y2', -editor.units_to_px(length*0.5));
                        }
                        break;
                    case 'circle':
                        element.setAttribute('title', $.i18n('new_circle'));
                        element.setAttribute('cx', 0);
                        element.setAttribute('cy', 0);
                        element.setAttribute('r', editor.units_to_px(radius));
                        break;
                    case 'rect':
                        element.setAttribute('title', $.i18n('new_rect'));
                        element.setAttribute('x', -editor.units_round(editor.units_to_px(size/2)));
                        element.setAttribute('y', -editor.units_round(editor.units_to_px(size/2)));
                        element.setAttribute('width', editor.units_round(editor.units_to_px(size)));
                        element.setAttribute('height', editor.units_round(editor.units_to_px(size)));
                        break;
                    case 'path':
                        element.setAttribute('d', '');
                        if (classnames.indexOf('plate-rectangular-top') > -1) {
                            element.setAttribute('title', $.i18n('new_scale_plate'));
                            element.setAttribute('data-width', editor.units_to_px(size));
                            element.setAttribute('data-height', editor.units_to_px(size));
                            element.setAttribute('transform', 'translate(0,'+editor.units_round(editor.units_to_px(size)*0.06)+')');
                            if (classnames.indexOf('plate-top-cut') > -1) {
                                element.setAttribute('data-top-cut', editor.units_round(editor.units_to_px(size)*0.2));
                            }
                        } else if (classnames.indexOf('arc') > -1) {
                            element.setAttribute('title', $.i18n('new_arc'));
                            element.setAttribute('data-angle', editor.cfg.new_item.angle);
                            element.setAttribute('data-r', editor.units_to_px(radius));
                        } else if (classnames.indexOf('circlecnt') > -1) {
                            element.setAttribute('title', $.i18n('new_circlecnt'));
                            element.setAttribute('data-cx', 0);
                            element.setAttribute('data-cy', 0);
                            element.setAttribute('data-r', editor.units_to_px(radius));
                        }
                        break;
                    case 'g':
                        if (classnames.indexOf('label') > -1) {
                            element.setAttribute('title', $.i18n('new_labels_group'));
                            element.setAttribute('fill', this.obj_color());
                            element.setAttribute('stroke', 'none');
//                            element.setAttribute('dominant-baseline', 'central');
                            element.setAttribute('text-anchor', 'middle');
                            element.setAttribute('font-family', editor.cfg.styles.font_family);
                            element.setAttribute('font-size', editor.units_to_px(editor.cfg.new_item.font_size || editor.cfg.styles.font_size));
                            element.setAttribute('data-r', editor.units_to_px(editor.cfg.new_item.r*1.2));
                            element.setAttribute('data-angle', editor.cfg.new_item.angle);
//                            element.setAttribute('data-keep-angle', 'true');
                            element.setAttribute('data-label-step', '1');
                            element.setAttribute('data-label-start', '0');
                        } else {
                            element.setAttribute('stroke-width', editor.units_to_px(editor.cfg.new_item.stroke_width || editor.cfg.styles.stroke_width));
                            element.setAttribute('stroke', this.obj_color());
                            element.setAttribute('fill', 'none');
                            if (classnames.indexOf('div') > -1) {
                                element.setAttribute('title', $.i18n('new_divisions_group'));
                                element.setAttribute('data-angle', editor.cfg.new_item.angle);
                                element.setAttribute('data-r', editor.units_to_px(editor.cfg.new_item.r));
                                element.setAttribute('data-length', editor.units_round(base_size*0.04));
                            }
                        }
                        break;
                    case 'image':
                        element.setAttribute('x', -editor.units_round(ev.width/2));
                        element.setAttribute('y', -editor.units_round(ev.height/2));
                        element.setAttribute('width', ev.width);
                        element.setAttribute('height', ev.height);
                        element.setAttribute('data-original-width', ev.width);
                        element.setAttribute('data-original-height', ev.height);
                        element.setAttribute('title', ev.name);
                        element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', ev.datauri);
                        break;
                }
                
                editor.document.getElementById('scale_wrapper').appendChild(element);
                var idx = this.add_element(element);
                var obj = this.get(idx);
                
                if (tag == 'path')
                    obj.update_path({target: obj});
                else if ((tag == 'g') && (obj.type == 'div')) {
                    if (items_count)
                        $.observable(obj).setProperty("count_children", items_count);
                } else if ((tag == 'g') && (obj.type == 'label')) {
                    if (items_count)
                        $.observable(obj).setProperty("count_children", items_count);
                }
                
                this.select(idx);
                
                $('#workspace').focus();
                
                return false;
            },
            
            
            move_up: function (ev, eventArgs) {
                if (this.selected_object)
                    this.move_obj(this.selected_object, 1);
            },

            move_down: function (ev, eventArgs) {
                if (this.selected_object)
                    this.move_obj(this.selected_object, -1);
            },
            
            // if @shift is negative, moves object down, if positive - moves up
            move_obj: function (obj, shift) {
                if (!obj)
                    return;
                var prev_obj = null;
                var next_obj = null;
                var found_index = -1;
                var prev_obj_index = -1;
                var next_obj_index = -1;
                var parent_obj = obj.parent_obj;
                for (var i in this.objects)
                    if (this.objects[i] === obj)
                        found_index = i;
                    else if (this.objects[i].parent_obj === parent_obj){
                        if (found_index >= 0) {
                            next_obj = this.objects[i];
                            next_obj_index = i;
                            break;
                        } else {
                            prev_obj = this.objects[i];
                            prev_obj_index = i;
                        }
                    }
//console.log(prev_obj ? prev_obj.element : null, this.selected_object.element, next_obj ? next_obj.element : null);

                // Move object if possible
                if (((shift > 0) && prev_obj) || ((shift < 0) && next_obj)){
                    $.observable(this).setProperty('display_parent_list', false);
                    // Move node
                    if (shift > 0)
                        this.selected_object.element.parentNode.insertBefore(this.selected_object.element, prev_obj.element);
                    else
                        this.selected_object.element.parentNode.insertBefore(next_obj.element, this.selected_object.element);
                    // Swap object with it's neighbour in array
//console.log(found_index, found_index-1);
//console.log(this.objects[found_index], this.objects[found_index-1]);
                    // First, unselect object, otherwise move() fails with weird internal error
                    var selected_idx = this.selected_object.idx;
                    this.select();
                    if (shift > 0)
                        $.observable(this.objects).move(found_index, prev_obj_index);
                    else
                        $.observable(this.objects).move(found_index, next_obj_index);
                    // ... and select same object again
                    this.select(selected_idx);
                    $.observable(this).setProperty('display_parent_list', true);
                }
            },
            
            enable_templates: function (enabled) {
                $.observable(editor.vm.model).setProperty('tpl_objects_enabled', enabled);
                $.observable(editor.vm.model).setProperty('tpl_context_enabled', enabled);
            },
            
            redraw_templates: function () {
                this.enable_templates(false);
                this.enable_templates(true);
/*
                $.observable(editor.vm.model).setProperty('tpl_objects_enabled', false);
                $.observable(editor.vm.model).setProperty('tpl_context_enabled', false);
                $.observable(editor.vm.model).setProperty('tpl_objects_enabled', true);
                $.observable(editor.vm.model).setProperty('tpl_context_enabled', true);
*/
            },
            
            insert_symbol: function (event, e) {
                $.observable(this.selected_object).setProperty('text', (this.selected_object.text || '') + $(event.target).html());
            }
            
        };
        
        editor.vm.model.image_size = function () {
            return editor.document ? editor.document.getAttribute('data-image-size') || 'A4' : '';
        };
        editor.vm.model.image_size.set = function (val) {
            if (!editor.document) return;
            if (!val) val = this.image_size();
            var format = editor.image_sizes[val] || editor.image_sizes['A4'];
            var page_size = this.image_orientation() == 'portrait' ? [format[0], format[1]] : [format[1], format[0]];
            editor.document.setAttribute('data-image-size', val);
            editor.document.setAttribute('data-width', page_size[0]);
            editor.document.setAttribute('data-height', page_size[1]);
            var scale_wrapper = editor.document.getElementById('scale_wrapper');
            scale_wrapper.setAttribute('transform', 'translate('+Math.round(page_size[0]/2)+','+Math.round(page_size[1]/2)+')');
            var service_grp = editor.document.getElementById('_ed_service_grp');
            service_grp.setAttribute('transform', scale_wrapper.getAttribute('transform'));
            editor.set_zoom();
        };
        
        editor.vm.model.image_orientation = function () {
            return editor.document ? editor.document.getAttribute('data-image-orientation') || 'portrait' : '';
        };
        editor.vm.model.image_orientation.set = function (val) {
            if (!val || !editor.document) return;
            editor.document.setAttribute('data-image-orientation', val);
            $.observable(this).setProperty('image_size');
        };
        editor.vm.model.obj_color = function () {
            if (editor.document && editor.document.getElementById) {
                var scale_wrapper = editor.document.getElementById('scale_wrapper');
                return scale_wrapper.getAttribute('stroke') || editor.cfg.styles.objects_color;
            } else
                return editor.cfg.styles.objects_color;
        };
        editor.vm.model.obj_color.set = function (val) {
            if (!editor.document) return;
            if (!val) return;
            val = val || editor.cfg.styles.objects_color;
            var old_val = this.obj_color();
            var scale_wrapper = editor.document.getElementById('scale_wrapper');
            if (scale_wrapper) {
                scale_wrapper.setAttribute('stroke', val);
                if (val != old_val) {
                    svgedit.utilities.walkTree(scale_wrapper, function (elem) {
                        if (elem.getAttribute('stroke') == old_val)
                            elem.setAttribute('stroke', val);
                        // Text is colored by fill attribute
                        if (elem.getAttribute('fill') == old_val)
                            elem.setAttribute('fill', val);
                    });            
                }
            }
        };
        
        // Unit converters
        var _from_px = function(val, axe) {
            var invert_k = (axe == 'y') && (editor.cfg.document_origin_mode == 1) ? -1 : 1;
            return isNaN(parseFloat(val)) ? '' : _.round(parseFloat(val)/editor.cfg.units.conversion_k,4)*invert_k;
        };
        var _to_px = function(val, axe) {
            var invert_k = (axe == 'y') && (editor.cfg.document_origin_mode == 1) ? -1 : 1;
            return isNaN(parseFloat(val)) ? '' : parseFloat(val)*editor.cfg.units.conversion_k*invert_k;
        };
        $.views.converters("from_px", _from_px);
        $.views.converters("to_px", _to_px);
        $.views.converters("y_axe_from_px", function(val) {
            return _from_px(val, 'y');
        });
        $.views.converters("y_axe_to_px", function(val) {
            return _to_px(val, 'y');
        });

        $.views.converters("i18n", function (val, fallback) {
            var translated = $.i18n(val);
            if ((translated == val) && (fallback !== undefined))
                translated = fallback;
            return translated;
        });
        
        // Init object list template
        editor.vm.tmpl_objects = $.templates("#tpl_objects");
        editor.vm.tmpl_objects.link("#objects", editor.vm.model);

        // Init properties template
        editor.vm.tmpl_context = $.templates("#tpl_context");
        editor.vm.tmpl_context.link("#context_pan .inner", editor.vm.model);

        // Handlers of change selected object action
        $.observe(editor.vm.model, "selected_object", editor.vm.model.trigger_selection_change);
        $.observe(editor.vm.model, "selected_parent", "selected_child", editor.vm.model.trigger_select);

        // Update page title
        $.observe(editor.vm.model, "title", function (ev, eventArgs) {
            document.title = APP_NAME;
            if (eventArgs.value != '')
                document.title += ' - ' + eventArgs.value;
        });
        
/*
        $.observe(editor.vm.model, '**', function (ev, eventArgs) {
            console.log(eventArgs)
        });
*/
        
    }
    
    
    editor.vm.get_element_type = function (elem) {
//        var className = elem.className.baseVal === undefined ? elem.className : elem.className.baseVal;
//        var elem_type = _.intersection(className.split(/\s+/g), editor.vm.svg_elem_types);
        var elem_type = _.intersection(elem.className.baseVal.split(/\s+/g), editor.vm.svg_elem_types);
        // If no type is set - inherite it from parent node
        if (!elem_type.length && (elem.nodeName.toLowerCase() != 'svg') && elem.parentNode && (elem.parentNode.nodeName.toLowerCase() != 'svg'))
            return editor.vm.get_element_type(elem.parentNode);
        return elem_type.length ? elem_type[0] : null;
    };

    
    editor.vm.create_image_model = function () {
        
        // Load SVG elements into model objects array
        var elems = [];
        var scale_wrapper = editor.document.getElementById('scale_wrapper');
        svgedit.utilities.walkTree(scale_wrapper, function (elem) {
            elems.push(elem);
        });
        editor.vm.model.reset(elems.reverse());
        
        // Select object event listener
//        $('.'+editor.vm.svg_elem_types.join(',.'), scale_wrapper).bind('click', editor.vm.model.trigger_element_click);
        $(editor.vm.clickable_elements.join(',') + ',#_ed_select_marker', editor.document)
                .bind('click', editor.vm.model.trigger_element_click)
                .bind('dblclick', editor.vm.model.trigger_element_dblclick)
                .bind('mousedown', editor.vm.model.trigger_element_mousedown)
                .bind('mouseup', editor.vm.model.trigger_element_mouseup);
        // Background click
        $('rect#background', editor.document).bind('click', function () {editor.vm.model.select()});
        $(editor.document)
                .bind('mousemove', editor.vm.model.trigger_document_mousemove)
                .bind('mouseup mouseleave', editor.vm.model.trigger_document_mouseup);
//        $('#_ed_select_marker', editor.document).bind('click', function () {editor.vm.model.select()});

        var bg_elem = $('rect#background', editor.document)[0];
        if (bg_elem){
            $.observable(editor.vm.model).setProperty('background_color', bg_elem.getAttribute('fill') || '#FFFFFF');
            $.link("fill{:background_color}", bg_elem, editor.vm.model);
        } else
            $.observable(editor.vm.model).setProperty('background_color', '#FFFFFF');

        $.observable(editor.vm.model).setProperty('obj_color');

        var elem_title = editor.document.getElementsByTagName('title')[0];
//        document.title = APP_NAME;
        if (elem_title){
            $.observable(editor.vm.model).setProperty('title', elem_title.textContent);
            $.link("{:title}", elem_title, editor.vm.model);
//            document.title += ' - ' + elem_title.textContent;
        }

        var elem_desc = editor.document.getElementsByTagName('desc')[0];
        if (elem_desc){
            $.observable(editor.vm.model).setProperty('description', elem_desc.textContent);
            $.link("{:description}", elem_desc, editor.vm.model);
        }
        
        $.observable(editor.vm.model).setProperty('image_size');
        $.observable(editor.vm.model).setProperty('image_orientation');
        
        $.observable(editor.vm.model).setProperty('selected_object');
    }

    
    // Create model object from given SVG DOM element
    editor.vm.element_to_model = function (element) {

        var el_type = editor.vm.get_element_type(element);
//        console.log(el_type);
        
        if ((element.nodeName == 'title') || (element.nodeName == 'description'))
            return new editor.elm_text(element);

        if (element.nodeName == 'text')
            return new editor.elm_graphic(element);

        if (element.nodeName == 'image')
            return new editor.elm_image(element);
        
        if (element.nodeName == 'g'){
            if (el_type == 'div')
                return new editor.elm_div_group(element);
            else if (el_type == 'label')
                return new editor.elm_label_group(element);
            return new editor.elm_graphic(element);
        }
        
        if (element.nodeName == 'line')
            return new editor.elm_line(element);

        if (element.nodeName == 'path') {
            if (el_type == 'arc')
                return new editor.elm_arc(element);
            if (el_type == 'plate')
                return new editor.elm_plate(element);
            if (el_type == 'circlecnt')
                return new editor.elm_circlecnt(element);
            return new editor.elm_path(element);
        }
        
        if (element.nodeName == 'circle')
            return new editor.elm_circle(element);

        if (element.nodeName == 'rect')
            return new editor.elm_rect(element);
        
        return new editor.elm_graphic(element);
            
    }

    
}());
