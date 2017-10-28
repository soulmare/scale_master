/*
 * editor.js
 * Scale Master
 * JavaScript driven, all client-side browser application,
 * creates printable vector scale faces for DIY meters etc.
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2017 Alexander Bolohovetsky
 *
 * Some functions came from SVG Edit project: https://github.com/SVG-Edit/svgedit
 *
 */

editor = {};
(function() {

        // Editor default configuration
		var defaultConfig = {
				zoom: {
                    initial: 1.0,
                    min: 0.1,
                    max: 10,
                    delta: 0.2,
                },
                units: {
                    name: 'mm',//px|mm|cm
                    // Current units conversion koefficient
                    conversion_k: null, // set in init()
                    type_map: null // set in init()
                },
                // Mouse button, used for drag scrolling
                // 0 - main button; 1 - wheel button; 2 - context menu button
                drag_scroll_btn: 0,
                rulers: {
                    stroke_style: 'rgba(255,255,255,0.8)',
                    // Vertical ruler labels orientation
                    // 0 - vertical text
                    // 1 - rotated counterclockwise
                    // 2 - rotated clockwise
                    vertical_labels_mode: 2
                },
                // Origin position
                // 0 - document topleft corner
                // 1 - scale center
                document_origin_mode: 1,
                styles: {
                    font_family: 'Arial',
                    font_size: 4,
                    objects_color: '#000000',
//                    background_color: '#ffffff',
                    stroke_width: 0.3
                },
                size_round_digits: 4,
                language: 'en',
                new_item: {
                    items_count: 5,
                    label_text: '',
                    length: 100,
                    r: 50,
                    angle: 85,
                    size: 100,
                    font_size: 4,
                    stroke_width: 0.3
                }
            };
    
//        editor.svg_observe_attrs = {
//            '*': ['transform', 'title', 'stroke', 'stroke-width']
//        }
//    'x1', 'y1', 'x2', 'y2', 'd', '', ''];
    
    
        // Document coordinates origin position, in workspace pixels. Depends of current zoom value
        editor.document_origin = [0, 0];

        // Paper sizes in pixels 96 ppi
        editor.image_sizes = {
            'A3': [1123,1587],
            'A4': [794,1123],
            'A5': [559,794],
            'A6': [397,559],
            'A7': [280,397]
        };
    
    
        editor.ns_svg = 'http://www.w3.org/2000/svg';

    
        editor.init = function () {
            
            // Load stored configuration
            var cfg = localStorage.getItem("cfg");
            if (cfg) {
                try {
                    editor.cfg = JSON.parse(cfg);
                    // Populate stored configuration with non existing fields
                    for (var field in defaultConfig)
                        if (editor.cfg[field] === undefined)
                            editor.cfg[field] = defaultConfig[field];
                } catch(e) {
                    editor.cfg = defaultConfig;
                }
            } else {
                editor.cfg = defaultConfig;
                // Auto-detect language on user's first visit
                var language = navigator.language || navigator.userLanguage || '';
                if (language) {
                    var langcode = language.match(/^\w+/);
                    if (langcode) {
                        langcode = langcode[0].toLowerCase();
                        if (langcode === 'uk')
                            langcode = 'ru';
                        if (['en', 'ru'].indexOf(langcode) >= 0)
                            editor.cfg.language = langcode;
                    }
                }
            }
            editor.zoom = editor.cfg.zoom.initial;
            
            $('.app_name .version').html(APP_VERSION);
            $('.app_name .type').html(APP_VERSION_TYPE).addClass(APP_VERSION_TYPE);
            
            editor.localize();
            
            editor.init_dropdowns();

            // DOM shortcuts
            editor.workspace = document.getElementById('workspace');
            editor.document = document.getElementById('svg_doc');

            editor.set_units();
            
            editor.set_zoom();
            
        //$('#editor_viewport').scrollLeft(150).scrollTop(100);
        //setTimeout(function(){set_zoom(2, [200,50]);},2000);
        //setTimeout(function(){set_zoom(4, [200,50]);},4000);

            editor.bind_listeners();

            editor.vm.init();

            var svg_str_stored = localStorage.getItem('svg_doc');
            if (svg_str_stored){
//                console.log(svg_str_stored.length);
//                svg_str_stored = '<sv'+svg_str_stored;
                editor.vm.model.enable_templates(false);
                if (!editor.load_svg_string(svg_str_stored))
                    editor.open_url('svg/new_scale.svg');
                editor.vm.model.enable_templates(true);
            }else
                editor.open_url('svg/new_scale.svg');
            
            
//            editor.open_url('svg/M4200_69X60_20V.svg');
//            editor.open_url('svg/example_compass.svg');
//            editor.open_url('svg/test_multiscale_2.svg');
            
//            editor.vm.load_svg();
            
//            $(function() {
//                $('#elements_tree').tree({
//                    data: data,
//                    saveState: 'my-tree',
//                    dragAndDrop: true,
//                    autoOpen: 0
//                });
//            });

            
        }

        
        editor.bind_listeners = function () {

            // Drag scroll

            var clicked = false, clickY, clickX;
            $('#editor_viewport').on({
                'mousemove': function(e) {
        //$('h1').text(' zoom:'+editor.zoom+' scroll:['+$('#editor_viewport').scrollLeft()+','+$('#editor_viewport').scrollTop()+'] pos:['+(e.originalEvent.pageX - $(editor.workspace).offset().left)+','+(e.originalEvent.pageY - $(editor.workspace).offset().top)+']');
                    if (clicked) {
                        $('#workspace').css('cursor', 'all-scroll');
                        $('#editor_viewport').scrollTop($('#editor_viewport').scrollTop() + (clickY - e.clientY));
                        clickY = e.clientY;
                        $('#editor_viewport').scrollLeft($('#editor_viewport').scrollLeft() + (clickX - e.clientX));
                        clickX = e.clientX;                        
                    }
                },
                'mousedown': function(e) {
                    if (e.button != editor.cfg.drag_scroll_btn) return; // ignore other buttons
                    clicked = true;
                    clickY = e.clientY;
                    clickX = e.clientX;
                },
                'mouseup': function(e) {
                    if (e.button != editor.cfg.drag_scroll_btn) return; // ignore other buttons
                    clicked = false;
                    $('#workspace').css('cursor', 'auto');
                },
                'mouseleave': function() {
                    clicked = false;
                    $('#workspace').css('cursor', 'auto');
                }
            });
            // Disable default drag'n'drop behaviour in Firefox, as it breaks our drag-scroll sometimes
            $('#editor_viewport').on("dragstart", function() {
                 return false;
            });    

            // Display mouse pointer coordinates
            var on_workspace_mousemove = function(e) {
                var point = editor.coords_mouse_event_to_document(e.originalEvent);
                var dig_after_zero = editor.zoom * editor.cfg.units.conversion_k > 1 ? 1 : 0;
                if (editor.zoom * editor.cfg.units.conversion_k > 8)
                    dig_after_zero = 2;
                if (editor.zoom * editor.cfg.units.conversion_k > 14)
                    dig_after_zero = 3;
                if (editor.cfg.document_origin_mode == 1)
                    point[1] = -point[1];
                $('#tools_pan label#coords .x .val').text(_.round(point[0], dig_after_zero));
                $('#tools_pan label#coords .y .val').text(_.round(point[1], dig_after_zero));
            };
            $('#workspace').bind('mousemove', _.debounce(on_workspace_mousemove, 80, {leading: true, maxWait:80}));
        //    $('#workspace').bind('mousemove', on_workspace_mousemove);

            // Update rulers on resize (?)
//            $(window).resize(_.debounce(update_rulers, 300, {maxWait:300}));

            // Scroll rulers
            $('#editor_viewport').bind('scroll', function(e){
                $('#ruler_x_canvas').css('left', -$(this).scrollLeft());
                $('#ruler_y_canvas').css('top', -$(this).scrollTop());
            });

            // Zoom change events
            
            set_zoom_debounced = _.debounce(function (new_zoom, center_point) {editor.set_zoom(new_zoom, center_point)}, 100, {leading: true, maxWait:100});
            
            // Dispatch zoom input
            $('input[type=number][name=zoom]').bind('input', function (e) {
//                console.log($(this).val());
                var zoom_perc = parseFloat($(this).val());
                if (!isNaN(zoom_perc) && (zoom_perc > 0))
                    set_zoom_debounced(zoom_perc/100);
            });


            // Dispatch Ctrl+"+"/Ctrl+"-" zoom
            $(document).bind('keydown', function (e) {
                if (e.ctrlKey) {
                    if (e.which == 107) {
                        set_zoom_debounced(editor.zoom*(1+editor.cfg.zoom.delta));
                        e.preventDefault();
                    }
                    if (e.which == 109) {
                        set_zoom_debounced(editor.zoom*(1-editor.cfg.zoom.delta));
                        e.preventDefault();
                    }
                }
            });
            
            // Dispatch Ctrl+wheel (zoom), Shift+wheel (x-scroll) on workspace
            $(editor.workspace).bind('mousewheel DOMMouseScroll', function (e) {
                // Firefox: Shift+wheeling does horizontal scroll, not history
                if (e.shiftKey && ('undefined' === typeof (e.originalEvent.wheelDelta))) {
                    e.preventDefault();
                    $('#editor_viewport').scrollLeft($('#editor_viewport').scrollLeft() + e.originalEvent.detail*$('#editor_viewport').width()*0.02);
                }
                // Ctrl+wheel scrolling - change zoom
                if (e.ctrlKey) {
                    e.preventDefault();
                    var delta = e.originalEvent.wheelDelta || -e.originalEvent.detail;
                    var center_point = [0, 0];
                    set_zoom_debounced(delta > 0 ? editor.zoom*(1+editor.cfg.zoom.delta) : editor.zoom*(1-editor.cfg.zoom.delta), editor.coords_mouse_event_to_document(e.originalEvent));
                }
            });

            // Firefox: Prevent default Shift+wheeling behaviour on the whole document
            $(document).bind('mousewheel DOMMouseScroll', function (e) {
                if (e.shiftKey && ('undefined' === typeof (e.originalEvent.wheelDelta)))
                    e.preventDefault();
            });

/*
            // Dispatch touchpad zoom
            // :TODO: works incorrectly
            var scaling = false;
            var dist_start = null;
            $(editor.workspace).bind('touchstart', function (event) {
                var touch_start = 0;
                if (event.touches.length >= 2) {
                    scaling = true;
                    var touches = [event.originalEvent.touches[0] || event.originalEvent.changedTouches[0], event.originalEvent.touches[1] || event.originalEvent.changedTouches[1]];
                    dist_start = editor.calc.distance(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY);
                }
            });

            $(editor.workspace).bind('touchmove', function (event) {
//$('h1').text('end');
                if (scaling && (event.touches.length >= 2)) {
                    var touches = [event.originalEvent.touches[0] || event.originalEvent.changedTouches[0], event.originalEvent.touches[1] || event.originalEvent.changedTouches[1]];
                    var dist = editor.calc.distance(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY);
                    set_zoom_debounced(editor.zoom*((dist-dist_start)/dist_start), editor.coords_mouse_event_to_document(event.originalEvent));
                }
            });
            
            $(editor.workspace).bind('touchend', function (event) {
                if (scaling) {
                    scaling = false;
                }
            });
*/
            // Global hide dropdown menu
            $(document).bind('click', function () {
                $('.dropdown').hide();
            }).bind('keydown', function (event) {
                if (event.which == 27)
                    $('.dropdown').hide();
            });;

            // On window close
            window.onbeforeunload = function(e) {
                editor.save_config();
                localStorage.setItem('svg_doc', editor.svgToString());
            };            

            // Workspace keyboard actions
            $('#workspace').bind('keydown', function (e) {
//                console.log(e.which, e.ctrlKey, e.shiftKey);
                var delta = editor.units_to_px(e.ctrlKey ? 1 : 0.1);
                switch (e.which) {
                    case 37:
                        // left
                        if (editor.vm.model.selected_object) {
                            $.observable(editor.vm.model.selected_object).setProperty('shift_x', editor.units_round(editor.vm.model.selected_object.shift_x(), 1) - delta);
                            e.preventDefault();
                        }
                        break;
                    case 38:
                        // up
                        if (editor.vm.model.selected_object){
                            $.observable(editor.vm.model.selected_object).setProperty('shift_y', editor.units_round(editor.vm.model.selected_object.shift_y(), 1) - delta);
                            e.preventDefault();
                        }
                        break;
                    case 39:
                        // right
                        if (editor.vm.model.selected_object){
                            $.observable(editor.vm.model.selected_object).setProperty('shift_x', editor.units_round(editor.vm.model.selected_object.shift_x(), 1) + delta);
                            e.preventDefault();
                        }
                        break;
                    case 40:
                        // down
                        if (editor.vm.model.selected_object){
                            $.observable(editor.vm.model.selected_object).setProperty('shift_y', editor.units_round(editor.vm.model.selected_object.shift_y(), 1) + delta);
                            e.preventDefault();
                        }
                        break;
                    case 46:
                        // delete
                        if (editor.vm.model.selected_object)
                            editor.vm.model.delete(null, {change: 'click'});
                        break;
                }
            });
            
        }

        
        editor.trigget_objects_list_keydown = function (event) {
//console.log(event);return;
            switch (event.which) {
                case 46:
                    // delete
                    if (editor.vm.model.selected_object)
                        editor.vm.model.delete(null, {change: 'click'});
                    event.target.focus();
                    break;
            }
        };
        

        // Sets current units
        editor.set_units = function (units_name) {
            if ('undefined' !== typeof (units_name))
                editor.cfg.units.name = units_name;
            if (!editor.cfg.units.type_map) {
                svgedit.units.init();
                editor.cfg.units.type_map = svgedit.units.getTypeMap();
            }
            editor.cfg.units.conversion_k = editor.cfg.units.type_map[editor.cfg.units.name];
        }

        
        editor.set_zoom = function (new_zoom, zoom_center_point) {
            if ('undefined' === typeof (new_zoom))
                new_zoom = editor.zoom;

            var real_width = parseFloat($(editor.document).attr('data-width'));
            var real_height = parseFloat($(editor.document).attr('data-height'));

            var old_zoom = editor.zoom;
            if (!zoom_center_point) {
                // Viewport center is zoom default center point
                var zoom_center_point = editor.coords_visible_to_document([
                    $('#editor_viewport').scrollLeft()+$('#editor_viewport').width()/2,
                    $('#editor_viewport').scrollTop()+$('#editor_viewport').height()/2]);
            }

            var old_ctr = editor.coords_document_to_visible(zoom_center_point, old_zoom);
            var old_scroll_left = $('#editor_viewport').scrollLeft();
            var old_scroll_top = $('#editor_viewport').scrollTop();

            // Apply constraints on new zoom value
            editor.zoom = Math.min(editor.cfg.zoom.max, Math.max(editor.cfg.zoom.min, new_zoom));
            
            $('input[type=number][name=zoom]').val(_.round(editor.zoom*100,2));
//console.log('ZOOM', editor.zoom, zoom_center_point)

            // Resize page
            var display_width = real_width * editor.zoom;
            var display_height = real_height * editor.zoom;
            $(editor.document).attr('width', display_width);
            $(editor.document).attr('height', display_height);
            $(editor.document).attr('viewBox', [0, 0, real_width, real_height].join(' '));

            // Resize workspace
            $(editor.workspace).width($(editor.document).width() * 1.5);
            $(editor.workspace).height($(editor.document).height() * 1.5);

            // Center page on workspace
            $(editor.document).css('left', $('#workspace').width()/2-$(editor.document).width()/2);
            $(editor.document).css('top', $('#workspace').height()/2-$(editor.document).height()/2);
//            $(editor.document).attr('x', $('#workspace').width()/2-$(editor.document).width()/2);
//            $(editor.document).attr('y', $('#workspace').height()/2-$(editor.document).height()/2);

            if (editor.document) {
                if (!editor.cfg.document_origin_mode) {
                    // Set workspace origin to page's top left corner
                    editor.document_origin = [parseFloat($(editor.document).css('left').match(/[\d\.]+/)[0]), parseFloat($(editor.document).css('top').match(/[\d\.]+/)[0])];
                } else {
                    // Origin to the page center
                    editor.document_origin = [parseFloat($(editor.document).css('left').match(/[\d\.]+/)[0])+$(editor.document).width()/2, parseFloat($(editor.document).css('top').match(/[\d\.]+/)[0])+$(editor.document).height()/2];
                }
            } else
                editor.document_origin = [0, 0];

            // Scroll to leave centering point at constant position
            if (editor.zoom != old_zoom) {
                var new_ctr = editor.coords_document_to_visible(zoom_center_point);
                $('#editor_viewport').scrollLeft(new_ctr[0] - old_ctr[0] + old_scroll_left);
                $('#editor_viewport').scrollTop(new_ctr[1] - old_ctr[1] + old_scroll_top);
            }

            // Redraw rulers
            editor.update_rulers();

        }

        
        // Redraw rulers
        // Source: SVG Edit
        editor.update_rulers = function (rulers_zoom) {
            var zoom = ('undefined' === typeof (rulers_zoom)) ? editor.zoom : rulers_zoom;
            var scanvas = $(editor.workspace);

            var d, i;
            var limit = 30000;
            var unit = editor.cfg.units.conversion_k;
            var RULER_HEIGHT = 20;

            // draw x ruler then y ruler
            for (d = 0; d < 2; d++) {
                var isX = (d === 0);
                var dim = isX ? 'x' : 'y';
                var lentype = isX ? 'width' : 'height';
                var rulerOrigin = isX ? editor.document_origin[0] : editor.document_origin[1];

                var $hcanv_orig = $('#ruler_' + dim + ' canvas:first');

                // Bit of a hack to fully clear the canvas in Safari & IE9
                var $hcanv = $hcanv_orig.clone();
                $hcanv_orig.replaceWith($hcanv);

                var hcanv = $hcanv[0];

                // Set the canvas size to the width of the container
                var ruler_len = scanvas[lentype]();
                var total_len = ruler_len;
        //        hcanv.parentNode.style[lentype] = total_len + 'px';
                var ctx_num = 0;
                var ctx = hcanv.getContext('2d');
        //        ctx.clearRect(0, 0, hcanv.width, hcanv.height);
                var ctx_arr, num, ctx_arr_num;

                //ctx.fillStyle = 'rgb(200,0,0)';
                //ctx.fillRect(0, 0, hcanv.width, hcanv.height);

                // Remove any existing canvasses
                $hcanv.siblings().remove();

                // Create multiple canvases when necessary (due to browser limits)
                if (ruler_len >= limit) {
                    ctx_arr_num = parseInt(ruler_len / limit, 10) + 1;
                    ctx_arr = [];
                    ctx_arr[0] = ctx;
                    var copy;
                    for (i = 1; i < ctx_arr_num; i++) {
                        hcanv[lentype] = limit;
                        copy = hcanv.cloneNode(true);
                        hcanv.parentNode.appendChild(copy);
                        ctx_arr[i] = copy.getContext('2d');
                    }

                    copy[lentype] = ruler_len % limit;

                    // set copy width to last
                    ruler_len = limit;
                }

                hcanv[lentype] = ruler_len;

                var u_multi = unit * zoom;

                // Make [1,2,5] array
                r_intervals = [];
                for (var i = 0.1; i < 1E5; i *= 10) {
                    r_intervals.push(i);
                    r_intervals.push(2 * i);
                    r_intervals.push(5 * i);
                }

                // Calculate the main number interval
        // Interval must be (near?) 50px
                var raw_m = 50 / u_multi;
                var multi = 1;
                for (i = 0; i < r_intervals.length; i++) {
                    num = r_intervals[i];
                    multi = num;
                    if (raw_m <= num) {
                        break;
                    }
                }

                var big_int = multi * u_multi;
                var font_size = 9;
                ctx.font = font_size + 'px sans-serif';
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';

                var ruler_d = ((rulerOrigin / u_multi) % multi) * u_multi;
                var label_pos = ruler_d - big_int;
                // draw big intervals
                while (ruler_d < total_len) {
                    label_pos += big_int;
                    // var real_d = ruler_d - rulerOrigin; // Currently unused

                    var cur_d = Math.round(ruler_d) + 0.5;
                    if (isX) {
                        ctx.moveTo(cur_d, RULER_HEIGHT);
                        ctx.lineTo(cur_d, 0);
                    }
                    else {
                        ctx.moveTo(RULER_HEIGHT, cur_d);
                        ctx.lineTo(0, cur_d);
                    }

                    num = (label_pos - rulerOrigin) / u_multi;
                    var label;
                    if (multi >= 1) {
                        label = Math.round(num);
                    }
                    else {
                        var decs = String(multi).split('.')[1].length;
                        label = num.toFixed(decs);
                    }

                    // Invert Y axe if needed
                    if (!isX && (editor.cfg.document_origin_mode == 1))
                        label = -label;

                    // Change 1000s to Ks
                    if (label !== 0 && label !== 1000 && label % 1000 === 0) {
                        label = (label / 1000) + 'K';
                    }

                    if (isX) {
                        ctx.fillText(label, ruler_d+2, 8);
                    } else {
                        // Y-ruler label
/*
                        if (editor.cfg.document_origin_mode == 1) {
                            if (String(label)[0] == '-')
                                label = String(label).slice(1);
                            else
                                label = '-'+String(label);
                        }
*/
                        if (editor.cfg.rulers.vertical_labels_mode == 0) {
                            // draw label vertically
                            var str = String(label).split('');
                            for (i = 0; i < str.length; i++) {
                                ctx.fillText(str[i], 1, (ruler_d+9) + i*9);
                            }
                        }
                        if (editor.cfg.rulers.vertical_labels_mode == 1) {
                            // Print text label (vertical)
                            ctx.save();
                            ctx.translate(1, ruler_d-3);
                            ctx.rotate(-Math.PI/2);
                            ctx.fillText(label, 0, font_size*0.8);
                            ctx.restore();
                        }
                        if (editor.cfg.rulers.vertical_labels_mode == 2) {
                            // Print text label (vertical)
                            ctx.save();
                            ctx.translate(1, ruler_d-3);
                            ctx.rotate(Math.PI/2);
                            ctx.fillText(label, font_size*0.7, -1);
                            ctx.restore();
                        }
                    }

                    var part = big_int / 10;
                    // draw the small intervals
                    for (i = 1; i < 10; i++) {
                        var sub_d = Math.round(ruler_d + part * i) + 0.5;
                        if (ctx_arr && sub_d > ruler_len) {
                            ctx_num++;
                            ctx.stroke();
                            if (ctx_num >= ctx_arr_num) {
                                i = 10;
                                ruler_d = total_len;
                                continue;
                            }
                            ctx = ctx_arr[ctx_num];
                            ruler_d -= limit;
                            sub_d = Math.round(ruler_d + part * i) + 0.5;
                        }

                        // odd lines are slighly longer
                        var line_num = (i % 2) ? 12 : 10;
                        if (isX) {
                            ctx.moveTo(sub_d, RULER_HEIGHT);
                            ctx.lineTo(sub_d, line_num);
                        } else {
                            ctx.moveTo(RULER_HEIGHT, sub_d);
                            ctx.lineTo(line_num, sub_d);
                        }
                    }
                    ruler_d += big_int;
                }

        //        if (isX)
        //            var grd = ctx.createLinearGradient(0, 0, 0, RULER_HEIGHT * 0.8);
        //        else
        //            var grd = ctx.createLinearGradient(0, 0, RULER_HEIGHT * 0.8, 0);
        //        grd.addColorStop(0, '#333');
        //        grd.addColorStop(1, '#ccc');
        //        ctx.strokeStyle = grd;
                ctx.stroke();
            }
        }


        editor.coords_mouse_event_to_document = function (pointer_event) {
            if (pointer_event.touches || pointer_event.changedTouches) {
                var touches = pointer_event.touches || pointer_event.changedTouches;
                if (touches.length >= 2) {
                    // Get middle point
                    var workspace_x = Math.abs(touches[0].clientX - touches[1].clientX) / 2 - $(editor.workspace).offset().left;
                    var workspace_y = Math.abs(touches[0].clientY - touches[1].clientY) / 2 - $(editor.workspace).offset().top;
//$('h1').text('touch x:'+workspace_x+' y:'+workspace_y);
                }
                
            } else {
                // Mouse event
                var workspace_x = pointer_event.pageX - $(editor.workspace).offset().left;
                var workspace_y = pointer_event.pageY - $(editor.workspace).offset().top;
            }
            return editor.coords_visible_to_document([workspace_x, workspace_y])
        }

        
        // Convert workspace pixel coordinates to document units coordinates
        editor.coords_visible_to_document = function (point, zoom_level/*default: editor.zoom*/) {
//console.log(point);
            zoom_level = ('undefined' === typeof (zoom_level)) ? editor.zoom : zoom_level;
            var new_point = [];
            for(var i in [0,1])
                new_point.push((point[i] - editor.document_origin[i]) / (zoom_level * editor.cfg.units.conversion_k));
            return new_point;
        }


        // Convert document units coordinates to workspace pixel coordinates
        editor.coords_document_to_visible = function (point, zoom_level/*default: editor.zoom*/) {
            zoom_level = ('undefined' === typeof (zoom_level)) ? editor.zoom : zoom_level;
            var new_point = [];
            for(var i in [0,1]) {
        //        document == (visible - editor.document_origin[i]) / (editor.zoom * editor.cfg.units.conversion_k);
        //        document * editor.zoom * editor.cfg.units.conversion_k == visible - editor.document_origin[i];
        //        visible == document * editor.zoom * editor.cfg.units.conversion_k + editor.document_origin[i];
        //console.log(point[i],zoom_level,editor.cfg.units.conversion_k,editor.document_origin[i])
                new_point.push(point[i] * zoom_level * editor.cfg.units.conversion_k + editor.document_origin[i]);
            }
            return new_point;
        }
        
        
        editor.open_url = function (url, callback) {
            $(editor.document).hide();
            $('#hdr_buttons button').attr('disabled', 'disabled');
            editor.vm.model.enable_templates(false);
            $.ajax({
                url: url,
                dataType: 'text',
                cache: false,
                complete: function() {
                    $('#hdr_buttons button').removeAttr('disabled');
                    editor.vm.model.enable_templates(true);
                },
                success: function(str) {
                    editor.load_svg_string(str, callback);
                },
                error: function(xhr, stat, err) {
                    alert('Failed loading URL: \n' + err);
//                    if (xhr.status != 404 && xhr.responseText) {
//                        loadSvgString(xhr.responseText, cb);
//                    } else {
//                        $.alert(uiStrings.notification.URLloadFail + ': \n' + err, cb);
//                    }
                }
            });
        },
        
            
        editor.load_svg_string = function (xmlString, callback) {
/*
            $(editor.document).remove();
            $(editor.workspace).append(str);
*/

            // convert string into XML document
            var newDoc = svgedit.utilities.text2xml(xmlString);
            
            // Remove current document
            if (editor.document)
                editor.workspace.removeChild(editor.document);

            // set new svg document
            // If DOM3 adoptNode() available, use it. Otherwise fall back to DOM2 importNode()
            if (editor.workspace.ownerDocument.adoptNode) {
                editor.document = editor.workspace.ownerDocument.adoptNode(newDoc.documentElement);
            }
            else {
                editor.document = editor.workspace.ownerDocument.importNode(newDoc.documentElement, true);
            }
            editor.workspace.appendChild(editor.document);
            
            if (editor.document.nodeName !== 'svg') {
                alert('Error while parsing SVG image');
                return;
            }

            var scale_wrapper = editor.document.getElementById('scale_wrapper');
            if (!scale_wrapper) {
                var msg = $.i18n('msg_bad_file_format');
                alert(msg == 'msg_bad_file_format' ? 'File format is not fully supported' : msg);
                var scale_wrapper = document.createElementNS(editor.ns_svg, 'g');
                scale_wrapper.setAttribute('id', 'scale_wrapper');
                editor.document.appendChild(scale_wrapper);
            }
            
            
            // Create temporary service elements
            var service_grp = document.createElementNS(editor.ns_svg, 'g');
            service_grp.setAttribute('id', '_ed_service_grp');
            service_grp.setAttribute('class', '_ed_temp');
            service_grp.setAttribute('transform', scale_wrapper.getAttribute('transform'));
            
            // Add select box
            editor.select_box = document.createElementNS(editor.ns_svg, 'g');
            editor.select_box.setAttribute('id', '_ed_select_box');
            editor.select_box.setAttribute('visibility', 'hidden');
            editor.select_box.setAttribute('class', '_ed_temp');
            var ids = ['_ed_select_box_margin1', '_ed_select_box_margin2'];
            var margin_idx = 0;
            for (var i in ids) {
                var sel_margin = document.createElementNS(editor.ns_svg, 'rect');
                sel_margin.setAttribute('id', ids[i]);
                sel_margin.setAttribute('class', '_ed_select_box_margin');
                sel_margin.setAttribute('fill', 'none');
//                    sel_margin.setAttribute('opacity', '0.4');
                sel_margin.setAttribute('stroke-width', 1.0);
                sel_margin.setAttribute('stroke', margin_idx ? '#FFFF00' : '#0000FF');
                if (margin_idx)
                    sel_margin.setAttribute('stroke-dasharray', '5,5');
//                sel_margin.setAttribute('style', 'pointer-events:none');
                editor.select_box.appendChild(sel_margin);
                margin_idx++;
            }
            service_grp.appendChild(editor.select_box);
            editor.document.appendChild(service_grp);
            
            $(editor.document).attr('id', 'svg_doc');
            $(editor.document).attr('data-width', $(editor.document).width());
            $(editor.document).attr('data-height', $(editor.document).height());
//            $(editor.document).css('background', editor.cfg.styles.background_color);

            editor.set_zoom(editor.cfg.zoom.initial);
            $('#editor_viewport').scrollLeft(($(editor.workspace).width() - $('#editor_viewport').width()) / 2)
            $('#editor_viewport').scrollTop(($(editor.workspace).height() - $('#editor_viewport').height()) / 2)
            
            editor.vm.create_image_model();

            if (callback)
               callback(true);
            
            return true;
        }

        
        // Returns @px value converted to current units, then rounded to enough precision and converted back to pixels
        editor.units_round = function (px, after_zero) {
            after_zero = after_zero || 0;
            switch(editor.cfg.units.name) {
                case 'cm':
                    after_zero = 2;
                    break;
                case 'm':
                    after_zero = 4;
                    break;
            }
            return _.round(px / editor.cfg.units.conversion_k, after_zero) * editor.cfg.units.conversion_k;
        }

        
        editor.size_round = function (px) {
            var m = px.match(/[\-\d\.]+/);
            px = m ? parseFloat(m[0]) : 0;
            return _.round(px, editor.cfg.size_round_digits);
        }
        
        
        editor.units_mm_to_px = function (val) {
            return (parseFloat(val) || 0) * editor.cfg.units.type_map['mm'];
        }

        
        editor.units_to_px = function (val) {
            return (parseFloat(val) || 0) * editor.cfg.units.conversion_k;
        }

        
        editor.px_to_units = function (val) {
            return _.round((parseFloat(val) || 0) / editor.cfg.units.conversion_k, 2);
        }
        


        // Source: SVG Edit
        // Function: svgToString
        // Sub function ran on each SVG element to convert it to a string as desired
        // 
        // Parameters: 
        // elem - The SVG element to convert
        // indent - Integer with the amount of spaces to indent this tag
        //
        // Returns: 
        // String with the given element as an SVG tag
        editor.svgToString = function(elem, indent) {
            elem = elem || editor.document;
            indent = indent || 0;
            var out = [], 
                toXml = svgedit.utilities.toXml;
//            var unit_re = /^\d+\.?\d*$/;
            var unit_re = new RegExp('^-?[\\d\\.]+px$');
            var unit = 'px';
//            $('.elm_selected', elem).removeClass('elm_selected');

            if (elem) {
                svgedit.utilities.cleanupElement(elem);
                var attrs = elem.attributes,
                    attr,
                    i,
                    childs = elem.childNodes;

                for (i = 0; i < indent; i++) {out.push(' ');}
                out.push('<'); out.push(elem.nodeName);
                if ((elem.nodeName.toLowerCase() === 'svg') && (elem.id === 'svg_doc')) {

                    // Process root element separately

                    var real_width = parseFloat($(editor.document).attr('data-width'));
                    var real_height = parseFloat($(editor.document).attr('data-height'));
                    out.push(' width="' + real_width + '" height="' + real_height + '" data-generator-name="' + APP_NAME + '" data-generator-version="' + APP_VERSION + '"');

                    var root_pass_attributes = ['xmlns', 'data-image-size', 'data-image-orientation'];
                    $.each(elem.attributes, function(i, attr) {
                        if ((root_pass_attributes.indexOf(attr.nodeName) >= 0) || (attr.nodeName.indexOf('xmlns:') === 0)) {
                            out.push(' ' + attr.nodeName + '="' + attr.value + '"');
                        }
                    });


/*
                    // Check elements for namespaces, add if found
                    var nsuris = {};
                    $(elem).find('*').addBack().each(function() {
                        var el = this;
                        // for some elements have no attribute
                        var uri = this.namespaceURI;
                        if(uri && !nsuris[uri] && nsMap[uri] && nsMap[uri] !== 'xmlns' && nsMap[uri] !== 'xml' ) {
                            nsuris[uri] = true;
                            out.push(' xmlns:' + nsMap[uri] + '="' + uri +'"');
                        }

                        $.each(this.attributes, function(i, attr) {
                            var uri = attr.namespaceURI;
                            if (uri && !nsuris[uri] && nsMap[uri] !== 'xmlns' && nsMap[uri] !== 'xml' ) {
                                nsuris[uri] = true;
                                out.push(' xmlns:' + nsMap[uri] + '="' + uri +'"');
                            }
                        });
                    });
*/
                } else {
                    // Skip empty defs
                    if (elem.nodeName === 'defs' && !elem.firstChild) {return;}
                    
                    // Skip temporary elements
                    if (elem.className.baseVal && (elem.className.baseVal.indexOf('_ed_temp') >= 0)) {return;}

                    var moz_attrs = ['-moz-math-font-style', '_moz-math-font-style'];
//                    for (i = attrs.length - 1; i >= 0; i--) {
                    for (i = 0; i <= attrs.length - 1; i++) {
                        attr = attrs.item(i);
                        var attrVal = toXml(attr.value);
                        //remove bogus attributes added by Gecko
                        if (moz_attrs.indexOf(attr.localName) >= 0) {continue;}
                        if (attrVal != '') {
                            if (attrVal.indexOf('pointer-events') === 0) {continue;}
//                            if (attr.localName === 'class') {
                            if (attr.localName === 'class') {
                                // Remove classes of our special use, prefixed with '_ed_'
                                var class_list = attrVal.match(/[^\s]+/g);
                                var class_list_new = [];
                                for (var j in class_list)
                                    if (class_list[j].indexOf('_ed_') !== 0)
                                        class_list_new.push(class_list[j]);
                                attrVal = class_list_new.join(' ');
                            }
                            out.push(' '); 
                            if ((attr.localName === 'd') || (attr.localName === 'transform')) {
                                attrVal = attrVal.replace(/[\d\.]+/g, function(match, contents) {
                                    return isNaN(match) ? match : editor.size_round(match);
                                });
                            }
//                            if (attr.localName === 'd') {attrVal = svgedit.utilities.convertPath(elem, true);}
                            if (!isNaN(attrVal)) {
                                attrVal = this.size_round(attrVal);
                            } else if (unit_re.test(attrVal)) {
                                attrVal = this.size_round(attrVal) + unit;
                            }

/*
                            // Embed images when saving 
                            if (elem.nodeName === 'image' 
                                && attr.localName === 'href') 
                            {
                                var img = encodableImages[attrVal];
                                if (img) {attrVal = img;}
                            }
*/

/*
                            if (elem.nodeName === 'image' 
                                && attr.localName === 'href'
                                && attr.namespaceURI === 'http://www.w3.org/1999/xlink')
                            {
                                out.push(attr.nodeName); out.push('="');
                                out.push(attrVal); out.push('"');
                            }
*/
                            
                            // map various namespaces to our fixed namespace prefixes
                            // (the default xmlns attribute itself does not get a prefix)
                            if (!attr.namespaceURI || attr.namespaceURI == editor.ns_svg || attr.namespaceURI === 'http://www.w3.org/1999/xlink') {
                                out.push(attr.nodeName); out.push('="');
                                out.push(attrVal); out.push('"');
                            }
                        }
                    }
                }

                if (elem.hasChildNodes()) {
                    out.push('>');
                    indent++;
                    var bOneLine = false;

                    for (i = 0; i < childs.length; i++) {
                        var child = childs.item(i);
                        switch(child.nodeType) {
                        case 1: // element node
                            out.push('\n');
                            out.push(this.svgToString(childs.item(i), indent));
                            break;
                        case 3: // text node
                            var str = child.nodeValue.replace(/^\s+|\s+$/g, '');
                            if (str != '') {
                                bOneLine = true;
                                out.push(String(toXml(str)));
                            }
                            break;
                        case 4: // cdata node
                            out.push('\n');
                            out.push(new Array(indent+1).join(' '));
                            out.push('<![CDATA[');
                            out.push(child.nodeValue);
                            out.push(']]>');
                            break;
                        case 8: // comment
                            out.push('\n');
                            out.push(new Array(indent+1).join(' '));
                            out.push('<!--');
                            out.push(child.data);
                            out.push('-->');
                            break;
                        } // switch on node type
                    }
                    indent--;
                    if (!bOneLine) {
                        out.push('\n');
                        for (i = 0; i < indent; i++) {out.push(' ');}
                    }
                    out.push('</'); out.push(elem.nodeName); out.push('>');
                } else {
                    out.push('/>');
                }
            }

            return out.join('');
        }; // end svgToString()

    
        // Source: https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
        editor.b64toBlob = function (b64Data, contentType, sliceSize) {
          contentType = contentType || '';
          sliceSize = sliceSize || 512;

          var byteCharacters = atob(b64Data);
          var byteArrays = [];

          for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
          }

          var blob = new Blob(byteArrays, {type: contentType});
          return blob;
        }
                        
    
        // Source: SVG Edit clientDownloadSupport()
		editor.client_download_datauri = function (filename, suffix, uri) {
            if (uri.length >= 2097100) {
                alert('File too large');
                return true;
            }
			var a,
				support = $('<a>')[0].download === '';
			if (support) {
				a = $('<a>hidden</a>').attr({download: (filename || 'image') + suffix, href: uri}).css('display', 'none').appendTo('body');
				a[0].click();
				return true;
			}
		};

    
		editor.client_download_blob = function (filename, contentType, raw_data) {
//            var blob = editor.b64toBlob(svgedit.utilities.encode64(raw_data, true));

            if (contentType.indexOf('image/svg') !== -1) {
                var blob = new Blob([raw_data], {type: contentType});
            } else {
                var byteArrays = [];
                sliceSize = 512;
                for (var offset = 0; offset < raw_data.length; offset += sliceSize) {
                    var slice = raw_data.slice(offset, offset + sliceSize);
                    var byteNumbers = new Array(slice.length);
                    for (var i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }
                    var byteArray = new Uint8Array(byteNumbers);
                    byteArrays.push(byteArray);
                }
                var blob = new Blob(byteArrays, {type: contentType});
            }
            
            var blobUrl = URL.createObjectURL(blob);
            a = $('<a>hidden</a>').attr({download: filename || 'file', href: blobUrl}).css('display', 'none').appendTo('body');
            a[0].click();
            return true;
		};
    
        
        editor.get_filename = function() {
            return editor.vm.model.title.replace(/[\/\\:*?"<>|]/g, '_').trim();
        };
        
        editor.download_svg = function() {
            $('#hdr_buttons button').attr('disabled', 'disabled');
            var svg = this.svgToString();

            this.client_download_blob(this.get_filename()+'.svg', 'image/svg', svg);

//            if (!this.client_download_datauri(this.get_filename(), '.svg', 'data:image/svg+xml;charset=UTF-8;base64,' + svgedit.utilities.encode64(svg)))
//                alert('ERROR: Direct download is not supported by your browser.');

            $('#hdr_buttons button').removeAttr('disabled');
        };

    
        editor.export_png = function(ppi/*system default:96*/) {
            ppi = parseInt(ppi) || 96;
            var c,
                mimeType = 'image/png';

            // Set PNG file resolution
            // IMPORTANT: Only for files WITHOUT PNG pHYs chunk. Such as those generated by canvas.toDataURL()
            // @src (string) - PNG file's raw data
            png_set_ppi = function (src, ppi) {
                ppi = Math.abs(parseInt(ppi)) || 96;
                var incPos = src.indexOf('IDAT') - 4;
                var mpu = Math.round(ppi/0.0254);
                var chunk = 'pHYs' + editor.calc.to_32bit_long_big_endian(mpu) + editor.calc.to_32bit_long_big_endian(mpu) + String.fromCharCode(1);
                var incData = editor.calc.to_32bit_long_big_endian(9) + chunk + editor.calc.to_32bit_long_big_endian(editor.calc.crc32(chunk));
                return src.slice(0, incPos) + incData + src.slice(incPos);
            }
            
            if(!$('#export_canvas').length) {
                $('<canvas>', {id: 'export_canvas'}).hide().appendTo('body');
//                $('<canvas>', {id: 'export_canvas'}).appendTo('body').css('position','absolute');
            }
            c = $('#export_canvas')[0];

            c.width = Math.round($(this.document).attr('data-width') * ppi / 96);
            c.height = Math.round($(this.document).attr('data-height') * ppi / 96);
            
            $('#hdr_buttons button').attr('disabled', 'disabled');

            svgedit.utilities.buildCanvgCallback(function () {
                var canvg_params = {
                    renderCallback: function() {
                        var datauri = c.toDataURL(mimeType);

                        // Set PNG file resolution
                        var uri_prfx = 'data:image/png;base64,';
                        var src = svgedit.utilities.decode64(datauri.substr(uri_prfx.length), true);
                        var modified_src = png_set_ppi(src, ppi);
//                        datauri = uri_prfx + svgedit.utilities.encode64(modified_src, true);
//                        if (!editor.client_download_datauri(editor.get_filename(), '.png', datauri))
//                            alert('ERROR: Direct download is not supported by your browser.');

                        editor.client_download_blob(editor.get_filename() + ' ' + ppi + 'ppi.png', 'image/png', modified_src);
                        
                        $('#hdr_buttons button').removeAttr('disabled');
                    }
                };
                if (ppi != 96) {
                    canvg_params.ignoreDimensions = true;
                    canvg_params.ignoreDimensions = true;
                    canvg_params.scaleWidth = c.width;
                    canvg_params.scaleHeight = c.height;
                }

//canvg_params.log = true;
//canvg_params.ignoreMouse = true;
//canvg_params.ignoreAnimation = true;
//canvg_params.ignoreClear = true;
//canvg_params.useCORS = true;

                canvg(c, editor.svgToString(), canvg_params);
            })();
        };
    

        editor.new_image = function() {
            this.open_url('svg/new_scale.svg');
        };
    
    
        editor.on_select_embed_image = function(input) {
            var file = input.files[0];
            if (!file)
                return;
            if (!file.name.match(/\.(svg|png|bmp|jpg|jpeg)$/i)) {
                alert($.i18n('msg_file_type_not_supported'));
                return;
            }
            $('#hdr_buttons button').attr('disabled', 'disabled');
            editor.vm.model.enable_templates(false);
            setTimeout(function(){
                var reader = new FileReader();
                reader.onload = function(e) {
                    var datauri = e.target.result;
                    $('#hdr_buttons button').removeAttr('disabled');
                    editor.vm.model.enable_templates(true);
                    var img = new Image();
                    img.onload = function(){
                        editor.vm.model.create_element({
                            element_type:'image.image',
                            datauri: datauri,
                            width: img.width,
                            height: img.height,
                            name: file.name
                        });
                    };
                    img.src = datauri;
                };
                reader.readAsDataURL(file);
            },100);
            
            // Re-create file input
            var i_html = input.outerHTML;
            var i_parent = input.parentNode;
            input.remove();
            $(i_html).appendTo(i_parent);
        };
    
    
        editor.on_select_file = function(input) {
            var file = input.files[0];
            if (!file)
                return;
            if (!file.name.match(/\.svg$/i)) {
                alert($.i18n('msg_file_type_not_supported'));
                return;
            }
            $('#hdr_buttons button').attr('disabled', 'disabled');
            $(editor.document).hide();
            editor.vm.model.enable_templates(false);
            setTimeout(function(){
                var reader = new FileReader();
                reader.onload = function(e) {
                    var contents = e.target.result;
                    editor.load_svg_string(contents);
                    $('#hdr_buttons button').removeAttr('disabled');
                    editor.vm.model.enable_templates(true);
                };
                reader.readAsText(file);
            },100);

            // Re-create file input
            var i_html = input.outerHTML;
            var i_parent = input.parentNode;
            input.remove();
            $(i_html).appendTo(i_parent);
        };
    
    
        editor.open_file = function() {
            $('form#open_file input[name=file]').click();
        };

    
        editor.embed_image = function() {
            $('form#embed_image input[name=file]').click();
        };
    
    
        editor.init_dropdowns = function() {
            $('[data-dropdown]').bind('click', function (event) {
                $('.dropdown:visible:not(#'+$(this).attr('data-dropdown')+')').hide();
                var dd = $('#'+$(this).attr('data-dropdown'));
                dd.toggle().css({left:this.offsetLeft+'px',top:(this.clientHeight-this.offsetTop)+'px','min-width':this.clientWidth+'px'});
                event.stopPropagation();
            })
        };
    
            
        editor.update_select_box = function() {
//console.log('update_select_box');
            
            var obj = editor.vm.model.selected_object;
            
            if (obj) {
                // Set select box position and size
                editor.select_box.setAttribute('visibility', 'visible');
                var sb_stroke_width = parseFloat($('._ed_select_box_margin').attr('stroke-width'));
                var obj_stroke_width = parseFloat(obj.element.getAttribute('stroke-width')) || 0;
                var bb = svgedit.utilities.getBBoxWithTransform(obj.element);
//console.log(obj.stroke_width_val(), obj.element.getAttribute('stroke-width'))
                // Apply minimum constraints on bbox
                var min_bbox_size = 2;
                if (bb.width < min_bbox_size){
                    bb.x -= (min_bbox_size-bb.width)/2;
                    bb.width = min_bbox_size;
                }
                if (bb.height < min_bbox_size){
                    bb.y -= (min_bbox_size-bb.height)/2;
                    bb.height = min_bbox_size;
                }
                $('._ed_select_box_margin').attr('x', bb.x - sb_stroke_width - obj_stroke_width/2);
                $('._ed_select_box_margin').attr('y', bb.y - sb_stroke_width - obj_stroke_width/2);
                $('._ed_select_box_margin').attr('width', bb.width + sb_stroke_width*2 + obj_stroke_width);
                $('._ed_select_box_margin').attr('height', bb.height + sb_stroke_width*2 + obj_stroke_width);
                // Take into account parent group transform
                if (obj.parent_obj && obj.parent_obj.element.getAttribute('transform'))
                    editor.select_box.setAttribute('transform', obj.parent_obj.element.getAttribute('transform'));
                else
                    editor.select_box.removeAttribute('transform');
            } else
                editor.select_box.setAttribute('visibility', 'hidden');
            
        };
    
    
        editor.save_config = function() {
            localStorage.setItem("cfg", JSON.stringify(editor.cfg));
        };
            
            
        editor.localize = function(lang) {
            lang = lang || editor.cfg.language;
//console.log(lang);
//console.log(editor.vm.model);
            editor.cfg.language = lang;

            // Set fallback attributes
            $('[data-i18n]:not([data-i18n-fallback])').each(function () {
                $(this).attr('data-i18n-fallback', $(this).text());
            });
            $('[data-i18n-title]:not([data-i18n-title-fallback])').each(function () {
                $(this).attr('data-i18n-title-fallback', $(this).attr('title'));
            });
            
            var i18n = $.i18n();
            i18n.locale = lang;
            
            i18n.load( 'lang/' + i18n.locale + '.json?v=' + APP_VERSION, i18n.locale ).done(function () {
                
                // Inner text
                $('[data-i18n]').i18n();
                $('[data-i18n-fallback]').each(function () {
                    if ($(this).text() && ($(this).text() == $(this).attr('data-i18n')))
                        $(this).text($(this).attr('data-i18n-fallback'));
                });
                
                // Title attr
                $('[data-i18n-title]').each(function () {
                    var title_loc = $.i18n($(this).attr('data-i18n-title'));
                    if (title_loc == $(this).attr('data-i18n-title'))
                        $(this).attr('title', $(this).attr('data-i18n-title-fallback'));
                    else
                        $(this).attr('title', title_loc);
                });
                
                if (editor.vm.model)
                    editor.vm.model.redraw_templates();
                
                // Update language selector
                $('.set-language').show();
                $('.set-language-' + lang).hide();
                $('button#set-language .icon').attr('class', 'icon icon-flag icon-flag-' + lang);
                $('button#set-language .language-name-orig').text($('.set-language-' + lang + ' .language-name-orig').text());
                
            }); // end i18n.load()
            
        };

    
        editor.trigger_sel_object_focus = function (elem) {
            if ($(elem).val()>=0){
                editor.vm.model.trigger_select({target: editor.vm.model}, {value: $(elem).val()});
//                $('#workspace').focus();
            }
//                editor.vm.model.select($(this).val());
        };
    
    
		return editor;
}(jQuery));


// Run init once DOM is loaded
jQuery(editor.init);


//console.log(':TODO: fix scroll jumping on zoom decrease');
//console.log(':TODO: image aspect ratio - automatic box sizing');
