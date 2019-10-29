/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var Parser = require("fastparse");

var srcsetQualifierRegexp = /(\s+(\d+w))?(\s+(\d+x))?\s*$/;

var processMatch = function(match, strUntilValue, name, value, index) {
	if(!this.isRelevantTagAttr(this.currentTag, name)) return;

	// allow to load several urls in srcsets, separated by commas
	var start = index + strUntilValue.length;
	var subMatches = value.split(/,/);
	for(var i = 0; i < subMatches.length; ++i) {
		var subMatch = subMatches[i];
		var length = subMatch.length;

		// remove initial spacing
		var initialSpace = /^\s+/.exec(subMatch);
		var spaceLength = initialSpace ? initialSpace[0].length : 0;

		// remove srcset qualifiers (2x, 110w, etc.), if any
		var qualifier = srcsetQualifierRegexp.exec(subMatch);
		if(qualifier) {
			length -= qualifier[0].length;
		}

		this.results.push({
			start: start,
			length: length,
			value: subMatch.substr(spaceLength, length - spaceLength)
		});

		start += subMatch.length + 1;
	}
};

var parser = new Parser({
	outside: {
		"<!--.*?-->": true,
		"<![CDATA[.*?]]>": true,
		"<[!\\?].*?>": true,
		"<\/[^>]+>": true,
		"<([a-zA-Z\\-:]+)\\s*": function(match, tagName) {
			this.currentTag = tagName;
			return "inside";
		}
	},
	inside: {
		"\\s+": true, // eat up whitespace
		">": "outside", // end of attributes
		// https://github.com/webpack-contrib/html-loader/pull/142/files
		"style\\s*=\\s*([\"\'])": function(match, quoteType) {
			this.styleQuoteType = quoteType;
			return "styleAttr";
		},
		"(([0-9a-zA-Z\\-:]+)\\s*=\\s*\")([^\"]*)\"": processMatch,
		"(([0-9a-zA-Z\\-:]+)\\s*=\\s*\')([^\']*)\'": processMatch,
		"(([0-9a-zA-Z\\-:]+)\\s*=\\s*)([^\\s>]+)": processMatch
	},
	// https://github.com/webpack-contrib/html-loader/pull/142/files
	styleAttr: {
		"\\s+": true, // eat up whitespace
		"\\\\[\'\"]": true, // eat escaped quotes so the end of style attribute rule doesn't find them
		"([\"\'])": function(match, quoteType) {
			return this.styleQuoteType === quoteType ?
				"inside" : // end of style attribute, beginning and end quotes match
				false;
		},
		"((url\\([\"\']?))([^\"\'\\)]*)[\"\']?\\)": function(match, strUntilValue, name, value, index) {
			return processMatch.call(this, match, strUntilValue, "style", value, index)
		}
	}
});

module.exports = function parse(html, isRelevantTagAttr) {
	return parser.parse("outside", html, {
		currentTag: null,
		styleQuoteType: null,
		results: [],
		isRelevantTagAttr: isRelevantTagAttr
	}).results;
};
