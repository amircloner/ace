/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {

var oop = require("../lib/oop");
var dom = require("../lib/dom");
var lang = require("../lib/lang");
var event = require("../lib/event");
var useragent = require("../lib/useragent");
var EventEmitter = require("../lib/event_emitter").EventEmitter;

var CHAR_COUNT = 256;
var USE_OBSERVER = typeof ResizeObserver == "function";
var L = 200;

var FontMetrics = exports.FontMetrics = function(parentEl) {
    this.el = dom.createElement("div");
    this.$setMeasureNodeStyles(this.el.style, true);
    
    this.$main = dom.createElement("div");
    this.$setMeasureNodeStyles(this.$main.style);
    
    this.$measureNode = dom.createElement("div");
    this.$setMeasureNodeStyles(this.$measureNode.style);
    
    
    this.el.appendChild(this.$main);
    this.el.appendChild(this.$measureNode);
    parentEl.appendChild(this.el);
    
    this.$measureNode.textContent = lang.stringRepeat("X", CHAR_COUNT);
    
    this.$characterSize = {width: 0, height: 0};
    
    
    if (USE_OBSERVER)
        this.$addObserver();
    else
        this.checkForSizeChanges();
};

(function() {

    oop.implement(this, EventEmitter);
        
    this.$characterSize = {width: 0, height: 0};
    
    this.$setMeasureNodeStyles = function(style, isRoot) {
        style.width = style.height = "auto";
        style.left = style.top = "0px";
        style.visibility = "hidden";
        style.position = "absolute";
        style.whiteSpace = "pre";

        if (useragent.isIE < 8) {
            style["font-family"] = "inherit";
        } else {
            style.font = "inherit";
        }
        style.overflow = isRoot ? "hidden" : "visible";
    };

    this.checkForSizeChanges = function(size) {
        if (size === undefined)
            size = this.$measureSizes();
        if (size && (this.$characterSize.width !== size.width || this.$characterSize.height !== size.height)) {
            this.$measureNode.style.fontWeight = "bold";
            var boldSize = this.$measureSizes();
            this.$measureNode.style.fontWeight = "";
            this.$characterSize = size;
            this.charSizes = Object.create(null);
            this.allowBoldFonts = boldSize && boldSize.width === size.width && boldSize.height === size.height;
            this._emit("changeCharacterSize", {data: size});
        }
    };
    
    this.$addObserver = function() {
        var self = this;
        this.$observer = new window.ResizeObserver(function(e) {
            // e[0].contentRect is broken on safari when zoomed;
            self.checkForSizeChanges();
        });
        this.$observer.observe(this.$measureNode);
    };

    this.$pollSizeChanges = function() {
        if (this.$pollSizeChangesTimer || this.$observer)
            return this.$pollSizeChangesTimer;
        var self = this;
        
        return this.$pollSizeChangesTimer = event.onIdle(function cb() {
            self.checkForSizeChanges();
            event.onIdle(cb, 500);
        }, 500);
    };
    
    this.setPolling = function(val) {
        if (val) {
            this.$pollSizeChanges();
        } else if (this.$pollSizeChangesTimer) {
            clearInterval(this.$pollSizeChangesTimer);
            this.$pollSizeChangesTimer = 0;
        }
    };

    this.$measureSizes = function(node) {
        var size = {
            height: (node || this.$measureNode).clientHeight,
            width: (node || this.$measureNode).clientWidth / CHAR_COUNT
        };
        
        // Size and width can be null if the editor is not visible or
        // detached from the document
        if (size.width === 0 || size.height === 0)
            return null;
        return size;
    };

    this.$measureCharWidth = function(ch) {
        this.$main.textContent = lang.stringRepeat(ch, CHAR_COUNT);
        var rect = this.$main.getBoundingClientRect();
        return rect.width / CHAR_COUNT;
    };
    
    this.getCharacterWidth = function(ch) {
        var w = this.charSizes[ch];
        if (w === undefined) {
            w = this.charSizes[ch] = this.$measureCharWidth(ch) / this.$characterSize.width;
        }
        return w;
    };

    // Measure the rendered run, not isolated letters: Persian shaping and fallback
    // fonts can have different advances even when the Latin font is monospaced.
    this.$getBidiRow = function(screenRow) {
        var layer = this.$textLayer;
        var doc = this.el.ownerDocument;
        if (!layer || !layer.config || !doc.createRange)
            return null;
        var session = layer.session;
        var docRow = session.screenToDocumentRow(screenRow, 0);
        var cells = layer.$lines.cells;
        var line;
        for (var i = 0; i < cells.length; i++) {
            if (cells[i].row === docRow) {
                line = cells[i].element;
                break;
            }
        }
        // Input can change the session before the text layer has been rendered.
        if (!line || line.$bidiText !== session.getLine(docRow))
            return null;
        layer.$setBidiLineStyle(line, docRow);
        if (layer.$useLineGroups())
            line = line.children[screenRow - session.documentToScreenRow(docRow, 0)];
        if (!line)
            return null;

        var points = [], nodes = [], column = 0, eol;
        function walk(parent) {
            for (var i = 0; i < parent.childNodes.length; i++) {
                var node = parent.childNodes[i];
                if (node.nodeType === 3) {
                    nodes.push({node: node, column: column, length: node.length});
                    for (var j = 0; j <= node.length; j++) {
                        if (!points[column + j])
                            points[column + j] = {node: node, offset: j};
                        else if (j === 0)
                            points[column].forward = {node: node, offset: 0};
                    }
                    column += node.length;
                } else if (node.nodeType === 1) {
                    if (/ace_invisible_eol/.test(node.className)) {
                        eol = node;
                        continue;
                    }
                    if (/ace_inline_button/.test(node.className))
                        continue;
                    if (/(^| )ace_cjk( |$)/.test(node.className)) {
                        nodes.push({node: node.firstChild, column: column, length: 2, element: node});
                        points[column] = {node: parent, offset: i, element: node, end: false, column: column};
                        column += 2;
                        points[column] = {node: parent, offset: i + 1, element: node, end: true, column: column - 2};
                    } else {
                        walk(node);
                    }
                }
            }
        }
        walk(line);
        if (!column)
            points[0] = {node: line, offset: 0};
        if (!this.$bidiRange)
            this.$bidiRange = doc.createRange();
        if (!this.$bidiRange.getClientRects || !this.$bidiRange.getBoundingClientRect)
            return null;
        var rect = layer.element.getBoundingClientRect();
        var scale = layer.element.offsetWidth ? rect.width / layer.element.offsetWidth : 1;
        if (!scale)
            return null;
        return {points: points, nodes: nodes, length: column, left: rect.left, scale: scale,
            line: line, layer: layer, eol: eol};
    };

    this.$bidiPoint = function(data, column) {
        column = Math.max(0, Math.min(column, data.length));
        while (!data.points[column] && column > 0)
            column--;
        return data.points[column];
    };

    this.$bidiCaretLeft = function(data, point, overwrite) {
        var range = this.$bidiRange;
        var rect;
        if (overwrite && point.forward)
            point = point.forward;
        if (point.element) {
            rect = point.element.getBoundingClientRect();
            var handler = data.layer.session.$bidiHandler;
            var visual = handler.bidiUtil.getVisualFromLogicalIdx(point.column - handler.wrapIndent, handler.bidiMap);
            var rtl = handler.bidiMap.bidiLevels[visual] % 2 !== 0;
            return (((point.end !== rtl) && !overwrite ? rect.right : rect.left) - data.left) / data.scale;
        }
        range.setStart(point.node, point.offset);
        range.collapse(true);
        if (overwrite && point.node.nodeType === 3 && point.offset < point.node.length) {
            var length = /[\uD800-\uDBFF]/.test(point.node.nodeValue.charAt(point.offset)) ? 2 : 1;
            range.setEnd(point.node, Math.min(point.node.length, point.offset + length));
        }
        rect = range.getBoundingClientRect();
        if (!rect.height)
            return null;
        return (rect.left - data.left) / data.scale;
    };

    this.$getBidiCaret = function(screenRow, column, overwrite) {
        var data = this.$getBidiRow(screenRow);
        return data && this.$bidiCaretLeft(data, this.$bidiPoint(data, column), overwrite);
    };

    this.$getBidiSelection = function(screenRow, startColumn, endColumn) {
        var data = this.$getBidiRow(screenRow);
        if (!data)
            return null;
        var start = this.$bidiPoint(data, Math.min(startColumn, endColumn));
        var end = this.$bidiPoint(data, Math.max(startColumn, endColumn));
        var range = this.$bidiRange;
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        var rects = range.getClientRects();
        var selections = [];
        for (var i = 0; i < rects.length; i++) {
            if (rects[i].width > 0) {
                selections.push({
                    left: (rects[i].left - data.left) / data.scale,
                    width: rects[i].width / data.scale
                });
            }
        }
        selections.sort(function(a, b) { return a.left - b.left; });
        var merged = [];
        for (var i = 0; i < selections.length; i++) {
            var previous = merged[merged.length - 1];
            var next = selections[i];
            if (previous && next.left <= previous.left + previous.width + 0.5)
                previous.width = Math.max(previous.width, next.left + next.width - previous.left);
            else
                merged.push(next);
        }
        if (Math.max(startColumn, endColumn) > data.length) {
            var rect = data.eol && data.eol.getBoundingClientRect();
            var handler = data.layer.session.$bidiHandler;
            var left = rect ? (rect.left - data.left) / data.scale
                : this.$bidiCaretLeft(data, this.$bidiPoint(data, data.length), false);
            var width = rect ? rect.width / data.scale : this.$characterSize.width;
            if (!rect && handler.isRtlDir)
                left -= width;
            if (left != null)
                merged.push({left: left, width: width});
        }
        return merged;
    };

    this.$getBidiColumn = function(screenRow, offset, hasRle) {
        var data = this.$getBidiRow(screenRow);
        if (!data)
            return null;
        var doc = data.line.ownerDocument;
        var rect = data.line.getBoundingClientRect();
        var firstColumn = hasRle ? 1 : 0;
        var firstLeft = this.$bidiCaretLeft(data, this.$bidiPoint(data, firstColumn), false);
        var lastLeft = this.$bidiCaretLeft(data, this.$bidiPoint(data, data.length), false);
        if (firstLeft != null && Math.abs(offset - firstLeft) < 0.1)
            return firstColumn;
        if (lastLeft != null && Math.abs(offset - lastLeft) < 0.1)
            return data.length;
        var x = data.left + offset * data.scale;
        var clip = data.layer.element.parentNode.parentNode.getBoundingClientRect();
        var top = Math.max(rect.top, clip.top, 0);
        var bottom = Math.min(rect.bottom, clip.bottom, doc.defaultView.innerHeight);
        if (bottom <= top)
            return null;
        var y = (top + bottom) / 2;
        var nativePoint;
        var pointerEvents = data.line.style.pointerEvents;
        // Ace normally disables text-layer hit testing in favor of its mouse handler.
        data.line.style.pointerEvents = "auto";
        try {
            if (doc.caretPositionFromPoint) {
                var root = data.line.getRootNode && data.line.getRootNode();
                var caret = doc.caretPositionFromPoint(x, y, root && root.host ? {shadowRoots: [root]} : undefined);
                if (caret)
                    nativePoint = {node: caret.offsetNode, offset: caret.offset};
            } else if (doc.caretRangeFromPoint) {
                var caret = doc.caretRangeFromPoint(x, y);
                if (caret)
                    nativePoint = {node: caret.startContainer, offset: caret.startOffset};
            }
        } finally {
            data.line.style.pointerEvents = pointerEvents;
        }
        if (nativePoint) {
            for (var i = 0; i < data.nodes.length; i++) {
                var entry = data.nodes[i];
                if (entry.node === nativePoint.node) {
                    var column = entry.column + (entry.element ? (nativePoint.offset ? 2 : 0) : nativePoint.offset);
                    if (column === 0 || column === data.length) {
                        return Math.abs(offset - firstLeft) <= Math.abs(offset - lastLeft)
                            ? firstColumn : data.length;
                    }
                    return Math.max(hasRle ? 1 : 0, column);
                }
            }
        }
        if (doc.caretPositionFromPoint || doc.caretRangeFromPoint)
            return null;
        var bestColumn = null, distance = Infinity;
        for (var column = hasRle ? 1 : 0; column <= data.length; column++) {
            var point = data.points[column];
            if (!point)
                continue;
            // Never return the middle of a UTF-16 surrogate pair.
            if (point.node.nodeType === 3 && point.offset > 0
                && /[\uD800-\uDBFF]/.test(point.node.nodeValue.charAt(point.offset - 1))
                && /[\uDC00-\uDFFF]/.test(point.node.nodeValue.charAt(point.offset)))
                continue;
            var left = this.$bidiCaretLeft(data, point, false);
            if (left != null && Math.abs(left - offset) < distance) {
                distance = Math.abs(left - offset);
                bestColumn = column;
            }
        }
        return bestColumn;
    };

    this.destroy = function() {
        clearInterval(this.$pollSizeChangesTimer);
        if (this.$observer)
            this.$observer.disconnect();
        if (this.el && this.el.parentNode)
            this.el.parentNode.removeChild(this.el);
    };

    
    this.$getZoom = function getZoom(element) {
        if (!element || !element.parentElement) return 1;
        return (window.getComputedStyle(element).zoom || 1) * getZoom(element.parentElement);
    };
    this.$initTransformMeasureNodes = function() {
        var t = function(t, l) {
            return ["div", {
                style: "position: absolute;top:" + t + "px;left:" + l + "px;"
            }];
        };
        this.els = dom.buildDom([t(0, 0), t(L, 0), t(0, L), t(L, L)], this.el);
    };
    // general transforms from element coordinates x to screen coordinates u have the form
    // | m1[0] m2[0] t[0] |   | x |       | u |
    // | m1[1] m2[1] t[1] | . | y |  == k | v |
    // | h[0]  h[1]  1    |   | 1 |       | 1 |
    // this function finds the coeeficients of the matrix using positions of four points
    //  
    this.transformCoordinates = function(clientPos, elPos) {
        if (clientPos) {
            var zoom = this.$getZoom(this.el);
            clientPos = mul(1 / zoom, clientPos);
        }
        function solve(l1, l2, r) {
            var det = l1[1] * l2[0] - l1[0] * l2[1];
            return [
                (-l2[1] * r[0] + l2[0] * r[1]) / det,
                (+l1[1] * r[0] - l1[0] * r[1]) / det
            ];
        }
        function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
        function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
        function mul(a, b) { return [a * b[0], a * b[1]]; }

        if (!this.els)
            this.$initTransformMeasureNodes();
        
        function p(el) {
            var r = el.getBoundingClientRect();
            return [r.left, r.top];
        }

        var a = p(this.els[0]);
        var b = p(this.els[1]);
        var c = p(this.els[2]);
        var d = p(this.els[3]);

        var h = solve(sub(d, b), sub(d, c), sub(add(b, c), add(d, a)));

        var m1 = mul(1 + h[0], sub(b, a));
        var m2 = mul(1 + h[1], sub(c, a));
        
        if (elPos) {
            var x = elPos;
            var k = h[0] * x[0] / L + h[1] * x[1] / L + 1;
            var ut = add(mul(x[0], m1), mul(x[1], m2));
            return  add(mul(1 / k / L, ut), a);
        }
        var u = sub(clientPos, a);
        var f = solve(sub(m1, mul(h[0], u)), sub(m2, mul(h[1], u)), u);
        return mul(L, f);
    };
    
}).call(FontMetrics.prototype);

});
