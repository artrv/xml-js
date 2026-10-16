'use strict';

// Also executed as an ordinary script in Chromium; no Node dependencies here.
module.exports = function checkApi(api) {
  function equal(actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Unexpected value: ' + JSON.stringify(actual));
    }
  }
  var xml = '<root xmlns:p="urn:test"><p:item> A &amp; Б 😀 </p:item><n>42</n><p:item/></root>';
  var tree = api.xml2js(xml);
  equal(tree.elements[0].elements.map(function (node) { return node.name; }), ['p:item', 'n', 'p:item']);
  equal(tree.elements[0].elements[0].elements[0].text, ' A & Б 😀 ');
  equal(JSON.parse(api.xml2json(xml)), tree);
  equal(api.js2xml(tree), xml);
  equal(api.json2xml(JSON.stringify(tree)), xml);
  var compact = api.xml2js('<n>42</n>', { compact: true, nativeType: true });
  equal(compact, { n: { _text: 42 } });
  equal(api.js2xml(compact, { compact: true }), '<n>42</n>');
  equal(api.json2xml(JSON.stringify(compact), { compact: true }), '<n>42</n>');
  var nested = api.xml2js('<outer>text<tail/></outer>', {
    addParent: true,
    textFn: function (value) {
      equal(JSON.parse(api.xml2json('<inner/>', { compact: true })), { inner: {} });
      try {
        api.xml2js('<broken></wrong>');
        throw new Error('Malformed input did not throw');
      } catch (error) {
        if (error.message === 'Malformed input did not throw') throw error;
      }
      return value.toUpperCase();
    }
  });
  equal(nested.elements[0].elements[0].text, 'TEXT');
  if (nested.elements[0].parent !== nested || nested.elements[0].elements[1].parent !== nested.elements[0]) {
    throw new Error('Parent links were not preserved');
  }
  equal(JSON.parse(api.xml2json('<outer>text</outer>', {
    compact: true,
    textFn: function (value) { api.xml2js('<nested/>'); return value; }
  })), { outer: { _text: 'text' } });
  equal(api.xml2js('<after/>'), { elements: [{ type: 'element', name: 'after' }] });
  equal(tree.elements[0].elements[0].elements[0].text, ' A & Б 😀 ');
};
