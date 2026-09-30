'use strict';

/**
 * Integration tests for index.html.
 *
 * The UI in src/app.js reaches into the page by id, by `[data-*]` hook and by
 * script order. Nothing links the two files at build time (there is no build),
 * so these tests are the contract: rename a hook in one place and the suite
 * fails instead of the app silently breaking in the browser.
 *
 * Run with:  node --test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../src/todos.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

/* ------------------------------------------------------------------ *
 * Tiny, dependency-free helpers
 * ------------------------------------------------------------------ */

/** Every `id="..."` declared in the markup. */
function markupIds() {
  return Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
}

/** Every id looked up by `document.getElementById('...')` in app.js. */
function appElementIds() {
  return Array.from(
    appSource.matchAll(/\bgetElementById\('([^']+)'\)/g),
    (match) => match[1]
  );
}

/** All values of a `[data-<name>]` hook, in document order. */
function dataHook(name) {
  const pattern = new RegExp('data-' + name + '="([^"]*)"', 'g');
  return Array.from(html.matchAll(pattern), (match) => match[1]);
}

/** The `<option value="...">` values inside the `<select>` with the given id. */
function optionsOf(id) {
  const start = html.indexOf('id="' + id + '"');
  assert.notEqual(start, -1, `#${id} should be declared in index.html`);
  const end = html.indexOf('</select>', start);
  assert.notEqual(end, -1, `#${id} should be a <select> element`);
  return Array.from(
    html.slice(start, end).matchAll(/<option[^>]*value="([^"]*)"/g),
    (match) => match[1]
  );
}

/** The value of `attr` on the element whose id is `id`. */
function attributeOf(id, attr) {
  const start = html.indexOf('id="' + id + '"');
  assert.notEqual(start, -1, `#${id} should be declared in index.html`);
  const tag = html.slice(start, html.indexOf('>', start));
  const match = tag.match(new RegExp('\\b' + attr + '="([^"]*)"'));
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ *
 * Element hooks
 * ------------------------------------------------------------------ */

test('every element app.js looks up by id exists in index.html', () => {
  const declared = new Set(markupIds());
  const wanted = appElementIds();

  assert.ok(wanted.length > 0, 'app.js should look up at least one element');
  const missing = wanted.filter((id) => !declared.has(id));
  assert.deepEqual(missing, [], 'ids referenced by app.js but missing from the markup');
});

test('index.html declares no duplicate ids', () => {
  const ids = markupIds();
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicates, [], 'duplicate ids break getElementById');
});

/* ------------------------------------------------------------------ *
 * Data hooks and selects stay in lockstep with the core
 * ------------------------------------------------------------------ */

test('data-filter and data-count hooks cover exactly the core filters', () => {
  assert.deepEqual(dataHook('filter'), core.FILTERS);
  assert.deepEqual(dataHook('count'), core.FILTERS);
});

test('the sort and priority selects offer exactly the core options', () => {
  assert.deepEqual(optionsOf('sort'), core.SORTS);
  assert.deepEqual(optionsOf('new-priority'), core.PRIORITIES);
});

test('the markup title limit matches the core limit', () => {
  assert.equal(Number(attributeOf('new-todo', 'maxlength')), core.MAX_TITLE_LENGTH);
});

/* ------------------------------------------------------------------ *
 * Wiring and accessibility hooks
 * ------------------------------------------------------------------ */

test('assets are local and scripts load todos.js before app.js', () => {
  const scripts = Array.from(
    html.matchAll(/<script[^>]*src="([^"]+)"/g),
    (match) => match[1]
  );
  assert.deepEqual(
    scripts,
    ['src/todos.js', 'src/app.js'],
    'app.js depends on window.TodoCore, so todos.js must come first'
  );

  const linked = Array.from(
    html.matchAll(/<link[^>]*href="([^"]+)"/g),
    (match) => match[1]
  );
  assert.ok(linked.includes('styles.css'), 'styles.css should be linked');

  scripts.concat(linked).forEach((href) => {
    assert.ok(
      fs.existsSync(path.join(root, href)),
      `referenced asset ${href} should exist on disk`
    );
  });
});

test('filter chips and the theme toggle expose their pressed state', () => {
  const chips = html.slice(html.indexOf('class="filters"'));
  chips
    .slice(0, chips.indexOf('</div>'))
    .split('<button')
    .slice(1)
    .forEach((button) => {
      assert.match(button, /aria-pressed="(true|false)"/, 'every filter chip needs aria-pressed');
    });

  assert.equal(attributeOf('theme-toggle', 'aria-pressed'), 'false');
});

test('live regions announce status and toast updates', () => {
  assert.equal(attributeOf('status', 'aria-live'), 'polite');
  assert.equal(attributeOf('toast', 'aria-live'), 'polite');
});
