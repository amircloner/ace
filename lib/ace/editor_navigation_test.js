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

var EditSession = require("./edit_session").EditSession;
var Editor = require("./editor").Editor;
var MockRenderer = require("./test/mockrenderer").MockRenderer;
var Range = require("./range").Range;
var assert = require("./test/assertions");

module.exports = {
    createEditSession : function(rows, cols) {
        var line = new Array(cols + 1).join("a");
        var text = new Array(rows).join(line + "\n") + line;
        return new EditSession(text);
    },

    "test: navigate to end of file should scroll the last line into view" : function() {
        var doc = this.createEditSession(200, 10);
        var editor = new Editor(new MockRenderer(), doc);

        editor.execCommand("gotoend");
        var cursor = editor.getCursorPosition();

        assert.ok(editor.getFirstVisibleRow() <= cursor.row);
        assert.ok(editor.getLastVisibleRow() >= cursor.row);
    },

    "test: navigate to start of file should scroll the first row into view" : function() {
        var doc = this.createEditSession(200, 10);
        var editor = new Editor(new MockRenderer(), doc);

        editor.moveCursorTo(editor.getLastVisibleRow() + 20);
        editor.execCommand("gotostart");

        assert.equal(editor.getFirstVisibleRow(), 0);
    },

    "test: goto hidden line should scroll the line into the middle of the viewport" : function() {
        var editor = new Editor(new MockRenderer(), this.createEditSession(200, 5));

        editor.navigateTo(0, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(101);
        assert.position(editor.getCursorPosition(), 100, 0);
        assert.equal(editor.getFirstVisibleRow(), 89);

        editor.navigateTo(100, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(11);
        assert.position(editor.getCursorPosition(), 10, 0);
        assert.equal(editor.getFirstVisibleRow(), 0);

        editor.navigateTo(100, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(6);
        assert.position(editor.getCursorPosition(), 5, 0);
        assert.equal(0, editor.getFirstVisibleRow(), 0);

        editor.navigateTo(100, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(1);
        assert.position(editor.getCursorPosition(), 0, 0);
        assert.equal(editor.getFirstVisibleRow(), 0);

        editor.navigateTo(0, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(191);
        assert.position(editor.getCursorPosition(), 190, 0);
        assert.equal(editor.getFirstVisibleRow(), 179);

        editor.navigateTo(0, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(196);
        assert.position(editor.getCursorPosition(), 195, 0);
        assert.equal(editor.getFirstVisibleRow(), 180);
    },

    "test: goto visible line should only move the cursor and not scroll": function() {
        var editor = new Editor(new MockRenderer(), this.createEditSession(200, 5));

        editor.navigateTo(0, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(12);
        assert.position(editor.getCursorPosition(), 11, 0);
        assert.equal(editor.getFirstVisibleRow(), 0);

        editor.navigateTo(30, 0);
        editor.renderer.scrollCursorIntoView();
        editor.gotoLine(33);
        assert.position(editor.getCursorPosition(), 32, 0);
        assert.equal(editor.getFirstVisibleRow(), 30);
    },

    "test: navigate from the end of a long line down to a short line and back should maintain the curser column": function() {
        var editor = new Editor(new MockRenderer(), new EditSession(["123456", "1"]));

        editor.navigateTo(0, 6);
        assert.position(editor.getCursorPosition(), 0, 6);

        editor.navigateDown();
        assert.position(editor.getCursorPosition(), 1, 1);

        editor.navigateUp();
        assert.position(editor.getCursorPosition(), 0, 6);
    },

    "test: reset desired column on navigate left or right": function() {
        var editor = new Editor(new MockRenderer(), new EditSession(["123456", "12"]));

        editor.navigateTo(0, 6);
        assert.position(editor.getCursorPosition(), 0, 6);

        editor.navigateDown();
        assert.position(editor.getCursorPosition(), 1, 2);

        editor.navigateLeft();
        assert.position(editor.getCursorPosition(), 1, 1);

        editor.navigateUp();
        assert.position(editor.getCursorPosition(), 0, 1);
    },

    "test: navigate within soft tabs based on setting": function() {
        var editor = new Editor(new MockRenderer(), new EditSession(["        "]));

        editor.getSession().setUseSoftTabs(true);
        editor.getSession().setTabSize(4);

        editor.navigateTo(0, 0);
        editor.navigateRight();
        assert.position(editor.getCursorPosition(), 0, 4);

        editor.navigateLeft();
        assert.position(editor.getCursorPosition(), 0, 0);

        editor.getSession().setNavigateWithinSoftTabs(true);

        editor.navigateRight();
        assert.position(editor.getCursorPosition(), 0, 1);

        editor.navigateTo(0, 4);
        editor.navigateLeft();
        assert.position(editor.getCursorPosition(), 0, 3);
    },
    
    "test: Persian arrows and shift arrows follow visual caret order without changing deletion": function() {
        var editor = new Editor(new MockRenderer(), new EditSession("\u0633\u0644\u0627\u0645"));
        var handler = editor.session.$bidiHandler;
        handler.updateCharacterWidths({
            $characterSize: {width: 10},
            $measureCharWidth: function() { return 8; },
            $getBidiCaretPositions: function(row, columns) {
                return columns.map(function(column) { return 40 - column * 10; });
            }
        });
        editor.navigateTo(0, 2);
        editor.execCommand("gotoleft");
        assert.position(editor.getCursorPosition(), 0, 3);
        editor.execCommand("gotoright");
        assert.position(editor.getCursorPosition(), 0, 2);
        editor.execCommand("selectleft");
        assert.position(editor.getCursorPosition(), 0, 3);
        assert.equal(editor.getSelectedText(), "\u0627");
        editor.clearSelection();
        editor.execCommand("backspace");
        assert.equal(editor.getValue(), "\u0633\u0644\u0645");
        editor.navigateTo(0, 1);
        editor.execCommand("del");
        assert.equal(editor.getValue(), "\u0633\u0645");
        editor.session.destroy();
    },

    "test: mixed visual navigation visits each caret and crosses LTR lines without cycling": function() {
        var editor = new Editor(new MockRenderer(), new EditSession("abc\na \u0633\u0644 b\nxyz"));
        var handler = editor.session.$bidiHandler;
        var offsets = [0, 10, 40, 30, 20, 50, 60];
        handler.updateCharacterWidths({
            $characterSize: {width: 10},
            $measureCharWidth: function() { return 8; },
            $getBidiCaretPositions: function(row, columns) {
                return columns.map(function(column) { return offsets[column]; });
            }
        });
        editor.navigateTo(0, 3);
        [0, 1, 4, 3, 2, 5, 6].forEach(function(column) {
            editor.execCommand("gotoright");
            assert.position(editor.getCursorPosition(), 1, column);
        });
        editor.execCommand("gotoright");
        assert.position(editor.getCursorPosition(), 2, 0);
        [6, 5, 2, 3, 4, 1, 0].forEach(function(column) {
            editor.execCommand("gotoleft");
            assert.position(editor.getCursorPosition(), 1, column);
        });
        editor.execCommand("gotoleft");
        assert.position(editor.getCursorPosition(), 0, 3);
        editor.session.destroy();
    },

    "test: shift selection enters English runs from their first character and retraces": function() {
        ["", "\u202B"].forEach(function(prefix) {
            [false, 7].forEach(function(wrap) {
                var text = prefix + "\u0633\u0644\u0627\u0645 TEXREADY \u062F\u0646\u06CC\u0627";
                var editor = new Editor(new MockRenderer(), new EditSession(text));
                var handler = editor.session.$bidiHandler;
                handler.updateCharacterWidths({
                    $characterSize: {width: 10},
                    $measureCharWidth: function() { return 8; },
                    $main: {getBoundingClientRect: function() { return {width: 200}; }}
                });
                if (wrap) {
                    editor.session.setUseWrapMode(true);
                    editor.session.adjustWrapLimit(wrap);
                }
                editor.navigateTo(0, prefix.length);
                for (var column = prefix.length + 1; column <= text.length; column++) {
                    editor.execCommand("selectleft");
                    assert.position(editor.getCursorPosition(), 0, column);
                    assert.equal(editor.getSelectedText(), text.slice(prefix.length, column));
                    assert.position(editor.selection.getSelectionAnchor(), 0, prefix.length);
                }
                for (var column = text.length - 1; column >= prefix.length; column--) {
                    editor.execCommand("selectright");
                    assert.position(editor.getCursorPosition(), 0, column);
                    assert.equal(editor.getSelectedText(), text.slice(prefix.length, column));
                }
                assert.ok(editor.selection.isEmpty());
                assert.equal(editor.getValue(), text);
                editor.session.destroy();
            });
        });
    },

    "test: mixed shift selection keeps the anchor run direction across wraps and lines": function() {
        [
            {text: "\u202B\u0633\u0644\u0627\u0645 TEXREADY \u062F\u0646\u06CC\u0627\nplain", anchor: 9, forward: "selectright", backward: "selectleft"},
            {text: "abc \u0633\u0644\u0627\u0645 TEXREADY", anchor: 5, forward: "selectleft", backward: "selectright"},
            {text: "\u202B\u0645\u06CC\u200C\u0631\u0648\u0645 TEXREADY", anchor: 4, forward: "selectleft", backward: "selectright"},
            {text: "abc\t\u0633\u0644\u0627\u0645 TEXREADY", anchor: 5, forward: "selectleft", backward: "selectright"}
        ].forEach(function(sample) {
            var editor = new Editor(new MockRenderer(), new EditSession(sample.text));
            editor.session.$bidiHandler.updateCharacterWidths({
                $characterSize: {width: 10},
                $measureCharWidth: function() { return 8; },
                $main: {getBoundingClientRect: function() { return {width: 200}; }}
            });
            editor.session.setUseWrapMode(true);
            editor.session.adjustWrapLimit(sample.anchor);
            editor.navigateTo(0, sample.anchor);
            for (var offset = sample.anchor + 1; offset <= sample.text.length; offset++) {
                editor.execCommand(sample.forward);
                assert.equal(editor.getSelectedText(), sample.text.slice(sample.anchor, offset));
                assert.position(editor.selection.getSelectionAnchor(), 0, sample.anchor);
            }
            for (var offset = sample.text.length - 1; offset >= sample.anchor - 2; offset--) {
                editor.execCommand(sample.backward);
                assert.equal(editor.getSelectedText(), sample.text.slice(Math.min(sample.anchor, offset), Math.max(sample.anchor, offset)));
            }
            editor.execCommand(sample.forward);
            editor.execCommand(sample.forward);
            assert.ok(editor.selection.isEmpty());
            assert.position(editor.getCursorPosition(), 0, sample.anchor);
            editor.session.destroy();
        });
    },

    "test: shift selection preserves leading RLE and ignores hidden fold direction": function() {
        var editor = new Editor(new MockRenderer(), new EditSession("\u202B\u0633\u0644\u0627\u0645"));
        editor.session.$bidiHandler.updateCharacterWidths({
            $characterSize: {width: 10},
            $measureCharWidth: function() { return 8; },
            $main: {getBoundingClientRect: function() { return {width: 200}; }}
        });
        editor.navigateTo(0, 1);
        editor.execCommand("selectright");
        assert.position(editor.getCursorPosition(), 0, 1);
        assert.ok(editor.selection.isEmpty());

        editor.setValue("start {\n\u202B\u0633\u0644\u0627\u0645 } tail", -1);
        editor.session.addFold("...", new Range(0, 7, 1, 6));
        editor.navigateTo(1, 6);
        editor.execCommand("selectright");
        assert.position(editor.getCursorPosition(), 1, 7);
        assert.equal(editor.getSelectedText(), "}");
        editor.execCommand("selectleft");
        assert.ok(editor.selection.isEmpty());
        editor.execCommand("selectleft");
        assert.position(editor.getCursorPosition(), 0, 7);
        assert.equal(editor.getSelectedText(), "\n\u202B\u0633\u0644\u0627\u0645 ");
        editor.session.destroy();
    },

    "test: Persian line end moves to line below not above": function() {
        var lines = [
            "\u062e\u0637 \u0627\u0648\u0644",
            "\u062e\u0637 \u062f\u0648\u0645",
            "\u062e\u0637 \u0633\u0648\u0645"
        ];
        var editor = new Editor(new MockRenderer(), new EditSession(lines));
        var handler = editor.session.$bidiHandler;
        handler.updateCharacterWidths({
            $characterSize: {width: 10},
            $measureCharWidth: function() { return 10; },
            $main: { getBoundingClientRect: function() { return {width: 100}; } }
        });
        assert.equal(handler.isRtlLine(0), true);
        assert.equal(handler.isRtlLine(1), true);
        editor.navigateTo(0, lines[0].length);
        editor.execCommand("gotoleft");
        assert.position(editor.getCursorPosition(), 1, 0);
        editor.navigateTo(1, lines[1].length);
        editor.execCommand("gotoleft");
        assert.position(editor.getCursorPosition(), 2, 0);
        editor.navigateTo(2, 0);
        editor.execCommand("gotoright");
        assert.position(editor.getCursorPosition(), 1, lines[1].length);
        editor.session.destroy();
    },

    "test: typing text should update the desired column": function() {
        var editor = new Editor(new MockRenderer(), new EditSession(["1234", "1234567890"]));

        editor.navigateTo(0, 3);
        editor.insert("juhu");
        
        editor.navigateDown();
        assert.position(editor.getCursorPosition(), 1, 7);
    }
};

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
