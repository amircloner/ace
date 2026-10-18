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

var assert = require("./test/assertions");
var EditSession = require("./edit_session").EditSession;
var Cursor = require("./layer/cursor").Cursor;
var Marker = require("./layer/marker").Marker;
var Range = require("./range").Range;

module.exports = {
    setUp: function() {
        this.session = new EditSession("plain\nab\u05d0\u05d1");
        this.metrics = {
            $characterSize: {width: 10},
            $measureCharWidth: function() { return 8; },
            $main: {
                getBoundingClientRect: function() { return {width: 40}; }
            }
        };
        this.handler = this.session.$bidiHandler;
        this.handler.updateCharacterWidths(this.metrics);
        this.handler.setShowInvisibles(false);
        this.config = {characterWidth: 10, lineHeight: 20, firstRowScreen: 0};
    },

    tearDown: function() {
        this.session.destroy();
    },

    "test: cursor uses measured bidi caret including zero and overwrite": function() {
        var calls = [], measured = 13.5;
        this.metrics.$getBidiCaret = function(row, column, overwrite) {
            calls.push([row, column, overwrite]);
            return measured;
        };
        var cursor = new Cursor(document.createElement("div"));
        cursor.setSession(this.session);
        cursor.setPadding(3);
        cursor.config = this.config;

        assert.deepEqual(cursor.getPixelPosition({row: 1, column: 3}), {left: 16.5, top: 20});
        this.session.setOverwrite(true);
        measured = 0;
        assert.deepEqual(cursor.getPixelPosition({row: 1, column: 3}), {left: 3, top: 20});
        assert.deepEqual(calls, [[1, 3, false], [1, 3, true]]);
        cursor.destroy();
    },

    "test: selections use measured rectangles including an empty result": function() {
        var calls = [], measured = [{left: 13.5, width: 7.25}, {left: 47, width: 6}];
        this.metrics.$getBidiSelection = function(row, start, end) {
            calls.push([row, start, end]);
            return measured;
        };
        this.handler.isBidiRow(1, 1, 0);
        assert.strictEqual(this.handler.getSelections(3, 1), measured);

        var marker = new Marker(document.createElement("div"));
        marker.setSession(this.session);
        marker.setPadding(3);
        marker.drawSingleLineMarker(null, new Range(1, 1, 1, 3), "selection", this.config);
        assert.equal(marker.element.children.length, 2);
        assert.equal(marker.element.children[0].style.left, "16.5px");
        assert.equal(marker.element.children[0].style.width, "7.25px");
        assert.equal(marker.element.children[1].style.left, "50px");
        assert.equal(marker.element.children[1].style.width, "6px");

        measured = [];
        assert.strictEqual(this.handler.getSelections(1, 3), measured);
        assert.deepEqual(calls, [[1, 3, 1], [1, 1, 3], [1, 1, 3]]);
    },

    "test: measured hit testing converts screen columns and only skips a leading RLE": function() {
        this.session.setValue("plain\n\t\u05d0\u05d1");
        this.session.setTabSize(4);
        this.handler.$isRtl = true;
        var calls = [], measured = 4;
        this.metrics.$getBidiColumn = function(row, offset, hasRle) {
            calls.push([row, offset, hasRle]);
            return measured;
        };

        assert.position(this.session.screenToDocumentPosition(1, 0, 47.5), 1, 1);
        measured = 0;
        assert.position(this.session.screenToDocumentPosition(1, 0, 0), 1, 0);
        this.session.insert({row: 1, column: 0}, this.handler.RLE);
        measured = 1;
        assert.position(this.session.screenToDocumentPosition(1, 0, 73.5), 1, 1);
        assert.deepEqual(calls, [[1, 47.5, false], [1, 0, false], [1, 73.5, true]]);
    },

    "test: null measurements retain fallback geometry and global RTL column zero": function() {
        var calls = [];
        this.metrics.$getBidiCaret = function(row, column, overwrite) {
            calls.push(["caret", row, column, overwrite]);
            return null;
        };
        this.metrics.$getBidiSelection = function(row, start, end) {
            calls.push(["selection", row, start, end]);
            return null;
        };
        this.metrics.$getBidiColumn = function(row, offset, hasRle) {
            calls.push(["column", row, offset, hasRle]);
            return null;
        };
        this.handler.isBidiRow(1, 1, 0);
        assert.equal(this.handler.getPosLeft(3), 28);
        assert.deepEqual(this.handler.getSelections(1, 3), [{left: 10, width: 10}, {left: 28, width: 8}]);
        assert.equal(this.handler.offsetToCol(28), 3);
        assert.deepEqual(calls, [
            ["caret", 1, 3, false],
            ["selection", 1, 1, 3],
            ["column", 1, 28, false]
        ]);

        this.handler.$isRtl = true;
        this.handler.setContentWidth(200);
        this.handler.isBidiRow(1, 1, 0);
        assert.equal(this.handler.getPosLeft(0), 176);
        assert.equal(this.handler.offsetToCol(176), 0);
        this.session.insert({row: 1, column: 0}, this.handler.RLE);
        this.handler.isBidiRow(1, 1, 0);
        assert.equal(this.handler.getPosLeft(1), 176);
        assert.equal(this.handler.offsetToCol(176), 1);
        // A hit past the RTL line must not target the zero-width leading RLE.
        assert.equal(this.handler.offsetToCol(200), 1);
    },

    "test: content width changes invalidate the cached row and refresh RTL offset": function() {
        this.handler.$isRtl = true;
        this.handler.setContentWidth(200);
        this.handler.isBidiRow(1, 1, 0);
        var map = this.handler.bidiMap;
        assert.equal(this.handler.rtlLineOffset, 160);

        this.handler.setContentWidth(200);
        assert.strictEqual(this.handler.currentRow, 1);
        this.handler.isBidiRow(1, 1, 0);
        assert.strictEqual(this.handler.bidiMap, map);

        this.handler.setContentWidth(260);
        assert.strictEqual(this.handler.currentRow, null);
        assert.equal(this.handler.contentWidth, 260);
        this.handler.isBidiRow(1, 1, 0);
        assert.strictEqual(this.handler.currentRow, 1);
        assert.notStrictEqual(this.handler.bidiMap, map);
        assert.equal(this.handler.rtlLineOffset, 220);
        assert.equal(this.handler.getPosLeft(0), 236);
    },

    "test: multiline markers use expanded tab columns and indented wrap boundaries": function() {
        var marker = new Marker(document.createElement("div"));
        marker.setSession(this.session);
        var calls = [];
        this.metrics.$getBidiSelection = function(row, start, end) {
            calls.push([row, start, end]);
            return [];
        };
        this.session.setTabSize(4);
        this.session.setValue("\t\u05d0\u05d1\n\u05d0\u05d1");
        var range = new Range(0, 1, 1, 1).toScreenRange(this.session);
        assert.range(range, 0, 4, 1, 1);
        marker.drawMultiLineMarker(null, range, "selection", this.config);
        assert.deepEqual(calls, [[0, 4, 7], [1, 0, 1]]);
        assert.range(range, 0, 4, 1, 1);

        this.session.setValue("\t\u05d0\u05d1\t\u05d0\u05d1\t\u05d0\u05d1\t\u05d0\u05d1\t\u05d0\u05d1\t\u05d0\u05d1");
        this.session.setOptions({wrap: 12, indentedSoftWrap: true, wrapMethod: "text"});
        this.session.adjustWrapLimit(12);
        assert.deepEqual(this.session.$wrapData[0].slice(), [7, 13]);
        assert.equal(this.session.$wrapData[0].indent, 4);
        range = new Range(0, 8, 0, 15).toScreenRange(this.session);
        assert.range(range, 1, 5, 2, 6);
        calls.length = 0;
        marker.drawMultiLineMarker(null, range, "selection", this.config);
        assert.deepEqual(calls, [[1, 5, 12], [2, 4, 6]]);
        assert.range(range, 1, 5, 2, 6);
    }
};

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
