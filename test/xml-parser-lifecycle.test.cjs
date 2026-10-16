'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const upstream = require('xml-js-upstream').xml2js;
const { xml2js } = require('..');

const xml = '<?xml version="1.0"?><!DOCTYPE root><root xmlns:w="urn:word" key=" 01 " flag="true">'
  + '<?style color="blue"?><!-- comment --><w:t xml:space="preserve">  A &amp; Б 😀  </w:t>'
  + '<![CDATA[<literal>]]><n>42</n><n>false</n><empty/> </root>';

for (const options of [
  undefined, {}, { compact: true }, { addParent: true }, { compact: true, addParent: true },
  { captureSpacesBetweenElements: true, alwaysChildren: true },
  { trim: true, nativeType: true, nativeTypeAttributes: true },
  { sanitize: true }, { compact: true, alwaysArray: true },
  { compact: true, alwaysArray: ['n', '_text'] }, { instructionHasAttributes: true },
  { ignoreDeclaration: true, ignoreInstruction: true, ignoreAttributes: true, ignoreComment: true,
    ignoreCdata: true, ignoreDoctype: true, ignoreText: true },
  { elementsKey: 'children', nameKey: 'tag', attributesKey: 'attrs', textKey: 'value', parentKey: 'up', addParent: true },
  { compact: true, declarationKey: 'decl', instructionKey: 'pi', attributesKey: 'attrs',
    textKey: 'value', commentKey: 'comment', cdataKey: 'cdata', doctypeKey: 'doctype' },
  { textFn: value => 'text:' + value, elementNameFn: name => name.toUpperCase(),
    attributeValueFn: value => 'attr:' + value, attributeNameFn: name => name.toUpperCase(),
    commentFn: value => value.trim(), cdataFn: value => value.toUpperCase(), doctypeFn: value => value.trim(),
    instructionNameFn: name => name.toUpperCase(), instructionFn: value => 'pi:' + value },
]) {
  test('preserves upstream XML semantics: ' + JSON.stringify(options), () => {
    assert.deepEqual(xml2js(xml, options), upstream(xml, options));
  });
}

test('live results and parent links survive repeated independent calls', () => {
  const first = xml2js('<first><child>A</child></first>', { addParent: true });
  const child = first.elements[0].elements[0];
  for (let i = 0; i < 30; i++) {
    const next = xml2js(`<next id="${i}">B</next>`, { compact: i % 2 === 0 });
    assert.notEqual(next, first);
    assert.equal(child.elements[0].text, 'A');
    assert.equal(child.parent, first.elements[0]);
    assert.equal(first.elements[0].parent, first);
  }
});

test('nested callbacks use independent options and current nodes at multiple levels', () => {
  const innerResults = [];
  const outer = xml2js('<outer><text>outside</text><tail key="end"/></outer>', {
    addParent: true,
    textFn: (text, current) => {
      assert.equal(current.name, 'text');
      innerResults.push(xml2js('<inner>inside</inner>', { compact: true, textKey: 'value', textFn: value => {
        assert.deepEqual(xml2js('<deep/>'), { elements: [{ type: 'element', name: 'deep' }] });
        return value.toUpperCase();
      } }));
      return text.toUpperCase();
    },
    attributeValueFn: (value, name, current) => {
      assert.equal(current.name, 'outer');
      assert.equal(xml2js('<attribute/>', { compact: true }).attribute.constructor, Object);
      return value + '!';
    },
  });
  assert.deepEqual(innerResults, [{ inner: { value: 'INSIDE' } }]);
  assert.equal(outer.elements[0].elements[0].elements[0].text, 'OUTSIDE');
  assert.equal(outer.elements[0].elements[1].attributes.key, 'end!');
  assert.equal(outer.elements[0].elements[1].parent, outer.elements[0]);
});

for (const handled of [true, false]) {
  test(`nested callback failure is ${handled ? 'handled by outer callback' : 'observable at outer boundary'}`, () => {
    const failure = new Error('original callback exception');
    const nested = () => xml2js('<outer><child/><tail/></outer>', { elementNameFn: name => {
      if (name === 'child') {
        try {
          xml2js('<inner><partial/></inner>', { compact: true, elementNameFn: () => { throw failure; } });
        } catch (error) { assert.equal(error, failure); if (!handled) throw error; }
      }
      return name;
    } });
    if (handled) assert.deepEqual(nested(), upstream('<outer><child/><tail/></outer>'));
    else assert.throws(nested, error => error === failure);
    assert.deepEqual(xml2js('<after>ok</after>'), upstream('<after>ok</after>'));
  });
}

test('caught nested malformed XML and option getter failures leave the outer parse intact', () => {
  const failure = new Error('option getter failed');
  const result = xml2js('<root>before<child/>after</root>', { textFn: text => {
    assert.throws(() => xml2js('<inner><unfinished></wrong>'));
    assert.throws(() => xml2js('<never/>', { get compact() { xml2js('<getter/>'); throw failure; } }),
      error => error === failure);
    return text;
  } });
  assert.deepEqual(result, upstream('<root>before<child/>after</root>'));
});


test('malformed inputs preserve upstream outcomes and permit recovery', () => {
  for (const input of ['<root><child/></wrong>', '<root>bare & entity</root>', '<root>&unknown;</root>',
    '<root><unfinished>', '<root/>trailing', '', '<']) {
    function outcome(parse) {
      try { return { value: parse(input) }; }
      catch (error) { return { error: { name: error.name, message: error.message } }; }
    }
    assert.deepEqual(outcome(xml2js), outcome(upstream), input);
    assert.deepEqual(xml2js('<after>ok</after>'), upstream('<after>ok</after>'));
  }
});

test('direct callback exceptions preserve identity and permit recovery', () => {
  const failure = new Error('callback failed');
  assert.throws(() => xml2js('<root><partial/>text</root>', {
    textFn: () => { throw failure; },
  }), error => error === failure);
  assert.deepEqual(xml2js('<after/>'), upstream('<after/>'));
});

test('baseline and candidate use the same SAX version', () => {
  const { createRequire } = require('node:module');
  assert.equal(require('sax/package.json').version, '1.4.1');
  assert.equal(createRequire(require.resolve('xml-js-upstream'))('sax/package.json').version, '1.4.1');
});
