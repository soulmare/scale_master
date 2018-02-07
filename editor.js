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
		editor.defaultConfig = {
				zoom: {
                    initial: 1.0,
                    min: 0.2,
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
//                drag_scroll_btn: 0,
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
                },
                store_last_document: true,
                div_levels_count: 3,
                initial_image: 'svg/new_scale.svg',
                export_cutoff_empty_space: true
            };
    
//        editor.svg_observe_attrs = {
//            '*': ['transform', 'title', 'stroke', 'stroke-width']
//        }
//    'x1', 'y1', 'x2', 'y2', 'd', '', ''];
    
    
        // Document coordinates origin position, in workspace pixels. Depends of current zoom value
        editor.document_origin = [0, 0];

        // Paper sizes in pixels 96 ppi
        editor.image_sizes = {
            'A0': [3179,4494],
            'A1': [2245,3179],
            'A2': [1587,2245],
            'A3': [1123,1587],
            'A4': [794,1123],
            'A5': [559,794],
            'A6': [397,559],
            'A7': [280,397]
        };
    
        editor.ns_svg = 'http://www.w3.org/2000/svg';
    
        editor.languages = {};
    

    
        editor.init = function () {
            
            // Load stored configuration
            var cfg = localStorage.getItem("cfg");
            if (cfg) {
                try {
                    editor.cfg = JSON.parse(cfg);
                    // Populate stored configuration with non existing fields
                    for (var field in editor.defaultConfig)
                        if (editor.cfg[field] === undefined)
                            editor.cfg[field] = editor.defaultConfig[field];
                } catch(e) {
                    editor.cfg = editor.defaultConfig;
                }
            } else {
                editor.cfg = editor.defaultConfig;
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

            if (!editor.is_offline()) {

                if (!editor.cfg.initial_image)
                    editor.cfg.initial_image = editor.defaultConfig.initial_image;

    //            var initial_document = 'svg/example_multiscale.svg';
    //            var initial_document = 'svg/test_negative_line_length2.svg';
    //            var initial_document = 'svg/test.svg';

                if (editor.cfg.store_last_document) {
                    var svg_str_stored = localStorage.getItem('svg_doc');
                    if (svg_str_stored){
        //                console.log(svg_str_stored.length);
        //                svg_str_stored = '<sv'+svg_str_stored;
                        editor.vm.model.enable_templates(false);
                        if (!editor.load_svg_string(svg_str_stored))
                            editor.open_url(editor.cfg.initial_image);
                        editor.vm.model.enable_templates(true);
                    }else
                        editor.open_url(editor.cfg.initial_image);
                } else
                    editor.open_url(editor.cfg.initial_image);
                
            } else {
                editor.initial_svg_string = editor.workspace.innerHTML;
                editor.load_svg_string(editor.initial_svg_string);
            }
            
            if (editor.is_offline())
                $('button[data-dropdown="examples_dropdown"],button[data-dropdown="scales_library"]').attr('disabled', 'disabled').attr('data-disabled-permanently', 'true');
            
            
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
                        e.preventDefault();
                    }
                },
                'mousedown': function(e) {
                    if (e.button != 1) return; // ignore other buttons
                    e.preventDefault();
                    clicked = true;
                    clickY = e.clientY;
                    clickX = e.clientX;
                },
                'mouseup': function(e) {
                    if (e.button != 1) return; // ignore other buttons
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
//            set_zoom_debounced = editor.set_zoom;
            
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
                var delta_deg = e.ctrlKey ? 1 : 0.1;
                var delta_deg2 = e.ctrlKey ? 1 : 0.5;
                var delta = editor.units_to_px(e.ctrlKey ? 1 : 0.1);
//                var arrow_keys = [37, 38, 39, 40];
                var sel_obj = editor.vm.model.selected_object;
                if (!sel_obj)
                    return;

                if ((sel_obj.tag == 'line') && (sel_obj.type == 'div') && sel_obj.parent_obj && sel_obj.parent_obj.is_group){
                    // Move grouped divisions and labels
                    switch (e.which) {
                        case 37: // left
                        case 40: // down
                            $.observable(sel_obj).setProperty('angle_val', _.round((sel_obj.angle_val() || 0) - delta_deg, 1));
                            e.preventDefault();
                            break;
                        case 38: // up
                        case 39: // right
                            $.observable(sel_obj).setProperty('angle_val', _.round((sel_obj.angle_val() || 0) + delta_deg, 1));
                            e.preventDefault();
                            break;
                    }
                } else {
                    // Move common objects
                    switch (e.which) {
                        case 37:
                            // left
                            if (e.shiftKey) {
                                if (sel_obj.angle !== undefined)
                                    $.observable(sel_obj).setProperty('angle', _.round((sel_obj.angle() || 0) - delta, 1));
                                e.preventDefault();
                            } else {
                                $.observable(sel_obj).setProperty('shift_x', editor.units_round(sel_obj.shift_x(), 1) - delta);
                                e.preventDefault();
                            }
                            break;
                        case 38:
                            // up
                            if (e.shiftKey && (sel_obj.type == 'arc')) {
                                $.observable(sel_obj).setProperty('arc_angle', _.round((parseFloat(sel_obj.arc_angle()) || 0) + delta_deg2, 1));
                                e.preventDefault();
                            } else if (e.shiftKey && ((sel_obj.tag == 'g') && ((sel_obj.type == 'div') || (sel_obj.type == 'label')))) {
                                $.observable(sel_obj).setProperty('data_angle', _.round((parseFloat(sel_obj.data_angle) || 0) + delta_deg2, 1));
                                e.preventDefault();
                            } else {
                                $.observable(sel_obj).setProperty('shift_y', editor.units_round(sel_obj.shift_y(), 1) - delta);
                                e.preventDefault();
                            }
                            break;
                        case 39:
                            // right
                            if (e.shiftKey) {
                                if (sel_obj.angle !== undefined)
                                    $.observable(sel_obj).setProperty('angle', _.round((sel_obj.angle() || 0) + delta, 1));
                                e.preventDefault();
                            } else {
                                $.observable(sel_obj).setProperty('shift_x', editor.units_round(sel_obj.shift_x(), 1) + delta);
                                e.preventDefault();
                            }
                            break;
                        case 40:
                            // down
                            if (e.shiftKey && (sel_obj.type == 'arc')) {
                                $.observable(sel_obj).setProperty('arc_angle', _.round((parseFloat(sel_obj.arc_angle()) || 0) - delta_deg2, 1));
                                e.preventDefault();
                            } else if (e.shiftKey && ((sel_obj.tag == 'g') && ((sel_obj.type == 'div') || (sel_obj.type == 'label')))) {
                                $.observable(sel_obj).setProperty('data_angle', _.round((parseFloat(sel_obj.data_angle) || 0) - delta_deg2, 1));
                                e.preventDefault();
                            } else {
                                $.observable(sel_obj).setProperty('shift_y', editor.units_round(sel_obj.shift_y(), 1) + delta);
                                e.preventDefault();
                            }
                            break;
                    }
                }

                // Common actions
                switch (e.which) {
                    case 46:
                        // delete
                        editor.vm.model.delete(null, {change: 'click'});
                        break;
                }
                
            });

            // URL hash processing
            $(window).bind('hashchange', function() {
                console.log(location.hash);
            });

        }

        
        editor.trigger_objects_list_keydown = function (event) {
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
//console.log('zoom')

            var real_width = parseFloat($(editor.document).attr('data-width') || $(editor.document).attr('width'));
            var real_height = parseFloat($(editor.document).attr('data-height') || $(editor.document).attr('height'));

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
            editor.zoom = Math.min(editor.defaultConfig.zoom.max, Math.max(editor.defaultConfig.zoom.min, new_zoom));
            
            $('input[type=number][name=zoom]').val(_.round(editor.zoom*100,2));
//console.log('ZOOM', editor.zoom, zoom_center_point)

/*
            var display_width = real_width * editor.zoom;
            var display_height = real_height * editor.zoom;
            var workspace_width = display_width * 1.5;
            var workspace_height = display_height * 1.5;

            // Resize page
            $(editor.document).attr('width', display_width);
            $(editor.document).attr('height', display_height);
            $(editor.document).attr('viewBox', [0, 0, real_width, real_height].join(' '));

            // Resize workspace
            $(editor.workspace).width(workspace_width);
            $(editor.workspace).height(workspace_height);

            // Center page on workspace
            $(editor.document).css('left', workspace_width/2-display_width/2);
            $(editor.document).css('top', workspace_height/2-display_height/2);
*/
            
            
//            $(editor.document).attr('x', $('#workspace').width()/2-$(editor.document).width()/2);
//            $(editor.document).attr('y', $('#workspace').height()/2-$(editor.document).height()/2);

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

            // Change selector box elements sizes
            $('#_ed_select_marker').attr('r', 3/editor.zoom+0.3);
            $('#_ed_select_marker').attr('stroke-width', 1.5/editor.zoom);
            $('._ed_helper_line').attr('stroke-width', 1.5/editor.zoom);
            
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
        };
        
        
        editor.open_url = function (url, callback, no_warning) {

            if(editor.modified && !no_warning && !confirm($.i18n('msg_lost_edits_warning')))
                return;

            $(editor.document).hide();
            $('#hdr_buttons button').attr('disabled', 'disabled');
            editor.vm.model.enable_templates(false);
            $.ajax({
                url: url,
                dataType: 'text',
                cache: false,
                complete: function() {
                    $('#hdr_buttons button').not('[data-disabled-permanently]').removeAttr('disabled');
                    editor.vm.model.enable_templates(true);
                },
                success: function(str) {
                    editor.load_svg_string(str, callback);
                },
                error: function(xhr, stat, err) {
                    alert('Failed loading URL: \n' + err);
                }
            });
        };
        
            
        editor.load_svg_string = function (xmlString, callback) {
            
            document.title = APP_NAME;
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
            
            // Add select box margin
            var ids = ['_ed_select_box_margin1', '_ed_select_box_margin2'];
            var margin_idx = 0;
            var dash_colors_margins = ['#FF0000', '#ffff00'];
            for (var i in ids) {
                var sel_margin = document.createElementNS(editor.ns_svg, 'rect');
                sel_margin.setAttribute('id', ids[i]);
                sel_margin.setAttribute('class', '_ed_select_box_margin _ed_helper_line');
                sel_margin.setAttribute('fill', 'none');
//                    sel_margin.setAttribute('opacity', '0.4');
                sel_margin.setAttribute('stroke-width', 1.0);
                sel_margin.setAttribute('stroke', margin_idx ? dash_colors_margins[0] : dash_colors_margins[1]);
                if (margin_idx)
                    sel_margin.setAttribute('stroke-dasharray', '3,3');
//                sel_margin.setAttribute('style', 'pointer-events:none');
                editor.select_box.appendChild(sel_margin);
                margin_idx++;
            }

            // Select box helper circles
            for (var i=1; i<=2; i++)
                for (var j=1; j<=2; j++) {
                    var elem = document.createElementNS(editor.ns_svg, 'circle');
                    elem.setAttribute('id', '_ed_select_circle_'+i+'_'+j);
                    elem.setAttribute('class', '_ed_select_circle _ed_select_circle_'+i+' _ed_helper_line');
                    elem.setAttribute('stroke-width', 1.0);
                    elem.setAttribute('fill', 'none');
                    elem.setAttribute('stroke', j == 1 ? dash_colors_margins[0] : dash_colors_margins[1]);
                    if (j == 2)
                        elem.setAttribute('stroke-dasharray', '2,2');
                    editor.select_box.appendChild(elem);
                }
            
            // Select box axis
            var dash_colors_axis = ['#FFFFFF', '#000000'];
            for (var i=1; i<=3; i++)
                for (var j=1; j<=2; j++) {
                    var sel_axe = document.createElementNS(editor.ns_svg, 'line');
                    sel_axe.setAttribute('id', '_ed_select_axe_'+i+'_'+j);
                    sel_axe.setAttribute('class', '_ed_select_axe _ed_select_axe_'+i+' _ed_helper_line');
                    sel_axe.setAttribute('stroke-width', 1.0);
                    sel_axe.setAttribute('stroke', j == 1 ? dash_colors_axis[0] : dash_colors_axis[1]);
                    if (j == 2)
                        sel_axe.setAttribute('stroke-dasharray', '2,2');
                    editor.select_box.appendChild(sel_axe);
                }

            // Select box marker
            var sel_marker = document.createElementNS(editor.ns_svg, 'circle');
            sel_marker.setAttribute('id', '_ed_select_marker');
            sel_marker.setAttribute('stroke-width', 1.0);
            sel_marker.setAttribute('fill', '#ffff00');
            sel_marker.setAttribute('stroke', '#ff0000');
            sel_marker.setAttribute('r', 5);
            editor.select_box.appendChild(sel_marker);
            
            service_grp.appendChild(editor.select_box);

            
            // Document median axis
            var dash_colors = ['#FFFFFF', '#0000ff'];
            var doc_size = [$(editor.document).width(), $(editor.document).height()];
            for (var i=1; i<=2; i++)
                for (var j=1; j<=2; j++) {
                    var class_name = '_ed_doc_axe _ed_helper_line';
                    var line = document.createElementNS(editor.ns_svg, 'line');
                    line.setAttribute('id', '_ed_doc_axe_'+i+'_'+j);
                    line.setAttribute('stroke-width', 1.0);
                    line.setAttribute('stroke', j == 1 ? dash_colors[0] : dash_colors[1]);
                    if (j == 2)
                        line.setAttribute('stroke-dasharray', '2,2');
                    if (i == 1) {
                        // X axe
                        class_name += ' _ed_doc_axe_x'
                        line.setAttribute('x1', -doc_size[0]/2);
                        line.setAttribute('y1', 0);
                        line.setAttribute('x2', doc_size[0]/2);
                        line.setAttribute('y2', 0);
                    } else {
                        class_name += ' _ed_doc_axe_y'
                        line.setAttribute('x1', 0);
                        line.setAttribute('y1', -doc_size[1]/2);
                        line.setAttribute('x2', 0);
                        line.setAttribute('y2', doc_size[1]/2);
                    }
                    line.setAttribute('class', class_name);
                    service_grp.appendChild(line);
                }

            editor.document.appendChild(service_grp);
            
            
            $(editor.document).attr('id', 'svg_doc');
            $(editor.document).attr('data-width', $(editor.document).width());
            $(editor.document).attr('data-height', $(editor.document).height());
//            $(editor.document).css('background', editor.cfg.styles.background_color);

            editor.set_zoom(editor.cfg.zoom.initial);
            $('#editor_viewport').scrollLeft(($(editor.workspace).width() - $('#editor_viewport').width()) / 2)
            $('#editor_viewport').scrollTop(($(editor.workspace).height() - $('#editor_viewport').height()) / 2)
            
            editor.vm.create_image_model();

            // Listen to changes in SVG document
            MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
//console.log(MutationObserver, typeof(MutationObserver))
            if (MutationObserver) {
                var observer = new MutationObserver(editor.doc_observer);
                observer.observe(editor.document.getElementById('scale_wrapper'), {
                  subtree: true,
                  attributes: true,
                  childList: true,
    //              attributeOldValue: true,
                  characterData: true
                });
            }
            editor.modified = false;
            
            if (callback)
               callback(true);
            
            return true;
        }

        
        editor.doc_observer = function (mutations, observer) {
            // fired when a mutation occurs
            if (!editor.modified && !editor.ignore_modify) {
//                console.log(mutations);
                editor.modified = true;
                document.title += '*';
            }
        };
        
            
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
            
            
            if (window.navigator.msSaveBlob)
                // IE
                //window.navigator.msSaveBlob || window.navigator.msSaveOrOpenBlob
                window.navigator.msSaveBlob(blob, filename);
            else {
                // Normal browsers
                var blobUrl = URL.createObjectURL(blob);
                var a = $('<a>hidden</a>').attr({download: filename || 'file', href: blobUrl}).css('display', 'none').appendTo('body');
                a[0].click();
            }
            
//            var b = $('<a>hidden</a>').attr({_download: filename || 'file', href: '#blobUrl'}).css('display', 'block').appendTo('body');
/*
console.log(a)
console.log(a[0])
console.log(a[0].click)
*/
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

            $('#hdr_buttons button').not('[data-disabled-permanently]').removeAttr('disabled');
            editor.modified = false;
            document.title = document.title.substr(0, document.title.length-1);
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
            
            var c = $('#export_canvas')[0];

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

                        var size_mm = [_.round(c.width / ppi * 25.4, 2).toString(), _.round(c.height / ppi * 25.4, 2).toString()];
                        for (var i in size_mm)
                            while (size_mm[i].length < size_mm[i].indexOf('.') + 3) size_mm[i] += '0';
                        
                        editor.client_download_blob(editor.get_filename() + ' (' + ppi + 'ppi '+size_mm[0]+'x'+size_mm[1]+'mm).png', 'image/png', modified_src);
                        
                        $('#hdr_buttons button').not('[data-disabled-permanently]').removeAttr('disabled');
                    }
                };

//canvg_params.log = true;
//canvg_params.ignoreMouse = true;
//canvg_params.ignoreAnimation = true;
//canvg_params.ignoreClear = true;
//canvg_params.useCORS = true;
                
                var c = $('#export_canvas')[0];

                // Cut off empty space
                if (editor.cfg.export_cutoff_empty_space) {
                    editor.ignore_modify = true;
                    var scale_wrapper = editor.document.getElementById('scale_wrapper');
                    var bb = svgedit.utilities.getBBox(scale_wrapper);
                    var padding = [bb.width*0.2, bb.height*0.2];
                    var orig_doc_size = _.map([editor.document.getAttribute('data-width'), editor.document.getAttribute('data-height')], parseFloat);
                    var orig_transform = scale_wrapper.getAttribute('transform');
                    if (orig_doc_size[0] <= bb.width + padding[0])
                        padding[0] = 0;
                    if (orig_doc_size[1] <= bb.height + padding[1])
                        padding[1] = 0;
                    var new_width = bb.width + padding[0]*2;
                    var new_height = bb.height + padding[1]*2;
                    editor.document.setAttribute('data-width', new_width);
                    editor.document.setAttribute('data-height', new_height);
                    scale_wrapper.setAttribute('transform', 'translate(' + (-bb.x+padding[0]) + ',' + (-bb.y+padding[1]) + ')');
                    c.width = Math.round(new_width * ppi / 96);
                    c.height = Math.round(new_height * ppi / 96);
                    var svg_str = editor.svgToString();
                    // Restore dimensions
                    editor.document.setAttribute('data-width', orig_doc_size[0]);
                    editor.document.setAttribute('data-height', orig_doc_size[1]);
                    scale_wrapper.setAttribute('transform', orig_transform);
                    setTimeout(function (){editor.ignore_modify = false;}, 100);
    //console.log(bb)
    //console.log(editor.svgToString())
    /*
    console.log(viewBox)
    console.log(newViewBox)
    */
                } else
                    var svg_str = editor.svgToString();

                if (ppi != 96) {
                    canvg_params.ignoreDimensions = true;
                    canvg_params.scaleWidth = c.width;
                    canvg_params.scaleHeight = c.height;
                }
                                
                canvg(c, svg_str, canvg_params);
            })();
        };
    

        editor.new_image = function() {
            if (editor.is_offline()) {
                if(editor.modified && !confirm($.i18n('msg_lost_edits_warning')))
                    return;
                editor.load_svg_string(editor.initial_svg_string);
            } else
                this.open_url(editor.cfg.initial_image);
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
                    $('#hdr_buttons button').not('[data-disabled-permanently]').removeAttr('disabled');
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
                    $('#hdr_buttons button').not('[data-disabled-permanently]').removeAttr('disabled');
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
            $('[data-dropdown]').bind('click', editor.dropdown_toggle);
        };

    
        editor.dropdown_toggle = function(event) {
            var _this = $(event.target).closest('button')[0];
            var dropdown = $(this).attr('data-dropdown') || $(_this).attr('data-dropdown');
            $('.dropdown:visible:not(#'+dropdown+')').hide();
            var dd = $('#'+dropdown);
            dd.toggle().css({left:_this.offsetLeft+'px',top:(_this.clientHeight > _this.offsetTop ? _this.clientHeight-_this.offsetTop : _this.offsetTop+_this.clientHeight/2)+'px','min-width':_this.clientWidth+'px'});
            event.stopPropagation();
        };
                
            
        editor.update_select_box = function() {
            
            var obj = editor.vm.model.selected_object;
            
            if (obj) {
                editor.select_box.setAttribute('visibility', 'visible');

                $('#_ed_select_marker,._ed_select_box_margin,._ed_select_axe,._ed_select_circle').attr('visibility', 'hidden').removeAttr('transform');
//                console.log(obj.element.getAttribute('transform'))

                if ((((obj.type == 'div') || (obj.type == 'label')) && (obj.tag == 'g')) || (obj.type == 'arc')) {
//console.log(obj.data_angle, obj.angle() || 0, obj.data_r);
//                    var radius = obj.data_r || 0;
                    var radius = Math.max(editor.document.width.baseVal.value, editor.document.height.baseVal.value);
                    var p1 = editor.calc.polarToCartesian(obj.shift_x() || 0, obj.shift_y() || 0, radius, -(obj.data_angle || 0) / 2 + (obj.angle() || 0));
                    var p2 = editor.calc.polarToCartesian(obj.shift_x() || 0, obj.shift_y() || 0, radius, (obj.data_angle || 0) / 2 + (obj.angle() || 0));
                    var p_med = editor.calc.polarToCartesian(obj.shift_x() || 0, obj.shift_y() || 0, radius, obj.angle() || 0);
//                    p1.x = editor.px_to_units(p1.x);
//                    p1.y = editor.px_to_units(p1.y);
//console.log(p1);
                    // left angle
                    $('._ed_select_axe_1')
                        .attr('x1', obj.shift_x() || 0)
                        .attr('y1', obj.shift_y() || 0)
                        .attr('x2', p1.x || 0)
                        .attr('y2', p1.y || 0)
                        .removeAttr('visibility');
                    // right angle
                    $('._ed_select_axe_2')
                        .attr('x1', obj.shift_x() || 0)
                        .attr('y1', obj.shift_y() || 0)
                        .attr('x2', p2.x || 0)
                        .attr('y2', p2.y || 0)
                        .removeAttr('visibility');
                    // median angle
                    $('._ed_select_axe_3')
                        .attr('x1', obj.shift_x() || 0)
                        .attr('y1', obj.shift_y() || 0)
                        .attr('x2', p_med.x || 0)
                        .attr('y2', p_med.y || 0)
                        .removeAttr('visibility');
                    $('#_ed_select_marker')
                            .removeAttr('visibility')
                            .attr('transform', obj.element.getAttribute('transform'));
                    
                    // Circular helpers
                    var radius = obj.type == 'arc' ? parseFloat(obj.radius() || 0) : parseFloat(obj.data_r || 0);
                    if (radius>0) {
                        $('._ed_select_circle').attr('transform', obj.element.getAttribute('transform'))
                        $('._ed_select_circle_1')
                                .removeAttr('visibility')
                                .attr('r', radius);
                        if (obj.type == 'div') {
                            var r2 = radius + parseFloat(obj.data_length || 0);
                            if (r2 > 0)
                                $('._ed_select_circle_2')
                                        .removeAttr('visibility')
                                        .attr('r', r2);
                        }
                    }
//                } else if ((obj.type == 'image') || (obj.type == 'circle') || (obj.type == 'circlecnt') || (obj.type == 'rect') || (obj.type == 'plate')) {
                } else {

//                    if ((obj.tag !== 'line') && (obj.tag !== 'text')) {
                    // Select box crosschair axis
                    // Not for non-grouped lines
                    var is_group_member = obj.parent_obj && (obj.parent_obj.tag == 'g');
                    if (is_group_member) {
                        var size = Math.max(editor.document.width.baseVal.value, editor.document.height.baseVal.value);
                        $('._ed_select_axe_1')
                            .attr('x1', 0)
                            .attr('y1', 0)
                            .attr('x2', 0)
                            .attr('y2', -size)
                            .removeAttr('visibility');
                        var transform = obj.element.getAttribute('transform');
                        if (transform){
//                            $('._ed_select_axe').attr('transform', transform.replace(/\srotate\([^)]+[,\s][^)]+[,\s][^)]+\)/, ''));
                            // Get only rotation with default center 
                            var m1 = transform.match(/rotate\(\s*\-?\s*[\d\.]+\s*\)/);
                            var m2 = transform.match(/rotate\(\s*\-?\s*[\d\.]+[\s,]+\-?\s*0[\.0]*[\s,]+-?\s*0[\.0]*\s*\)/);
//                            console.log(transform);
                            if (m1)
                                $('._ed_select_axe').attr('transform', m1[0]);
                            else if (m2)
                                $('._ed_select_axe').attr('transform', m2[0]);
//                            console.log($('._ed_select_axe').attr('transform'));
                        }
                    } else if (obj.tag !== 'line') {
                        var size = Math.max(editor.document.width.baseVal.value, editor.document.height.baseVal.value);
                        $('._ed_select_axe_1')
                            .attr('x1', 0)
                            .attr('y1', -size)
                            .attr('x2', 0)
                            .attr('y2', size)
                            .removeAttr('visibility');
                        $('._ed_select_axe_2')
                            .attr('x1', -size)
                            .attr('y1', 0)
                            .attr('x2', size)
                            .attr('y2', 0)
                            .removeAttr('visibility');
                        $('._ed_select_axe').attr('transform', obj.element.getAttribute('transform'));
                    }

                    // Set select box rectangle-type margins
                    
                    var sb_stroke_width = parseFloat($('._ed_select_box_margin').attr('stroke-width'));
                    var obj_stroke_width = parseFloat(obj.element.getAttribute('stroke-width')) || 0;
                    var bb = svgedit.utilities.getBBoxWithTransform(obj.element);
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
                    $('._ed_select_box_margin')
                            .attr('x', bb.x - sb_stroke_width - obj_stroke_width/2)
                            .attr('y', bb.y - sb_stroke_width - obj_stroke_width/2)
                            .attr('width', bb.width + sb_stroke_width*2 + obj_stroke_width)
                            .attr('height', bb.height + sb_stroke_width*2 + obj_stroke_width)
                            .removeAttr('visibility');
                                        
                }
                
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
            
            i18n.load( editor.languages ).done(function () {
                
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

                // Check browser support
                if (editor.ie_version())
                    alert($.i18n('msg_browser_not_supported'));
//                    setTimeout(function(){alert($.i18n('msg_browser_not_supported'))}, 1000);
                
            }); // end i18n.load()
            
        };

    
        editor.trigger_sel_object_focus = function (elem) {
            if ($(elem).val()>=0){
                editor.vm.model.trigger_select({target: editor.vm.model}, {value: $(elem).val()});
//                $('#workspace').focus();
            }
//                editor.vm.model.select($(this).val());
        };
    
        editor.toggle_block = function (e) {
//            console.log()
            $('.block_contents', $(e.target).closest('.block')).slideToggle();
        };

    
        editor.ie_version = function () {
            var match = navigator.userAgent.match(/(?:MSIE |Trident\/.*; rv:)([\d\.]+)/);
            return match ? parseFloat(match[1]) : undefined;
        }

        
        editor.is_offline = function (e) {
            return location.href.match('(.*)://')[1].toLowerCase() === 'file';
        };
        
        
		return editor;
}(jQuery));


// Run init once DOM is loaded
jQuery(editor.init);


//console.log(':TODO: fix scroll jumping on zoom decrease');
//console.log(':TODO: image aspect ratio - automatic box sizing');
