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
    name = name.substring(0, 100);
    if (this.data_anchor)
        name = '[' + $.i18n('anchor') + '] ' + name;
    return '[' + $.i18n('type_' + this.tag + '_' + this.type) + '] ' + name;
//    return '[' + this.element.nodeName + '] ' + name.substring(0, 100);
};
editor.elm.prototype.ext_title.depends = ['title', 'text', 'data_anchor'];

editor.elm.prototype.count_children = function () {
    return this.children_objs.length;
}


// Class el_text
// Extends elm

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
        var link_attributes = ['font-size', 'font-family', 'fill', 'data-anchor'];
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
    $.observe(this, 'data_anchor', this.trigger_anchor);
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
            return _.round(tr_list[i].args[0], 4);
//            return tr_list[i].args[0];
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
//console.log(this.data_keep_angle, this.data_keep_angle ? 1 : 0)
            this.data_keep_angle = (this.data_keep_angle === true) || (this.data_keep_angle === 'true');
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
    if (isNaN(parseFloat(val))) {
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
// font style
editor.elm_graphic.prototype.font_style_ext = function () {
    var style = [];
    if (this.element.getAttribute('font-weight') == 'bold')
        style.push('bold');
    if (this.element.getAttribute('font-style') == 'italic')
        style.push('italic');
    if (!style.length && (this.element.getAttribute('font-weight') == 'normal') && (this.element.getAttribute('font-style') == 'normal'))
        style.push('normal');
    return style.join('_');
};
editor.elm_graphic.prototype.font_style_ext.set = function(val) {
    switch (val) {
        case 'normal':
            this.element.setAttribute('font-weight', 'normal');
            this.element.setAttribute('font-style', 'normal');
            break;
        case 'bold':
            this.element.setAttribute('font-weight', 'bold');
            this.element.setAttribute('font-style', 'normal');
            break;
        case 'italic':
            this.element.setAttribute('font-weight', 'normal');
            this.element.setAttribute('font-style', 'italic');
            break;
        case 'bold_italic':
            this.element.setAttribute('font-weight', 'bold');
            this.element.setAttribute('font-style', 'italic');
            break;
        default:
            this.element.removeAttribute('font-weight');
            this.element.removeAttribute('font-style');
            break;
    }
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


editor.elm_graphic.prototype.is_first = function () {
    return !this.element.previousElementSibling;
}
editor.elm_graphic.prototype.is_last = function () {
    return !this.element.nextElementSibling;
}


editor.elm_graphic.prototype.angle_val = function() {
    return this.angle();
};
editor.elm_graphic.prototype.angle_val.set = function(val) {

    $.observable(this).setProperty("angle", val);
    
    // Check if parent group angle was updated
    var parent = this.parent_obj;
    var parent_updated = false;
    if (parent && parent.is_group && ((parent.type == 'div') || (parent.type == 'label'))) {
        // Get angle from parent group parameters
        var scale_angle = parseFloat(parent.data_angle);
        var start_angle = - parseFloat(scale_angle)/2;
        var end_angle = start_angle + scale_angle;
        // Get the real angle as delta between first and last child divs
        var real_start_angle = parent.children_objs[0].angle_val();
        var real_end_angle = parent.children_objs[parent.children_objs.length-1].angle_val();
        var real_angle = real_end_angle - real_start_angle;
//console.log(real_angle, (real_start_angle + real_end_angle)/2, parent.angle())
        // If group angle differs from edge children's real position
        if (scale_angle != real_angle) {
            // Group must be rotated?
//            var rotation = _.round((real_start_angle + real_end_angle) / 2 - parseFloat(parent.angle()), 2);
            var rotation = _.round((real_start_angle + real_end_angle) / 2 + (parent.angle() || 0), 2);
//console.log('rotation', rotation)
            $.observable(parent).setProperty('angle', rotation || undefined);
            // Update group's angle value
            $.observable(parent).setProperty('data_angle', real_angle);
            parent_updated = true;
        }
//        if ((val < start_angle) || (val > end_angle))
//            return false;
        // Re-arrange neighbour divs in current group
        if (!parent_updated)
            parent.update_data_angle({target:parent});
    }

    if (!this.data_anchor)
        $.observable(this).setProperty('data_anchor', 'true');

};
editor.elm_graphic.prototype.angle_val.depends = ['angle'];

editor.elm_graphic.prototype.trigger_anchor = function(ev, eventArgs) {
    var _this = ev.target;
    // Re-arrange neighbour divs in current group
    var parent = _this.parent_obj;
    if (parent && parent.is_group)
        parent.update_data_angle({target:parent});
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
    var data_length = parseFloat(this.element.getAttribute('data-length')) || 0;
    var sign = data_length >= 0 ? 1 : -1;
    if (Math.abs(data_length) != length){
        this.element.setAttribute('data-length', Math.abs(data_length)*sign);
    }
    return editor.units_round(length*sign);
};
editor.elm_line.prototype.line_length.set = function(val) {
//console.log(val)
    val = parseFloat(val) || 0;
//    val = parseFloat(val) || 1;
//    var invert = val > 0 ? 1 : -1;
//    var invert2 = ((val > 0) && (this.line_length() < 0)) || ((val < 0) && (this.line_length() > 0)) ? -1 : 1;

//    if (val <= 0)
//        val = 1;

    this.x1 = parseFloat(this.x1);
    this.y1 = parseFloat(this.y1);
    this.x2 = parseFloat(this.x2);
    this.y2 = parseFloat(this.y2);
    var dist = editor.calc.distance(this.x1, this.y1, this.x2, this.y2);
    var cos = dist ? (this.x2 - this.x1) / dist : 0;
    var sin = dist ? (this.y2 - this.y1) / dist : 0;
    if (!cos && !sin) {sin=-1;cos=0;}
//console.log(val, sin, cos);
    
    if (val == 0) {
        if (this.line_length() > 0) {
            $.observable(this).setProperty("x2", this.x1);
            $.observable(this).setProperty("y2", this.y1);
        } else {
            $.observable(this).setProperty("x1", this.x2);
            $.observable(this).setProperty("y1", this.y2);
        }
    } else if (val > 0) {
        var new_x2 = this.x1 + cos * Math.abs(val);
        var new_y2 = this.y1 + sin * Math.abs(val);
        $.observable(this).setProperty("x2", editor.units_round(new_x2, 2));
        $.observable(this).setProperty("y2", editor.units_round(new_y2, 2));
    } else {
        var new_x1 = this.x2 - cos * Math.abs(val);
        var new_y1 = this.y2 - sin * Math.abs(val);
        $.observable(this).setProperty("x1", editor.units_round(new_x1, 2));
        $.observable(this).setProperty("y1", editor.units_round(new_y1, 2));
    }
    this.element.setAttribute('data-length', val);
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


// Class elm_rect
// Extends elm_graphic

editor.elm_rect = function(element) {
    this.link_attributes = ['width', 'height'];
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
    $.observe(this, 'width', 'height', this.trigger_resize);
}
editor.elm_rect.prototype = Object.create(editor.elm_graphic.prototype);
editor.elm_rect.prototype.constructor = editor.elm_rect;

// Centering when resize
editor.elm_rect.prototype.trigger_resize = function(ev, eventArgs) {
//console.log()
    var _this = ev.target;
    var diff = parseFloat(eventArgs.oldValue) - parseFloat(eventArgs.value);
    if (eventArgs.path == 'width') {
        $.observable(_this).setProperty('x', editor.units_round(_this.x || 0, 2) + diff / 2);
    }
    if (eventArgs.path == 'height') {
        $.observable(_this).setProperty('y', editor.units_round(_this.y || 0, 2) + diff / 2);
    }
};

editor.elm_rect.prototype.corners_radius = function () {
    return this.element.getAttribute('rx');
};
editor.elm_rect.prototype.corners_radius.set = function(val) {
    if (isNaN(parseFloat(val)) || (val < 0)) {
        this.element.removeAttribute('rx');
        this.element.removeAttribute('ry');
    } else {
        this.element.setAttribute('rx', parseFloat(val));
        this.element.setAttribute('ry', parseFloat(val));
    }
};


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

// Preserve aspect ratio and centering when resize
editor.elm_image.prototype.trigger_resize = function(ev, eventArgs) {
//console.log(ev, )
    var _this = ev.target;
    var k = parseFloat(_this.element.getAttribute('data-original-width')) / parseFloat(_this.element.getAttribute('data-original-height'));
    var diff = parseFloat(eventArgs.oldValue) - parseFloat(eventArgs.value);
    if (eventArgs.path == 'width') {
//console.log(_this.x, diff, _this.x + diff / 2)
        $.observable(_this).setProperty('x', editor.units_round(_this.x || 0, 2) + diff / 2);
        var new_val = editor.units_round(eventArgs.value / k, 2);
        if ((_this.height != new_val) && _this.preserve_aspect_ratio())
            $.observable(_this).setProperty('height', new_val);
    }
    if (eventArgs.path == 'height') {
        $.observable(_this).setProperty('y', editor.units_round(_this.y || 0, 2) + diff / 2);
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
    var link_attributes = ['data-r', 'data-angle', 'data-linearity-exponent', 'data-interpolation-method'];
    // Merge with ancestor's @link_attributes if present
    this.link_attributes = this.link_attributes ? this.link_attributes.concat(link_attributes) : link_attributes;
    // Parent constructor
    editor.elm_graphic.apply(this, arguments);
    $.observe(this, 'data_r', this.update_data_r);    
    $.observe(this, 'data_angle', 'data_linearity_exponent', 'data_interpolation_method', this.update_data_angle);    
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
        if (this.update_child_divs)
            this.update_child_divs({target:this});
//            _.throttle(function () {this.update_child_divs({target:this})}, 30);
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
    var new_scale_angle = parseFloat(_this.data_angle);
    var new_start_angle = - parseFloat(new_scale_angle)/2;
    var new_end_angle = new_start_angle + new_scale_angle;
    var points_count = _this.children_objs.length - 1;

    if (eventArgs && (eventArgs.path == 'data_linearity_exponent')) {
        // Unfix any fixed divs if setting exponent
        for (var i = 0; i <= points_count; i++) {
            var child = _this.children_objs[i].element;
            if (_this.children_objs[i].data_anchor)
                $.observable(_this.children_objs[i]).setProperty("data_anchor");
        }
    }
    
    // Set first and last div's angle
    if (_this.children_objs.length) {
        $.observable(_this.children_objs[0]).setProperty("angle", new_start_angle);
        $.observable(_this.children_objs[points_count]).setProperty("angle", new_end_angle);
    }

    
    // Get "fixed" divs for interpolation
    var fixed_divs_angles = [];
    var fixed_divs_indexes = [];
    for (var i = 0; i <= points_count; i++) {
        var child = _this.children_objs[i];
        // First and last div is always "fixed"
        if (child.data_anchor || !i || (i == points_count)) {
/*
            if ((child.angle() > new_end_angle) || (child.angle() < new_start_angle)) {
                // Unfix div if it is out of range
                child.element.removeAttribute('data-anchor');
            } else {
                // ok, store fixed div in lists
                fixed_divs_angles.push(child.angle() || 0);
                fixed_divs_indexes.push(i);
            }
*/
            fixed_divs_angles.push(child.angle() || 0);
            fixed_divs_indexes.push(i);
        }
    }
//console.log(fixed_divs_angles)
//console.log(fixed_divs_indexes)
    
    // We need at least 3 points to interpolate
    if (fixed_divs_angles.length >= 3) {
        
        var int_opts = {};
        switch (_this.data_interpolation_method) {
            case 'cubic':
                int_opts.method = Smooth.METHOD_CUBIC;
//                int_opts.cubicTension = Smooth.CUBIC_TENSION_CATMULL_ROM;
//                int_opts.cubicTension = 0.1; // 0...1
                break;
            case 'sinc':
                int_opts.method = Smooth.METHOD_SINC;
                int_opts.sincFilterSize = 2;
                int_opts.sincWindow = function(x) { return Math.exp(-x * x); };
                break;
            case 'lanczos':
                int_opts.method = Smooth.METHOD_LANCZOS;
                break;
            case 'linear':
            default:
                int_opts.method = Smooth.METHOD_LINEAR;
        }
        
        var fn_interpolate = Smooth(fixed_divs_angles, int_opts);
        for (var i = 0; i <= points_count; i++)
            // Interpolating all non-fixed divs
            if (fixed_divs_indexes.indexOf(i) === -1) {
                var child = _this.children_objs[i];
                // Detect interpolation range for current div.
                // Range is a pair of two closest fixed divs - one is before, and second is after our div.
                var j = 0;
                while ((j in fixed_divs_indexes) && (fixed_divs_indexes[j] < i))
                    j++;
                var range_left = fixed_divs_indexes[j-1];
                var range_right = fixed_divs_indexes[j];
                // Get div's relative position in this range
                var pos = (i - range_left) / (range_right - range_left);
                // Get interpolated angle
                var new_child_angle = _.round(fn_interpolate(j - 1 + pos), 5);
                // Check for getting out of bounds
                new_child_angle = Math.min(new_child_angle, new_end_angle);
                new_child_angle = Math.max(new_child_angle, new_start_angle);
//                console.log(i, j, [range_left, range_right], pos, child.angle(), new_child_angle);
                $.observable(child).setProperty("angle", new_child_angle);
            }
    } else {
        
        // No interpolation. Use auto angle arrange algorhytm

        var exp = parseFloat(_this.data_linearity_exponent) || 1;
    //    var k = parseFloat(_this.data_k) || 0;
        var k = 0;
    //console.log(exp)
        var k_angle = new_scale_angle / (Math.pow(points_count, exp) + k * points_count);
        for (var i = 0; i <= points_count; i++) {
            var child = _this.children_objs[i];
            var new_child_angle = (Math.pow(i, exp) + k * i) * k_angle + new_start_angle;
            $.observable(child).setProperty("angle", new_child_angle);
    //console.log(i, new_child_angle-new_start_angle)
        }
        
    }
    
}


editor.elm_supervisor_group.prototype.anchors_count = function() {
    var count = 0;
    for (var i in this.children_objs) {
        var child = this.children_objs[i].element;
        if (this.children_objs[i].data_anchor)
            count++;
    }
    return count;
}

editor.elm_supervisor_group.prototype.reset_children_position = function(ev, eventArgs) {
//console.log(ev, eventArgs, eventArgs.linkCtx.elem)
    $(eventArgs.linkCtx.elem).hide();
    for (var i in this.children_objs) {
        var child = this.children_objs[i].element;
        if (this.children_objs[i].data_anchor)
            $.observable(this.children_objs[i]).setProperty("data_anchor");
    }
//    $.observable(this).setProperty("anchors_count", 0);
};


/*
editor.elm_supervisor_group.prototype.update_data_angle = function(ev, eventArgs) {
    var _this = ev.target;
    var new_scale_angle = _this.data_angle;
    var new_start_angle = - new_scale_angle/2;
    var points_count = _this.children_objs.length - 1;
    var exp = parseFloat(_this.data_linearity_exponent) || 1;
//    var k = parseFloat(_this.data_k) || 0;
    var k = 0;
//console.log(exp)
    var k_angle = new_scale_angle / (Math.pow(points_count, exp) + k * points_count);
    for (var i = 0; i <= points_count; i++) {
        var child = _this.children_objs[i];
        var new_child_angle = (Math.pow(i, exp) + k * i) * k_angle + new_start_angle;
        $.observable(child).setProperty("angle", new_child_angle);
//console.log(i, new_child_angle-new_start_angle)
    }
}
*/


//editor.vm.model.objects[11].update_data_angle({target:editor.vm.model.objects[11]})
//editor.vm.model.selected_object.update_data_angle({target:editor.vm.model.selected_object})


// Class elm_div_group
// Extends elm_supervisor_group

editor.elm_div_group = function(element) {
    this.link_attributes = ['data-length', 'data-lev2-each', 'data-lev2-length', 'data-lev2-stroke-width'];
    // Parent constructor
    editor.elm_supervisor_group.apply(this, arguments);
    $.observe(this, 'data_length', 'data_lev2_each', 'data_lev2_length', 'data_lev2_stroke_width', this.update_child_divs);
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
    var r = parseFloat(eventArgs.value);
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        // y1, y2 coordinates are negative usually
        var y1 = parseFloat(child.y1);
        var y2 = parseFloat(child.y2);
        var dy = y1 + r;
//        var dy = Math.min(y1, y2) + r;
        var new_y1 = y1 - dy;
        var new_y2 = y2 - dy;
        $.observable(child).setProperty("y1", new_y1);
        $.observable(child).setProperty("y2", new_y2);
    }
}

editor.elm_div_group.prototype.update_child_divs = function(ev, eventArgs) {
    var _this = ev.target;
    var length = parseFloat(_this.data_length);
    var lev2_each = parseInt(_this.data_lev2_each);
    var lev2_length = parseFloat(_this.data_lev2_length);
    var lev2_stroke_width = parseFloat(_this.data_lev2_stroke_width);
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var div_length = length;
        var div_stroke_width = null;
        if (lev2_each && !(i % lev2_each)) {
            // Level 2 div
            if (!isNaN(lev2_length))
                div_length = lev2_length;
            if (!isNaN(lev2_stroke_width))
                div_stroke_width = lev2_stroke_width;
        }
        if (div_stroke_width)
            child.element.setAttribute('stroke-width', div_stroke_width);
        else
            child.element.removeAttribute('stroke-width', div_stroke_width);
        $.observable(child).setProperty('line_length', div_length);
//console.log(div_length)
    }
}


// Class elm_label_group
// Extends elm_supervisor_group

editor.elm_label_group = function(element) {
    this.link_attributes = ['data-label-start', 'data-label-step', 'font-size', 'font-family'];
    // Parent constructor
    editor.elm_supervisor_group.apply(this, arguments);
    $.observe(this, 'data_label_start', 'data_label_step', this.update_labels_text);    
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


// Class elm_circlecnt
// Extends elm_path

editor.elm_circlecnt = function(element) {
    this.link_attributes = ['data-cx', 'data-cy', 'data-r'];
    // Parent constructor
    editor.elm_path.apply(this, arguments);
    $.observe(this, 'data_cx', 'data_cy', 'data_r', this.update_path);
}
editor.elm_circlecnt.prototype = Object.create(editor.elm_path.prototype);
editor.elm_circlecnt.prototype.constructor = editor.elm_circlecnt;

// Plate path setter
editor.elm_circlecnt.prototype.update_path = function(ev, eventArgs) {
    var _this = ev.target;
    var cx = _this.data_cx || 0;
    var cy = _this.data_cy || 0;
    var r = _this.data_r || 0;
//    var d = 'M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0M 0 -10 V 10 M-10 0 H 10 0';
    var d = 'M'+(cx-r)+','+cy+'a'+r+','+r+' 0 1,0 '+r*2+',0a'+r+','+r+' 0 1,0 -'+r*2+',0M'+cx+' '+(cy-r)+' V'+(cy+r)+' M'+(cx-r)+' '+cy+' H'+(cx+r);
    _this.element.setAttribute('d', d);
};
