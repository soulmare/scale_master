/*
 * editor.calc.js
 * Scale constructor utilities
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2017 Alexander Bolohovetsky
 *
 * Some small functions are from the public domain.
 *
 */

// Dependencies:
// 1) editor.js
// 2) lib/lodash.min.js

editor.calc = {};
(function(undef) {'use strict';


    // Convert polar coordinates to cartesian
    editor.calc.polarToCartesian = function (centerX, centerY, radius, angleInDegrees) {
      var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;

      return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
      };
    }
    

    // Get SVG Arc description by it's polar coordinates
    editor.calc.get_arc_path = function (x, y, radius, startAngle, endAngle){

        var after_zero = 5;
        
        if ((startAngle + 360 == endAngle) || (startAngle == endAngle + 360)) {
            // Full circle
            var d = 'M'+_.round(x-radius, after_zero)+','+_.round(y, after_zero)+'a'+_.round(radius, after_zero)+','+_.round(radius, after_zero)+' 0 1,0 '+_.round(radius*2, after_zero)+',0a'+_.round(radius, after_zero)+','+_.round(radius, after_zero)+' 0 1,0 -'+_.round(radius*2, after_zero)+',0';
        } else {
            // Arc
            var start = editor.calc.polarToCartesian(x, y, radius, endAngle);
            var end = editor.calc.polarToCartesian(x, y, radius, startAngle);

            var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";

            var d = [
                "M", _.round(start.x, after_zero), _.round(start.y, after_zero), 
                "A", _.round(radius, after_zero), _.round(radius, after_zero), 0, _.round(arcSweep, after_zero), 0, _.round(end.x, after_zero), _.round(end.y, after_zero),
        //        "L", _.round(x, after_zero), _.round(y, after_zero),
        //        "L", _.round(start.x, after_zero), _.round(start.y, after_zero)
            ].join(" ");
        }


        return d;       
    },
//    console.log(editor.calc.get_arc_path(0, 0, 110, 25, 45));

                  
    editor.calc.distance = function (x1, y1, x2, y2) {
      var yDiff = y2 - y1;
      var xDiff = x2 - x1;
      var radicant = yDiff * yDiff + xDiff * xDiff;
      var result = Math.pow(radicant, 0.5);
      return result;
    },

        
    editor.calc.to_32bit_long_big_endian = function (a) {
        var buff = '';
        buff += String.fromCharCode(a >> 24 & 0xFF);
        buff += String.fromCharCode(a >> 16 & 0xFF);
        buff += String.fromCharCode(a >> 8 & 0xFF);
        buff += String.fromCharCode(a & 0xFF);
        return buff;
    }


    editor.calc.makeCRCTable = function (a) {
        var c;
        var crcTable = [];
        for(var n =0; n < 256; n++){
            c = n;
            for(var k =0; k < 8; k++){
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        this.crcTable = crcTable;
        return crcTable;
    };

    
    editor.calc.crc32 = function (str) {
        var crcTable = this.crcTable || this.makeCRCTable();
        var crc = 0 ^ (-1);

        for (var i = 0; i < str.length; i++ ) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
        }

        return (crc ^ (-1)) >>> 0;
    };
        
}());
