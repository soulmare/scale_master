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
    if (((name === '') || (typeof(name) === 'undefined')) && this.is_text_node && (typeof(this.text) !== 'undefined'))
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
        var link_attributes = ['font-size', 'font-family', 'fill'];
    else
        var link_attributes = ['title', 'stroke-width', 'stroke', 'fill'];
    link_attributes.push('data-keep-angle', 'x', 'y', 'opacity', 'data-anchor');
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
                fn_list_translate.push('translate(' + parseFloat(tr.args[0] || 0) + ',' + parseFloat(tr.args[1] || 0) + ')');
            if ((tr.fn == 'rotate') && parseFloat(tr.args[0])) {
                // Remove period from angle
                tr.args[0] = tr.args[0] % 360;
                if (tr.args[0] != 0) {
                    // Convert empty values to zeros
                    for (var j in tr.args)
                        tr.args[j] = tr.args[j] || 0;
                    if (tr.args[0])
                        fn_list_rotate.push('rotate(' + tr.args.join(',') + ')');
                }
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

        if (tr.trim() !== '') {
            this.element.setAttribute('transform', tr.trim());
        }else
            this.element.removeAttribute('transform');
    } else
       this.element.removeAttribute('transform'); 
}


// Rotation transform
editor.elm_graphic.prototype.angle = function () {
    var tr_list = this.get_transform();
    for (var i in tr_list)
        if ((tr_list[i].fn == 'rotate') && ((tr_list[i].args.length == 1) || (!tr_list[i].args[1] && !tr_list[i].args[2])))
            return _.round(tr_list[i].args[0], 4);
//            return tr_list[i].args[0];
};
editor.elm_graphic.prototype.angle.set = function(val, _this) {
    if (!_this)
        _this = this;
    var tr_list = _this.get_transform();

    // Remove current rotations if any
    var new_tr_list = [];
    for (var i in tr_list)
        if (tr_list[i].fn !== 'rotate')
            new_tr_list.push(tr_list[i]);

    // Set up new rotation(s)
    var angle = _.round(parseFloat(val) || 0, 4);
    var parent_angle = _this.parent_obj && _this.parent_obj.angle() ? _.round(parseFloat(_this.parent_obj.angle()) || 0, 4) : 0;
    var x = parseFloat(_this.x || _this.x1) || 0;
    var y = parseFloat(_this.y || _this.y1) || 0;
    if (angle) {
        // Add strict rotation
        new_tr_list.push({fn:'rotate', args: [angle]});
        // Add compensate rotation
        if ((_this.data_keep_angle == 'relative') && (_this.tag !== 'g'))
            new_tr_list.push({fn:'rotate', args: [-angle, x, y]});
    }
    
    if ((_this.data_keep_angle == 'absolute') && (parent_angle || angle) && (_this.tag !== 'g'))
        new_tr_list.push({fn:'rotate', args: [-parent_angle - angle, x, y]});
    
    if ((_this.data_keep_angle == 'invert') && (_this.tag !== 'g'))
        new_tr_list.push({fn:'rotate', args: [180, x, y]});
     
    _this.set_transform(new_tr_list);

    if (_this.tag === 'g')
        for (var i in _this.children_objs)
            _this.children_objs[i].angle.set(_this.children_objs[i].angle(), _this.children_objs[i]);

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
        var real_start_angle = parent.children_objs[0].angle_val() || 0;
        var real_end_angle = parent.children_objs[parent.children_objs.length-1].angle_val() || 0;
        var real_angle = real_end_angle - real_start_angle;
//        var real_angle = Math.abs(real_end_angle - real_start_angle);
        // If group angle differs from edge children's real position
        if (scale_angle != real_angle) {
            // Group must be rotated?
//            var rotation = _.round((real_start_angle + real_end_angle) / 2 - parseFloat(parent.angle()), 2);
            var rotation = _.round((real_start_angle + real_end_angle) / 2 + (parent.angle() || 0), 2);
            $.observable(parent).setProperty('angle', rotation || 0);
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
    if (!this.data_length) {
        this.x1 = parseFloat(this.x1);
        this.y1 = parseFloat(this.y1);
        this.x2 = parseFloat(this.x2);
        this.y2 = parseFloat(this.y2);
        var length = editor.calc.distance(this.x1, this.y1, this.x2, this.y2);
        if (this.y1 < this.y2)
            length = -length;
        $.observable(this).setProperty("data_length", length);
    }
    return this.data_length;
};
editor.elm_line.prototype.line_length.set = function(val) {
//console.log(val)
    val = parseFloat(val) || 0;
    var radius = this.parent_obj && this.parent_obj.data_r ? parseFloat(this.parent_obj.data_r) : 0;
//    val = parseFloat(val) || 1;
//    var invert = val > 0 ? 1 : -1;
//    var invert2 = ((val > 0) && (this.line_length() < 0)) || ((val < 0) && (this.line_length() > 0)) ? -1 : 1;

//    if (val <= 0)
//        val = 1;

    if (radius) {
        $.observable(this).setProperty("x1", 0);
        $.observable(this).setProperty("x2", 0);
        $.observable(this).setProperty("y1", -radius);
        $.observable(this).setProperty("y2", -radius - val);
//console.log(-radius, -radius - val)
    } else {
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
    }
//    this.element.setAttribute('data-length', val);
    $.observable(this).setProperty("data_length", val);
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
        var old_last_child = this.children_objs[this.children_objs.length-1];
        while (this.children_objs.length < val) {
            // add_element() must be defined in ancestor class, as it creates different element types
            var idx = editor.vm.model.add_element(this.new_child_element());
            var new_obj = editor.vm.model.get(idx);
            new_obj.element.setAttribute('data-is-new', 'true');
            $.observable(new_obj).setProperty('data_keep_angle', this.data_keep_angle);
//            $.observable(new_obj).setProperty('angle');
//            element.setAttribute('title', '#'+idx);
            children_count_delta++;
        }
        // Old last div is not edge any more, so remove it's anchor
        if (children_count_delta && old_last_child && old_last_child.data_anchor)
            $.observable(old_last_child).setProperty('data_anchor', false);
        if (this.update_child_objs)
            this.update_child_objs({target:this});
//            _.throttle(function () {this.update_child_objs({target:this})}, 30);
    } else if (this.children_objs.length > val) {
        // Remove children
        while (this.children_objs.length > val) {
            var obj = this.children_objs.pop();
//console.log('-child');
            editor.vm.model.delete(null, null, obj);
            children_count_delta--;
        }
    }
    
    for (var i in this.children_objs)
         this.children_objs[i].element.removeAttribute('data-is-new');

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
//console.log(new_start_angle, new_end_angle)
        $.observable(_this.children_objs[0]).setProperty("angle", new_start_angle);
        $.observable(_this.children_objs[points_count]).setProperty("angle", new_end_angle);
    }

    
    // Get anchored divs for interpolation
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
    this.link_attributes = ['data-length'];
    for (var i = 2; i<=editor.cfg.div_levels_count; i++) {
        this.link_attributes.push('data-lev'+i+'-each');
        this.link_attributes.push('data-lev'+i+'-length');
        this.link_attributes.push('data-lev'+i+'-stroke-width');
        this.link_attributes.push('data-lev'+i+'-stroke');
    }
    // Parent constructor
    editor.elm_supervisor_group.apply(this, arguments);
    $.observe(this, 'data_length', this.update_child_objs);
    for (var i = 2; i<=editor.cfg.div_levels_count; i++)
        $.observe(this, 'data_lev'+i+'_each', 'data_lev'+i+'_length', 'data_lev'+i+'_stroke_width', 'data_lev'+i+'_stroke', this.update_child_objs);
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
    element.setAttribute('data-length', parseFloat(this.data_length));
//console.log(element.getAttribute('data-length'))
    return element;
}

editor.elm_div_group.prototype.update_data_r = function(ev, eventArgs) {
    var _this = ev.target;
    var r = parseFloat(eventArgs.value);
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var new_y1 = -r;
        var new_y2 = -r - (child.line_length() || 0);
//        $.observable(this).setProperty("y1", -radius);
//        $.observable(this).setProperty("y2", -radius - val);
//console.log(new_y1, new_y2, child.line_length());
        $.observable(child).setProperty("y1", new_y1);
        $.observable(child).setProperty("y2", new_y2);
    }
}

editor.elm_div_group.prototype.update_child_objs = function(ev, eventArgs) {
    var _this = ev.target;
    var length = parseFloat(_this.data_length);

    var levn_data = [];
    for (var j = 2; j<=editor.cfg.div_levels_count; j++) {
        levn_data[j] = {
                each: parseInt(_this['data_lev'+j+'_each']),
                length: parseFloat(_this['data_lev'+j+'_length']),
                stroke_width: parseFloat(_this['data_lev'+j+'_stroke_width']),
                stroke: _this['data_lev'+j+'_stroke']
            };
    }
    
    for (var i in _this.children_objs) {
        var child = _this.children_objs[i];
        var div_length = length;
        var div_stroke_width = null;
        var div_stroke = null;
        for (var j = 2; j<=editor.cfg.div_levels_count; j++) {
            if (levn_data[j].each && !(i % levn_data[j].each)) {
                // Level 2 div
                if (!isNaN(levn_data[j].length))
                    div_length = levn_data[j].length;
                if (!isNaN(levn_data[j].stroke_width))
                    div_stroke_width = levn_data[j].stroke_width;
                if (levn_data[j].stroke)
                    div_stroke = levn_data[j].stroke;
            }
        }

//console.log(child.line_length(), div_length)
        var set_length_all = eventArgs && eventArgs.path.match(/length/);
        var set_length_current = child.element.getAttribute('data-is-new');
        if ((set_length_all || set_length_current) && (child.line_length() != div_length))
            $.observable(child).setProperty('line_length', div_length);

        if (typeof(div_stroke_width) == 'number') {
            if (child.element.getAttribute('stroke-width') != div_stroke_width)
                child.element.setAttribute('stroke-width', div_stroke_width);
        } else
            child.element.removeAttribute('stroke-width');

        if (div_stroke) {
            if (child.element.getAttribute('stroke') != div_stroke)
                child.element.setAttribute('stroke', div_stroke);
        } else
            child.element.removeAttribute('stroke');
        
//        $.observable(child).setProperty('y2', -parseFloat(_this.data_r || 0));
//        $.observable(child).setProperty('y1', -parseFloat(_this.data_r || 0) - div_length);
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
//    element.setAttribute('dominant-baseline', 'central');
    element.setAttribute('dy', '0.3em');
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
