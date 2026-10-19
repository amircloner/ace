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

if (typeof process !== "undefined") {
    require("amd-loader");
    require("./test/mockdom");
}

define(function(require, exports, module) {
"use strict";

var Range = require("./range").Range;
var Editor = require("./editor").Editor;
var EditSession = require("./edit_session").EditSession;
var VirtualRenderer = require("./virtual_renderer").VirtualRenderer;
var assert = require("./test/assertions");
require("./ext/error_marker");
require("./ext/rtl");

function setScreenPosition(node, rect) {
    node.style.left = rect[0] + "px";
    node.style.top = rect[1] + "px";
    node.style.width = rect[2] + "px";
    node.style.height = rect[3] + "px";
}

function renderedCaret(line, column, layer) {
    var walker = document.createTreeWalker(line, 4, null);
    var node;
    while (node = walker.nextNode()) {
        if (column <= node.length) {
            var range = document.createRange();
            range.setStart(node, column);
            range.collapse(true);
            return range.getBoundingClientRect().left - layer.element.getBoundingClientRect().left;
        }
        column -= node.length;
    }
}

var editor = null;
module.exports = {
    setUp: function() {
        if (editor)
            editor.destroy();
        var el = document.createElement("div");

        el.style.left = "20px";
        el.style.top = "30px";
        el.style.width = "300px";
        el.style.height = "100px";
        document.body.appendChild(el);
        var renderer = new VirtualRenderer(el);
        editor = new Editor(renderer);
        editor.on("destroy", function() {
            document.body.removeChild(el);
        });
    },
    tearDown: function() {
        editor && editor.destroy();
        editor = null;
    },
    "test: screen2text the column should be rounded to the next character edge" : function(done) {
        var renderer = editor.renderer;

        renderer.setPadding(0);
        renderer.setSession(new EditSession("1234"));

        var r = renderer.scroller.getBoundingClientRect();
        function testPixelToText(x, y, row, column) {
            assert.position(renderer.screenToTextCoordinates(x+r.left, y+r.top), row, column);
        }

        renderer.characterWidth = 10;
        renderer.lineHeight = 15;

        testPixelToText(4, 0, 0, 0);
        testPixelToText(5, 0, 0, 1);
        testPixelToText(9, 0, 0, 1);
        testPixelToText(10, 0, 0, 1);
        testPixelToText(14, 0, 0, 1);
        testPixelToText(15, 0, 0, 2);
        done();
    },
    "test: handle css transforms" : function(done) {
        var renderer = editor.renderer;
        var fontMetrics = renderer.$fontMetrics;
        setScreenPosition(editor.container, [20, 30, 300, 100]);
        var measureNode = fontMetrics.$measureNode;
        setScreenPosition(measureNode, [0, 0, 10 * measureNode.textContent.length, 15]);
        setScreenPosition(fontMetrics.$main, [0, 0, 10 * measureNode.textContent.length, 15]);
        
        fontMetrics.$characterSize.width = 10;
        renderer.setPadding(0);
        renderer.onResize(true);
        
        assert.equal(fontMetrics.getCharacterWidth(), 1);
        
        renderer.characterWidth = 10;
        renderer.lineHeight = 15;
        
        renderer.gutterWidth = 40;
        editor.setOption("hasCssTransforms", true);
        editor.container.style.transform = "matrix3d(0.7, 0, 0, -0.00066, 0, 0.82, 0, -0.001, 0, 0, 1, 0, -100, -20, 10, 1)";
        editor.container.style.zoom = 1.5;
        var pos = renderer.pixelToScreenCoordinates(100, 200);
        
        var els = fontMetrics.els;
        var rects = [
            [0, 0],
            [-37.60084843635559, 161.62494659423828],
            [114.50254130363464, -6.890693664550781],
            [98.85665202140808, 179.16063690185547]
        ];
        rects.forEach(function(rect, i) {
            els[i].getBoundingClientRect = function() { 
                return { left: rect[0], top: rect[1] };
            };
        });
        
        var r0 = els[0].getBoundingClientRect();
        pos = renderer.pixelToScreenCoordinates(r0.left + 100, r0.top + 200);
        assert.position(pos, 10, 11);
        
        var pos1 = fontMetrics.transformCoordinates(null, [0, 200]);
        assert.ok(pos1[0] - rects[2][0] < 10e-6);
        assert.ok(pos1[1] - rects[2][1] < 10e-6);
        editor.renderer.$loop._flush();
        
        done();
    },
    
    "test scrollmargin + autosize": function(done) {
        editor.setOptions({
            maxLines: 100,
            wrap: true
        });        
        editor.renderer.setScrollMargin(10, 10);
        editor.setValue("\n\n");
        editor.setValue("\n\n\n\n");
        editor.renderer.once("afterRender", function() {
            setTimeout(function() {
                done();
            }, 0);
        });
    },
    
    "test invalid valus of minLines": function() {
        editor.setOptions({
            maxLines: Infinity,
            minLines: Infinity
        });
        editor.renderer.$loop._flush();
        editor.setOptions({
            maxLines: NaN,
            minLines: NaN
        });
        editor.renderer.$loop._flush();
        editor.setOptions({
            maxLines: Number.MAX_SAFE_INTEGER + 1,
            minLines: Number.MAX_SAFE_INTEGER + 1
        });
        editor.renderer.$loop._flush();
    },
    
    "test line widgets": function() {
        editor.session.setValue("a\nb|c\nd");
        editor.session.setAnnotations([{row: 1, column: 2, type: "error"}]);
        editor.execCommand(editor.commands.byName.goToNextError);
        assert.position(editor.getCursorPosition(), 1, 2);
        editor.renderer.$loop._flush();
        assert.ok(editor.session.lineWidgets[1]);
    },
    
    "test wrapped text rendering": function() {
        editor.setValue("a".repeat(452) + "\n" + "b".repeat(100) + "\nxxxxxx", -1);
        editor.container.style.height = "500px";
        editor.setOption("wrap", 40);
        editor.resize(true);
        editor.renderer.$loop._flush();
        
        assert.equal(editor.renderer.$changedLines, null);
        editor.session.remove(new Range(0, 10, 0, 350));
        editor.session.insert({row: 1, column: 1}, "l".repeat(350));
        editor.renderer.$loop._flush();
        var lines = editor.renderer.$textLayer.element.children;
        assert.notEqual(lines[0].style.height, lines[1].style.height);
        assert.equal(lines[0].style.height, lines[1].style.top);
    },
    
    "test resize": function() {
        editor.setValue("Juhu kinners!");
        editor.resize(true);
    },

    "test bidi caret and clicks follow shaped Persian text": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial, sans-serif", fontSize: 24, rtlText: true});
        var samples = ["\u0633\u0644\u0627\u0645", "\u202B\u0645\u06cc\u200c\u0631\u0648\u0645",
            "abc \u0633\u0644\u0627\u0645 123", "\u202B\u0644\u0627\u200c\u0628 \u0628\u064e\u0628"];
        samples.forEach(function(text) {
            editor.setValue(text, -1);
            editor.renderer.updateFull(true);
            var handler = editor.session.$bidiHandler;
            var layer = editor.renderer.$textLayer;
            var line = layer.$lines.cells[0].element;
            assert.ok(handler.isBidiRow(0));
            for (var column = text.charAt(0) == handler.RLE ? 1 : 0; column <= text.length; column++) {
                var nativeLeft = renderedCaret(line, column, layer);
                assert.ok(Math.abs(handler.getPosLeft(column) - nativeLeft) < 0.1);
                var hitColumn = handler.offsetToCol(nativeLeft);
                // Joining controls and bidi boundaries may share a caret position.
                assert.ok(Math.abs(renderedCaret(line, hitColumn, layer) - nativeLeft) < 0.1);
                editor.moveCursorTo(0, column);
                editor.renderer.updateFull(true);
                assert.ok(Math.abs(editor.renderer.$cursorLayer.$pixelPos.left
                    - editor.renderer.$padding - nativeLeft) < 0.1);
            }
        });
    },

    "test bidi selection matches native range across syntax spans": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "serif", fontSize: 24, rtlText: true});
        var text = "\u202B\u0633\u0644\u0627\u0645 abc \u0645\u06cc\u200c\u0631\u0648\u0645";
        editor.setValue(text, -1);
        editor.session.getTokens = function() {
            return [{type: "keyword", value: text.slice(0, 5)},
                {type: "text", value: text.slice(5, 10)},
                {type: "comment", value: text.slice(10)}];
        };
        editor.renderer.updateFull(true);
        var layer = editor.renderer.$textLayer;
        var line = layer.$lines.cells[0].element;
        var walker = document.createTreeWalker(line, 4, null);
        var first = walker.nextNode(), last = first, node;
        while (node = walker.nextNode()) last = node;
        var range = document.createRange();
        range.setStart(first, 1);
        range.setEnd(last, last.length);
        var nativeRects = range.getClientRects();
        var nativeLeft = Infinity, nativeRight = -Infinity;
        for (var i = 0; i < nativeRects.length; i++) {
            nativeLeft = Math.min(nativeLeft, nativeRects[i].left);
            nativeRight = Math.max(nativeRight, nativeRects[i].right);
        }
        editor.selection.setRange(new Range(0, 1, 0, text.length));
        editor.renderer.updateFull(true);
        var selection = editor.renderer.$markerBack.element.querySelector(".ace_selection");
        assert.ok(selection);
        var rect = selection.getBoundingClientRect();
        assert.ok(Math.abs(rect.left - nativeLeft) < 0.1);
        assert.ok(Math.abs(rect.right - nativeRight) < 0.1);
    },

    "test bidi geometry refreshes on wrapping resize and font changes": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true, wrap: 12});
        editor.setValue("\u202B  \u0633\u0644\u0627\u0645 \u0645\u06cc\u200c\u0631\u0648\u0645 \u0633\u0644\u0627\u0645 \u0633\u0644\u0627\u0645", -1);
        function check() {
            editor.renderer.updateFull(true);
            var session = editor.session;
            var layer = editor.renderer.$textLayer;
            var lines = layer.$lines.cells[0].element.children;
            assert.ok(lines.length > 1);
            for (var i = 0; i < lines.length; i++) {
                var row = session.documentToScreenRow(0, 0) + i;
                assert.ok(session.$bidiHandler.isBidiRow(row));
                var column = session.$bidiHandler.wrapIndent + 1;
                assert.ok(Math.abs(session.$bidiHandler.getPosLeft(column)
                    - renderedCaret(lines[i], column, layer)) < 0.1);
            }
        }
        check();
        editor.container.style.width = "500px";
        editor.resize(true);
        check();
        editor.setOption("fontFamily", "serif");
        check();
    },

    "test global rtl permits column zero and bidi tabs keep screen columns": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtl: true});
        editor.setValue("\u0633\u0644\u0627\u0645", -1);
        editor.renderer.updateFull(true);
        var handler = editor.session.$bidiHandler;
        handler.isBidiRow(0);
        assert.equal(handler.offsetToCol(handler.getPosLeft(0)), 0);
        editor.setOption("rtl", false);
        editor.setValue("\t\u0633\u0644\u0627\u0645", -1);
        editor.renderer.updateFull(true);
        handler.isBidiRow(0);
        var layer = editor.renderer.$textLayer;
        var line = layer.$lines.cells[0].element;
        var lastColumn = editor.session.documentToScreenColumn(0, 5);
        assert.equal(lastColumn, editor.session.getTabSize() + 4);
        assert.ok(Math.abs(handler.getPosLeft(lastColumn) - renderedCaret(line, lastColumn, layer)) < 0.1);
    },

    "test bidi glyph hit testing uses native affinity without scanning the line": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24});
        editor.setValue("abc \u0633\u0644\u0627\u0645 123", -1);
        editor.renderer.updateFull(true);
        var handler = editor.session.$bidiHandler;
        handler.isBidiRow(0);
        var layer = editor.renderer.$textLayer;
        var node = layer.$lines.cells[0].element.firstChild;
        var range = document.createRange();
        range.setStart(node, 9);
        range.setEnd(node, 10);
        var rect = range.getBoundingClientRect();
        var left = rect.left - layer.element.getBoundingClientRect().left;
        assert.equal(handler.offsetToCol(left + rect.width * 0.2), 9);
        assert.equal(handler.offsetToCol(left + rect.width * 0.8), 10);

        editor.setValue("\u0633\u0644\u0627\u0645".repeat(1000), -1);
        editor.renderer.updateFull(true);
        handler.isBidiRow(0);
        var metrics = editor.renderer.$fontMetrics;
        var caretLeft = metrics.$bidiCaretLeft;
        var calls = 0;
        metrics.$bidiCaretLeft = function() {
            calls++;
            return caretLeft.apply(this, arguments);
        };
        handler.offsetToCol(30);
        metrics.$bidiCaretLeft = caretLeft;
        assert.ok(calls <= 2);
    },

    "test bidi surrogate tabs CJK and overwrite token boundaries": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtl: true});
        editor.setValue("\u0633\u0644\u0627\u0645\uD83D\uDE00\tXYZ", -1);
        editor.renderer.updateFull(true);
        var handler = editor.session.$bidiHandler;
        var layer = editor.renderer.$textLayer;
        handler.isBidiRow(0);
        var column = editor.session.documentToScreenColumn(0, 7);
        assert.equal(column, 8);
        assert.ok(Math.abs(handler.getPosLeft(column)
            - renderedCaret(layer.$lines.cells[0].element, column, layer)) < 0.1);

        editor.setValue("\u0633\u0644\u0627\u0645\u754c\u0633\u0644\u0627\u0645", -1);
        editor.renderer.updateFull(true);
        handler.isBidiRow(0);
        var rect = layer.$lines.cells[0].element.querySelector(".ace_cjk").getBoundingClientRect();
        var left = layer.element.getBoundingClientRect().left;
        assert.ok(Math.abs(handler.getPosLeft(4) - (rect.right - left)) < 0.1);
        assert.ok(Math.abs(handler.getPosLeft(6) - (rect.left - left)) < 0.1);

        editor.setValue("\u0633\u0644\u0627\u0645\u754cABC", -1);
        editor.setOverwrite(true);
        editor.renderer.updateFull(true);
        handler.isBidiRow(0);
        var nextNode = layer.$lines.cells[0].element.querySelector(".ace_cjk").nextSibling;
        var nextRange = document.createRange();
        nextRange.setStart(nextNode, 0);
        nextRange.setEnd(nextNode, 1);
        assert.ok(Math.abs(handler.getPosLeft(6) - nextRange.getBoundingClientRect().left
            + layer.element.getBoundingClientRect().left) < 0.1);

        var text = "abc \u0633\u0644\u0627\u0645";
        editor.setValue(text, -1);
        editor.session.getTokens = function() {
            return [{type: "text", value: text.slice(0, 4)}, {type: "comment", value: text.slice(4)}];
        };
        editor.setOverwrite(true);
        editor.renderer.updateFull(true);
        handler.isBidiRow(0);
        var node = layer.$lines.cells[0].element.querySelector(".ace_comment").firstChild;
        var range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, 1);
        assert.ok(Math.abs(handler.getPosLeft(4) - range.getBoundingClientRect().left
            + layer.element.getBoundingClientRect().left) < 0.1);
    },

    "test bidi newline selection and disabling per-line rtl": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true});
        editor.setValue("\u202B\u0633\u0644\u0627\u0645\n\u0633\u0644\u0627\u0645", -1);
        editor.selection.setRange(new Range(0, 5, 1, 0));
        editor.renderer.updateFull(true);
        assert.ok(editor.renderer.$markerBack.element.querySelector(".ace_selection"));
        var layer = editor.renderer.$textLayer;
        assert.equal(layer.$lines.cells[0].element.style.direction, "rtl");
        editor.setOption("rtlText", false);
        editor.renderer.updateFull(true);
        assert.equal(layer.$lines.cells[0].element.style.direction, "");
    },

    "test bidi hit testing supports clipped rows and shadow roots": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24});
        editor.setValue("\u0633\u0644\u0627\u0645\n\u0633\u0644\u0627\u0645\n".repeat(10), -1);
        editor.renderer.updateFull(true);
        editor.session.setScrollTop(editor.renderer.lineHeight * 0.7);
        editor.renderer.$loop._flush();
        var handler = editor.session.$bidiHandler;
        handler.isBidiRow(0);
        var left = handler.getPosLeft(3);
        assert.equal(handler.offsetToCol(left), 3);

        if (!editor.container.attachShadow || !document.caretPositionFromPoint) return;
        var host = document.createElement("div");
        document.body.appendChild(host);
        var root = host.attachShadow({mode: "open"});
        root.appendChild(editor.container);
        editor.renderer.attachToShadowRoot();
        editor.session.setScrollTop(0);
        editor.resize(true);
        editor.renderer.updateFull(true);
        handler.isBidiRow(0);
        assert.equal(handler.offsetToCol(handler.getPosLeft(3)), 3);
        document.body.appendChild(editor.container);
        host.remove();
    },

    "test bidi abstract arrow navigation never cycles with mixed text and wrapping": function() {
        var text = "Your abstract.\n\u202B\u0633\u0644\u0627\u0645 \u0634\u0645\u0627 \u062e\u0648\u0628\u06cc\u062f \u0622\u0631\u0647 \u061f \u0627\u06cc\u0646 \u06cc\u06a9\u0647 \u062c\u0645\u0644\u0647 \u067e\u0631\u0633\u0634\u06cc \u0628\u0648\u062f \u0648 \u0627\u0635\u0644\u0627 \u062e\u0628\u0631\u06cc \u0646\u0628\u0648\u062f \u060c\u0631 TEXREADY\n\\end{abstract}";
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true});
        [false, 40].forEach(function(wrap) {
            editor.setOption("wrap", wrap);
            ["gotoleft", "gotoright", "selectleft", "selectright"].forEach(function(command) {
                editor.setValue(text, -1);
                var backward = /left$/.test(command);
                var lastRow = editor.session.getLength() - 1;
                var lastColumn = editor.session.getLine(lastRow).length;
                if (backward)
                    editor.moveCursorTo(lastRow, lastColumn);
                var seen = Object.create(null);
                for (var i = 0; i < text.length + 1; i++) {
                    editor.renderer.updateFull(true);
                    var cursor = editor.getCursorPosition();
                    if (backward ? cursor.row === 0 && cursor.column === 0
                        : cursor.row === lastRow && cursor.column === lastColumn)
                        break;
                    var key = cursor.row + ":" + cursor.column;
                    assert.ok(!seen[key], command + " cycled at " + key);
                    seen[key] = true;
                    editor.execCommand(command);
                }
                assert.ok(i < text.length + 1, command + " did not reach the document boundary");
            });
        });
    },

    "test bidi arrows move visually through Persian mixed runs and wrapped lines": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true});
        var samples = ["\u0633\u0644\u0627\u0645", "\u202B\u0645\u06cc\u200c\u0631\u0648\u0645 abc 123",
            "abc \u0633\u0644\u0627\u0645 123", "\u202B  \u0633\u0644\u0627\u0645 \u0634\u0645\u0627 \u062e\u0648\u0628\u06cc\u062f \u0633\u0644\u0627\u0645"];
        [false, 12].forEach(function(wrap) {
            editor.setOption("wrap", wrap);
            samples.forEach(function(text) {
                editor.setValue(text, -1);
                editor.renderer.updateFull(true);
                ["gotoleft", "gotoright"].forEach(function(command) {
                    var direction = /left$/.test(command) ? -1 : 1;
                    for (var column = text.charAt(0) === "\u202B" ? 1 : 0; column <= text.length; column++) {
                        editor.clearSelection();
                        editor.moveCursorTo(0, column);
                        var before = editor.renderer.$cursorLayer.getPixelPosition();
                        editor.execCommand(command);
                        var after = editor.renderer.$cursorLayer.getPixelPosition();
                        if (before.top === after.top)
                            assert.ok((after.left - before.left) * direction >= -0.1,
                                command + " moved backwards at " + column + " in " + text);
                    }
                });
            });
        });
    },

    "test bidi shift selection grows from Persian into the beginning of English runs": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true});
        [false, 7].forEach(function(wrap) {
            editor.setOption("wrap", wrap);
            ["\u0633\u0644\u0627\u0645 TEXREADY \u062F\u0646\u06CC\u0627", "\u202B\u0645\u06CC\u200C\u0631\u0648\u0645 TEXREADY 123"].forEach(function(text) {
                editor.setValue(text, -1);
                editor.renderer.updateFull(true);
                var start = text.charAt(0) === "\u202B" ? 1 : 0;
                editor.moveCursorTo(0, start);
                for (var column = start + 1; column <= text.length; column++) {
                    editor.execCommand("selectleft");
                    editor.renderer.updateFull(true);
                    assert.position(editor.getCursorPosition(), 0, column);
                    assert.equal(editor.getSelectedText(), text.slice(start, column));
                }
                for (var column = text.length - 1; column >= start; column--) {
                    editor.execCommand("selectright");
                    editor.renderer.updateFull(true);
                    assert.position(editor.getCursorPosition(), 0, column);
                    assert.equal(editor.getSelectedText(), text.slice(start, column));
                }
                assert.ok(editor.selection.isEmpty());
            });
        });
    },

    "test bidi vertical navigation keeps pixel X across short latex lines": function() {
        if (!document.createRange) return;
        editor.container.style.width = "1000px";
        editor.resize(true);
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true});
        editor.setValue("Your abstract.\n\u202B\u0633\u0644\u0627\u0645 \u0634\u0645\u0627 \u062e\u0648\u0628\u06cc\u062f \u0622\u0631\u0647 \u061f \u0627\u06cc\u0646 \u06cc\u06a9\u0647 \u062c\u0645\u0644\u0647 \u067e\u0631\u0633\u0634\u06cc \u0628\u0648\u062f \u0648 \u0627\u0635\u0644\u0627 \u062e\u0628\u0631\u06cc \u0646\u0628\u0648\u062f \u060c\u0631 TEXREADY\n\\end{abstract}", -1);
        editor.renderer.updateFull(true);
        editor.moveCursorTo(1, 30);
        var handler = editor.session.$bidiHandler;
        handler.isBidiRow(1);
        var expectedLeft = handler.getPosLeft(30);
        [["godown", "goup"], ["goup", "godown"], ["selectdown", "selectup"]].forEach(function(commands) {
            editor.clearSelection();
            editor.moveCursorTo(1, 30);
            editor.execCommand(commands[0]);
            editor.renderer.updateFull(true);
            editor.execCommand(commands[1]);
            editor.renderer.updateFull(true);
            var cursor = editor.getCursorPosition();
            assert.position(cursor, 1, 30);
            handler.isBidiRow(1);
            assert.ok(Math.abs(handler.getPosLeft(cursor.column) - expectedLeft) < 0.1);
        });
    },

    "test bidi left continues through RTL wraps and folds without trapping at RLE": function() {
        if (!document.createRange) return;
        editor.setOptions({fontFamily: "Arial", fontSize: 24, rtlText: true, wrap: 8});
        var text = "\u202B  \u0633\u0644\u0627\u0645 \u0634\u0645\u0627 \u062e\u0648\u0628\u06cc\u062f \u0633\u0644\u0627\u0645";
        editor.setValue(text, -1);
        editor.moveCursorTo(0, 1);
        var seen = {};
        for (var i = 0; i < text.length - 1; i++) {
            editor.renderer.updateFull(true);
            var column = editor.getCursorPosition().column;
            assert.ok(!seen[column], "left stuck or cycled at wrapped column " + column);
            seen[column] = true;
            editor.execCommand("gotoleft");
        }
        assert.position(editor.getCursorPosition(), 0, text.length);

        editor.setOption("wrap", false);
        editor.setValue("plain\n\u202B\u0633\u0644\u0627\u0645 text", -1);
        editor.session.addFold("...", new Range(1, 6, 1, 10));
        editor.renderer.updateFull(true);
        editor.moveCursorTo(1, 3);
        editor.execCommand("gotoleft");
        assert.position(editor.getCursorPosition(), 1, 4);
    },

    "test placeholder": function() {
        editor.setOption("placeholder", "hello");
        assert.equal(editor.renderer.content.textContent, "hello");

        editor.setOption("placeholder", "new");
        assert.equal(editor.renderer.content.textContent, "new");

        editor.setValue("test");
        editor.renderer.$loop._flush();
        assert.equal(editor.renderer.content.textContent, "test");

        editor.setOption("placeholder", "only visible for empty value");
        assert.equal(editor.renderer.content.textContent, "test");

        editor.setValue("");
        editor.renderer.$loop._flush();
        editor._signal("input", {});
        assert.equal(editor.renderer.content.textContent, "only visible for empty value");
    }

    // change tab size after setDocument (for text layer)
};

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
