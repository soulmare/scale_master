/*
 * Manageable graphic object based on SVG element
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2017 Alexander Bolohovetsky
 *
*/

editor.elm = function(element) {


    this.element = element;
    this.type = editor.vm.get_element_type(element);
    this.link_attributes = this.link_attributes ? this.link_attributes : [];
    this.tag = element.nodeName.toLowerCase();
    this.is_text_node = null; // node type will be defined in ancestor object
    this.is_group = element.nodeName.toLowerCase() == 'g';
    this.parent_element = element.parentNode;
    this.parent_obj = null;
    this.children_objs = [];
    this.text = element.textContent || element.innerText;

    for (var i in this.link_attributes) {
        var attr = this.link_attributes[i];
        var field = attr.replace(/-/g, '_');
        if (typeof(this[field]) == 'undefined') {
            if (this.element.hasAttribute(attr))
                this[field] = this.element.getAttribute(attr);
        } else
            console.log('ASSERTION FAILED: Observable attribute name "'+attr+'" already defined.');
    }
    
};


editor.elm.prototype.ext_title = function () {
    var name = this.title;
    if (((name === '') || (typeof(name) === 'undefined')) && this.is_text_node)
        name = this.text.toString();
    if (typeof(name) === 'undefined')
        name = '$' + this.idx; // :TODO: use parent's child index instead of @idx
    return '[' + $.i18n('type_' + this.tag + '_' + this.type) + '] ' + name.substring(0, 100);
//    return '[' + this.element.nodeName + '] ' + name.substring(0, 100);
};
editor.elm.prototype.ext_title.depends = ['title', 'text'];

editor.elm.prototype.count_children = function () {
    return this.children_objs.length;
}


// Class el_text

editor.elm_text = function(element) {
    editor.elm.apply(this, arguments);
    this.is_text_node = true;
//    console.log(element);
}

editor.elm_text.prototype = Object.create(editor.elm.prototype);
editor.elm_text.prototype.constructor = editor.elm_text;


// Class elm_graphic
// Extends elm
// Base class for all graphic elements

editor.elm_graphic = function(element) {
    if (element.nodeName == 'text')
        var link_attributes = ['font-size', 'font-weight', 'fill'];
    else
        var link_attributes = ['title', 'stroke-width', 'stroke', 'fill'];
    link_attributes.push('data-keep-angle', 'x', 'y', 'opacity');
    // Merge with ancestor's @link_attributes if present
    this.link_attributes = this.link_attributes ? this.link_attributes.concat(link_attributes) : link_attributes;
    // Parent constructor
    editor.elm.apply(this, arguments);
    if (element.nodeName == 'text')
        // <text> node is a graphic and text object
        this.is_text_node = true;
    else
        this.is_text_node = false;
    
    this.rotation_recalc = function (ev, eventArgs) {
        // Callback function. Using @ev.target instead of @this
        var _this = ev.target;
        // Need more elegant workaround here to invoke @angle setter
        var angle = _this.angle();
        $.observable(_this).setProperty("angle", angle+1);
        $.observable(_this).setProperty("angle", angle);
//        _this.angle.set(_this.angle());
    }
    $.observe(this, 'data_keep_angle', 'x', 'y', this.rotation_recalc);

}
editor.elm_graphic.prototype = Object.create(editor.elm.prototype);
editor.elm_graphic.prototype.constructor = editor.elm_graphic;

// Parse transform functions
editor.elm_graphic.prototype.get_transform = function () {
//console.log('get_transform');
    var transform = [];
    if (this.element.hasAttribute('transform')) {
        var re = /\s*([\w_]+)\s*\(\s*([^\)]+)\)/g;
        var m;
//console.log(this.element.getAttribute('transform'));
        do {
            m = re.exec(this.element.getAttribute('transform'));
//console.log(m);
            if (m) {
                var args = m[2].split(/[,\s]+/);
                for (var i in args)
                    args[i] = parseFloat(args[i]) || 0;
                if (args.length) {
//console.log('push', {fn: m[1], args: args});
                    transform.push({fn: m[1], args: args});
                }
            }
        } while (m);
    }
//console.log(transform[0],transform[1]);
//console.trace();
    return transform;
}
editor.elm_graphic.prototype.set_transform = function(tr_list) {
    if (tr_list) {
        var fn_list_rotate = [];
        var fn_list_translate = [];
        for (var i in tr_list) {
            var tr = tr_list[i];
            if ((tr.fn == 'translate') && ((tr.args[0] != 0) || (tr.args[1] != 0)))
                fn_list_translate.push('translate(' + (tr.args[0] || 0) + ',' + (tr.args[1] || 0) + ')');
            if ((tr.fn == 'rotate') && (tr.args[0] != 0)){
                // Convert empty values to zeros
                for (var j in tr.args)
                    tr.args[j] = tr.args[j] || 0;
                if (tr.args[0])
                    fn_list_rotate.push('rotate(' + tr.args.join(',') + ')');
            }
        }
/*
        fn_list.sort(function (a, b) {
            var a_fn = 
            if (a.fn == b.fn)
                return 0;
            else
                return a.fn == 'rotate' ? 1 : -1;
        });
*/
        var tr = ''
        if (fn_list_rotate.length && fn_list_translate.length) {
            // Set correct translations order
            // As result, rotating and shifting are independent: X always shifts horizontally, Y shifts vertically
            if (fn_list_rotate.length == 1)
                // Non-compensated rotation
                tr = [fn_list_translate.join(' '), fn_list_rotate[0]].join(' ');
            else
                // Compensated rotation
                tr = [fn_list_rotate[0], fn_list_rotate[1], fn_list_translate.join(' ')].join(' ');
        } else
            tr = [fn_list_rotate.join(' '), fn_list_translate.join(' ')].join(' ');

        if (tr.trim() !== '')
            this.element.setAttribute('transform', tr.trim());
        else
            this.element.removeAttribute('transform');
//console.log(this.element.getAttribute('transform'));
    } else
       this.element.removeAttribute('transform'); 
}


// Rotation transform
editor.elm_graphic.prototype.angle = function () {
    var tr_list = this.get_transform();
    for (var i in tr_list)
        if (tr_list[i].fn == 'rotate')
            return tr_list[i].args[0];
};
editor.elm_graphic.prototype.angle.set = function(val) {
    var tr_list = this.get_transform();
//console.log(tr_list[0],tr_list[1]);
    // Update transform function if exists
    var invert = 1;
    var updated_rotations = 0;
    var remove_rotation = -1;
    for (var i in tr_list)
        if (tr_list[i].fn == 'rotate') {
            tr_list[i].args[0] = parseFloat(val) * invert;
            // Non-first rotation is compensative one, so update it's center
            if ((tr_list[i].args.length > 1) && updated_rotations) {
                tr_list[i].args[1] = this.x || this.x1 || 0;
                tr_list[i].args[2] = this.y || this.y1 || 0;
            }
            updated_rotations++;
            // If there's second rotation, it compensates previous one(for rotated-but-horizontal text labels).
            // So, must use -angle value in second rotation.
            invert = invert * -1;
            if (!this.data_keep_angle && (updated_rotations > 1))
                remove_rotation = i;
        }
    if (remove_rotation > 0) {
//console.log(tr_list[0], tr_list[1]);
//console.log(remove_rotation);
        tr_list.splice(remove_rotation, 1);
//console.log(tr_list);
    }
    // If not updated existing - add as new
    if (!updated_rotations) {
        tr_list.push({fn:'rotate', args: [parseFloat(val)]});
    }
    if (this.data_keep_angle && (updated_rotations < 2) && (this.tag !== 'g'))
        // Compensate rotation
        tr_list.push({fn:'rotate', args: [-parseFloat(val), this.x || this.x1 || 0, this.y || this.y1 || 0]});
    this.set_transform(tr_list);
};

// Shift transformation
editor.elm_graphic.prototype.get_shift = function () {
    var tr_list = this.get_transform();
    for (var i in tr_list)
        if (tr_list[i].fn == 'translate')
            return tr_list[i].args;
}
editor.elm_graphic.prototype.set_shift = function(x, y) {
    var tr_list = this.get_transform();
    var updated = false;
    for (var i in tr_list)
        if (tr_list[i].fn == 'translate'){
            tr_list[i].args[0] = parseFloat(x) || 0;
            tr_list[i].args[1] = parseFloat(y) || 0;
            updated = true;
            break;
        }
    if (!updated)
        tr_list.push({fn: 'translate', args: [parseFloat(x) || 0, parseFloat(y) || 0]});
    this.set_transform(tr_list);
}
editor.elm_graphic.prototype.shift_x = function () {
    var shift = this.get_shift();
    return shift ? shift[0] : '';
};
editor.elm_graphic.prototype.shift_x.set = function(val) {
    var shift = this.get_shift();
    if (shift)
        shift[0] = val;
    else
        shift = [val, 0];
    this.set_shift(shift[0], shift[1]);
};
editor.elm_graphic.prototype.shift_y = function () {
    var shift = this.get_shift();
    return shift ? shift[1] : '';
};
editor.elm_graphic.prototype.shift_y.set = function(val) {
    var shift = this.get_shift();
    if (shift)
        shift[1] = val;
    else
        shift = [0, val];
    this.set_shift(shift[0], shift[1]);
};

// Visibility
editor.elm_graphic.prototype.visible = function () {
    return !(this.element.hasAttribute('visibility') && (this.element.getAttribute('visibility') == 'hidden'));
};
editor.elm_graphic.prototype.visible.set = function(val) {
    if (val)
        this.element.removeAttribute('visibility');
    else
        this.element.setAttribute('visibility', 'hidden');
};

// Opacity
editor.elm_graphic.prototype.opacity_perc = function () {
    if (this.element.hasAttribute('opacity')) {
        var val = parseFloat(this.element.getAttribute('opacity'));
        if (!isNaN(val))
            return _.round(val * 100, 0);
    }
    return 100;
};
editor.elm_graphic.prototype.opacity_perc.set = function(val) {
    var val = parseFloat(val);
    if(isNaN(val) || (val < 0))
        val = 100;
    if (val >= 100){
        this.element.removeAttribute('opacity');
    } else {
        this.element.setAttribute('opacity', val/100);
    }
};


// Shadow-inherited attributes, realized as computable properties.
// This type of inheritance works as a part of SVG specification, and do not need any special code.
// Following getters visualize this inheritance, if present.
editor.elm_graphic.prototype._inherited_size_attr_get = function(attrName) {
    return parseFloat(this.element.getAttribute(attrName) || this.parent_element.getAttribute(attrName)) || '';
}
editor.elm_graphic.prototype._inherited_size_attr_set = function(attrName, val) {
    if (!parseFloat(val)) {
        this.element.removeAttribute(attrName);
    } else
        this.element.setAttribute(attrName, parseFloat(val));
}
editor.elm_graphic.prototype._inherited_str_attr_get = function(attrName, defaultVal) {
    return this.element.getAttribute(attrName) || this.parent_element.getAttribute(attrName) || defaultVal;
}
editor.elm_graphic.prototype._inherited_str_attr_set = function(attrName, val) {
    if (!val) {
        this.element.removeAttribute(attrName);
    } else
        this.element.setAttribute(attrName, val);
}
// font-size
editor.elm_graphic.prototype.font_size_val = function () {
    return this._inherited_size_attr_get('font-size');
};
editor.elm_graphic.prototype.font_size_val.set = function(val) {
    return this._inherited_size_attr_set('font-size', val);
};
// stroke-width
editor.elm_graphic.prototype.stroke_width_val = function () {
    return this._inherited_size_attr_get('stroke-width');
};
editor.elm_graphic.prototype.stroke_width_val.set = function(val) {
    return this._inherited_size_attr_set('stroke-width', val);
};
// stroke
editor.elm_graphic.prototype.stroke_val = function () {
    return this._inherited_str_attr_get('stroke', '#000000');
};
editor.elm_graphic.prototype.stroke_val.set = function(val) {
    return this._inherited_str_attr_set('stroke', val);
};
// fill
editor.elm_graphic.prototype.fill_val = function () {
    return this._inherited_str_attr_get('fill', '');
};
editor.elm_graphic.prototype.fill_val.set = function(val) {
    return this._inherited_str_attr_set('fill', val);
};


// Class elm_line
// Extends elm_graphic

editor.elm_line = function(element) {
    var link_attributes = ['x1', 'y1', 'x2', 'y2'];
    // Merge with ancestor's @link_attributes if present
    this.link_attributes = this.link_attributes ? this.link_attributes.concat(link_attributes) : link_attributes;
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
}

editor.elm_line.prototype = Object.create(editor.elm_graphic.prototype);
editor.elm_line.prototype.constructor = editor.elm_line;

// Length (if changed, updates [x2,y2] point position)
editor.elm_line.prototype.line_length = function () {
//    console.log(this.x1, this.y1, this.x2, this.y2);
    this.x1 = parseFloat(this.x1);
    this.y1 = parseFloat(this.y1);
    this.x2 = parseFloat(this.x2);
    this.y2 = parseFloat(this.y2);
    var length = editor.calc.distance(this.x1, this.y1, this.x2, this.y2);
    return editor.units_round(length);
};
editor.elm_line.prototype.line_length.set = function(val) {
    val = parseFloat(val) || 1;
//    if (val <= 0) {
//        $.observable(this).setProperty("x2", this.x1);
//        $.observable(this).setProperty("y2", this.y1);
//        return;
//    }
    if (val <= 0)
        val = 1;

    this.x1 = parseFloat(this.x1);
    this.y1 = parseFloat(this.y1);
    this.x2 = parseFloat(this.x2);
    this.y2 = parseFloat(this.y2);
    var dist = editor.calc.distance(this.x1, this.y1, this.x2, this.y2);
    var cos = dist ? (this.x2 - this.x1) / dist : 0;
    var sin = dist ? (this.y2 - this.y1) / dist : 0;
    if (!cos && !sin) {cos=1;sin=-1;}
//    console.log(this.x1, this.y1, this.x2, this.y2, dist);
    var new_x2 = this.x1 + cos * val;
    var new_y2 = this.y1 + sin * val;
//    console.log(new_x2, new_y2, editor.calc.distance(this.x1, this.y1, new_x2, new_y2));
    $.observable(this).setProperty("x2", editor.units_round(new_x2, 2));
    $.observable(this).setProperty("y2", editor.units_round(new_y2, 2));
};
editor.elm_line.prototype.line_length.depends = ['x1', 'y1', 'x2', 'y2'];


// Class elm_path
// Extends elm_graphic

editor.elm_path = function(element) {
    var link_attributes = ['d'];
    // Merge with ancestor's @link_attributes if present
    this.link_attributes = this.link_attributes ? this.link_attributes.concat(link_attributes) : link_attributes;
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
}

editor.elm_path.prototype = Object.create(editor.elm_graphic.prototype);
editor.elm_path.prototype.constructor = editor.elm_path;


// Class elm_circle
// Extends elm_graphic

editor.elm_circle = function(element) {
    this.link_attributes = ['cx', 'cy', 'r'];
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
}
editor.elm_circle.prototype = Object.create(editor.elm_graphic.prototype);
editor.elm_circle.prototype.constructor = editor.elm_circle;


// Class elm_image
// Extends elm_graphic

editor.elm_image = function(element) {
    this.link_attributes = ['width', 'height'];
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
    $.observe(this, 'width', 'height', this.trigger_resize);
}
editor.elm_image.prototype = Object.create(editor.elm_graphic.prototype);
editor.elm_image.prototype.constructor = editor.elm_image;

editor.elm_image.prototype.trigger_resize = function(ev, eventArgs) {
//console.log(ev, )
    var _this = ev.target;
    var k = parseFloat(_this.element.getAttribute('data-original-width')) / parseFloat(_this.element.getAttribute('data-original-height'));
    var diff = parseFloat(eventArgs.oldValue) - parseFloat(eventArgs.value);
    if (eventArgs.path == 'width') {
//console.log(_this.x, diff, _this.x + diff / 2)
        $.observable(_this).setProperty('x', parseFloat(_this.x) + diff / 2);
        var new_val = editor.units_round(eventArgs.value / k, 2);
        if ((_this.height != new_val) && _this.preserve_aspect_ratio())
            $.observable(_this).setProperty('height', new_val);
    }
    if (eventArgs.path == 'height') {
        $.observable(_this).setProperty('y', parseFloat(_this.y) + diff / 2);
        var new_val = editor.units_round(eventArgs.value * k, 2);
        if ((_this.width != new_val) && _this.preserve_aspect_ratio())
            $.observable(_this).setProperty('width', new_val);
    }
};


editor.elm_image.prototype.preserve_aspect_ratio = function () {
    return !(this.element.getAttribute('preserveAspectRatio') === 'none');
}
editor.elm_image.prototype.preserve_aspect_ratio.set = function (val) {
    if (val)
        this.element.removeAttribute('preserveAspectRatio');
    else
        this.element.setAttribute('preserveAspectRatio', 'none');
    if (val) {
        var k = parseFloat(this.element.getAttribute('data-original-width')) / parseFloat(this.element.getAttribute('data-original-height'));
        var new_width = editor.units_round(this.height * k, 2);
        var new_height = editor.units_round(this.width / k, 2);
        if (new_width > this.width)
            $.observable(this).setProperty('height', new_height);
        else
            $.observable(this).setProperty('width', new_width);
    }
}

    
// Class elm_arc
// Extends elm_path

editor.elm_arc = function(element) {
    this.link_attributes = ['data-angle', 'data-r'];
    // Parent constructor
    editor.elm_path.apply(this, arguments);
}
editor.elm_arc.prototype = Object.create(editor.elm_path.prototype);
editor.elm_arc.prototype.constructor = editor.elm_arc;

// Arc path setter
editor.elm_arc.prototype.update_path = function () {
    var angle = parseFloat(this.data_angle);
    var r = parseFloat(this.data_r);
    var path = editor.calc.get_arc_path(0, 0, r, -angle/2, angle/2);
//    console.log(path)
    this.element.setAttribute('d', path);
};

// Arc Angle
editor.elm_arc.prototype.arc_angle = function () {
    return this.data_angle;
};
editor.elm_arc.prototype.arc_angle.set = function(angle) {
//console.log(angle);
    $.observable(this).setProperty('data_angle', angle || 0);
    this.update_path();
};

// Arc radius
editor.elm_arc.prototype.radius = function () {
    return this.data_r;
};
editor.elm_arc.prototype.radius.set = function(r) {
    $.observable(this).setProperty('data_r', r || 0);
    this.update_path();
};
//editor.elm_arc.prototype.arc_angle.depends = ['data_r'];


// Class elm_plate
// Extends elm_path

editor.elm_plate = function(element) {
    this.link_attributes = ['data-width', 'data-height', 'data-top-cut'];
    // Parent constructor
    editor.elm_path.apply(this, arguments);
    $.observe(this, 'data_width', 'data_height', 'data_top_cut', this.update_path);
}
editor.elm_plate.prototype = Object.create(editor.elm_path.prototype);
editor.elm_plate.prototype.constructor = editor.elm_plate;

// Plate path setter
editor.elm_plate.prototype.update_path = function(ev, eventArgs) {
    // Callback function. Using @ev.target instead of @this
    var model = ev.target;
    var width = model.data_width || 0;
    var height = model.data_height || 0;
    var top_cut = model.data_top_cut || 0;
    var d = 'M0 0 H -'+width/2+' V -'+Math.abs(height - top_cut)+' L -'+Math.abs(width/2 - top_cut)+' -'+height+' H '+Math.abs(width/2 - top_cut)+' L '+width/2+' -'+Math.abs(height - top_cut)+' V 0 Z';
    model.element.setAttribute('d', d);
};


// Class elm_supervisor_group
// Extends elm_graphic
// Abstract group, automatically creates and arranges it's children 

editor.elm_supervisor_group = function(element) {
//    this.link_attributes = ['data-r', 'data-angle', 'data-length'];
    var link_attributes = ['data-r', 'data-angle'];
    // Merge with ancestor's @link_attributes if present
    this.link_attributes = this.link_attributes ? this.link_attributes.concat(link_attributes) : link_attributes;
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
    $.observe(this, 'data_r', this.update_data_r);    
    $.observe(this, 'data_angle', this.update_data_angle);    
    $.observe(this, 'data_keep_angle', this.update_keep_angle);
}
editor.elm_supervisor_group.prototype = Object.create(editor.elm_graphic.prototype);
editor.elm_supervisor_group.prototype.constructor = editor.elm_supervisor_group;

editor.elm_supervisor_group.prototype.count_children.set = function (val) {
    var children_count_delta = 0;
    if (val < 0) val = 0;
    if (this.children_objs.length < val) {
        // Append new children
        while (this.children_objs.length < val) {
            // add_element() must be defined in ancestor class, as it creates different element types
            var idx = editor.vm.model.add_element(this.new_child_element());
            var new_obj = editor.vm.model.get(idx);
            $.observable(new_obj).setProperty('data_keep_angle', this.data_keep_angle);
//            $.observable(new_obj).setProperty('angle');
//            element.setAttribute('title', '#'+idx);
            children_count_delta++;
        }
    } else if (this.children_objs.length > val) {
        // Remove children
        while (this.children_objs.length > val) {
            var obj = this.children_objs.pop();
//console.log('-child');
//            obj.element.remove();
//            editor.vm.model.remove(obj.idx);
            editor.vm.model.delete(null, null, obj);
            children_count_delta--;
        }
    }

    if (children_count_delta)
        // Re-arrange children according to new count
        this.update_data_angle({target: this}, {value: this.data_angle});

}

editor.elm_supervisor_group.prototype.update_keep_angle = function(ev, eventArgs) {
    var _this = ev.target;
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        $.observable(child).setProperty("data_keep_angle", eventArgs.value);
    }
}

editor.elm_supervisor_group.prototype.update_data_angle = function(ev, eventArgs) {
    var _this = ev.target;
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var new_scale_angle = parseFloat(eventArgs.value);
        var new_child_angle = i * (new_scale_angle / (_this.children_objs.length-1)) - new_scale_angle/2;
        $.observable(child).setProperty("angle", new_child_angle);
//        $.observable(child).setProperty("data_keep_angle", _this.data_keep_angle || false);
//console.log('update_data_angle', _this.data_keep_angle);
    }
}


// Class elm_div_group
// Extends elm_supervisor_group

editor.elm_div_group = function(element) {
    this.link_attributes = ['data-length'];
    // Parent constructor
    editor.elm_supervisor_group.apply(this, arguments);
    $.observe(this, 'data_length', this.update_data_length);    
}
editor.elm_div_group.prototype = Object.create(editor.elm_supervisor_group.prototype);
editor.elm_div_group.prototype.constructor = editor.elm_div_group;

editor.elm_div_group.prototype.new_child_element = function() {
    var element = document.createElementNS(editor.ns_svg, 'line');
    this.element.appendChild(element);
    element.setAttribute('x1', 0);
    element.setAttribute('y1', -parseFloat(this.data_r));
    element.setAttribute('x2', 0);
    element.setAttribute('y2', -(parseFloat(this.data_r) + parseFloat(this.data_length)));
    return element;
}

editor.elm_div_group.prototype.update_data_r = function(ev, eventArgs) {
    var _this = ev.target;
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var r = parseFloat(eventArgs.value);
        // y1, y2 coordinates are negative usually
        var y1 = parseFloat(child.y1);
        var y2 = parseFloat(child.y2);
        var dy = y1 + r;
        var new_y1 = y1 - dy;
        var new_y2 = y2 - dy;
        $.observable(child).setProperty("y1", new_y1);
        $.observable(child).setProperty("y2", new_y2);
    }
}

// Update @line_length for all group's children
editor.elm_div_group.prototype.update_data_length = function(ev, eventArgs) {
    var _this = ev.target;
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var new_length = parseFloat(eventArgs.value);
        $.observable(child).setProperty("line_length", new_length);
    }
}


// Class elm_label_group
// Extends elm_supervisor_group

editor.elm_label_group = function(element) {
    this.link_attributes = ['data-label-start', 'data-label-step', 'font-size', 'font-weight'];
    // Parent constructor
    editor.elm_supervisor_group.apply(this, arguments);
    $.observe(this, 'data_label_start', this.update_labels_text);    
}
editor.elm_label_group.prototype = Object.create(editor.elm_supervisor_group.prototype);
editor.elm_label_group.prototype.constructor = editor.elm_label_group;

editor.elm_label_group.prototype.new_child_element = function() {
    var element = document.createElementNS(editor.ns_svg, 'text');
    this.element.appendChild(element);
    element.setAttribute('x', 0);
    element.setAttribute('y', -parseFloat(this.data_r));
    element.setAttribute('text-anchor', 'middle');
    element.setAttribute('dominant-baseline', 'central');
    element.setAttribute('stroke', 'none');
    element.setAttribute('data-keep-angle', this.data_keep_angle);
    element.innerText = this.get_label_text(this.children_objs.length);
    return element;
}

editor.elm_label_group.prototype.update_data_r = function(ev, eventArgs) {
    var _this = ev.target;
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var r = parseFloat(eventArgs.value);
        var y = parseFloat(child.y);
//        var dy = y + r;
//        var new_y = y1 - dy;
        $.observable(child).setProperty("y", -r);
    }
}

// Update all child labels' text according to start value and change step
editor.elm_label_group.prototype.update_labels_text = function(ev, eventArgs) {
    var _this = ev.target;
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        $.observable(child).setProperty("text", _this.get_label_text(i));
    }
}

// Get child label's text according to previous (or start) value and change step
editor.elm_label_group.prototype.get_label_text = function(idx) {
    var step = parseFloat(this.data_label_step) || 1;
    // Check if there's previous label
    if((idx-1) in this.children_objs) {
        var prev_value = parseFloat(this.children_objs[idx-1].text) || 0;
        return prev_value + step;
    }
    return (parseFloat(this.data_label_start) || 0) + idx * step;
}
