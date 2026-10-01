/**
 * Unit tests for the pure core in src/core/todos.js.
 * Run with:  npm run test:core   (node --test)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/core/todos.js';

/** A fake localStorage so the store can be tested without a browser. */
function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => Array.from(map.keys())
  };
}

/** Build a list with deterministic ids and timestamps. */
function makeList(...titles) {
  return titles.reduce(
    (todos, title, index) =>
      core.addTodo(todos, title, { id: `id-${index + 1}`, now: 1000 + index }),
    []
  );
}

function titlesOf(todos) {
  return todos.map((todo) => todo.title);
}

/* ------------------------------------------------------------------ *
 * Titles
 * ------------------------------------------------------------------ */

test('validateTitle trims and collapses whitespace', () => {
  assert.deepEqual(core.validateTitle('  buy   milk\n please '), {
    ok: true,
    error: '',
    value: 'buy milk please'
  });
});

test('validateTitle rejects blank input', () => {
  const result = core.validateTitle('   \t  ');
  assert.equal(result.ok, false);
  assert.equal(result.error, core.MESSAGES.empty);
});

test('validateTitle rejects titles over the maximum length', () => {
  const result = core.validateTitle('x'.repeat(core.MAX_TITLE_LENGTH + 5));
  assert.equal(result.ok, false);
  assert.equal(result.error, core.MESSAGES.tooLong);
  assert.equal(result.value.length, core.MAX_TITLE_LENGTH);
});

test('validateTitle ignores non-strings', () => {
  assert.equal(core.validateTitle(null).ok, false);
  assert.equal(core.validateTitle(undefined).ok, false);
  assert.equal(core.validateTitle(42).ok, false);
});

/* ------------------------------------------------------------------ *
 * Adding
 * ------------------------------------------------------------------ */

test('addTodo appends a trimmed task with defaults', () => {
  const todos = core.addTodo([], '  Write   the report ', { id: 'a1', now: 555 });
  assert.equal(todos.length, 1);
  assert.deepEqual(todos[0], {
    id: 'a1',
    title: 'Write the report',
    completed: false,
    priority: core.DEFAULT_PRIORITY,
    createdAt: 555,
    updatedAt: 555
  });
});

test('addTodo honours an explicit priority and never mutates its input', () => {
  const original = makeList('one');
  const next = core.addTodo(original, 'two', { priority: 'high', now: 2000 });
  assert.equal(original.length, 1);
  assert.equal(next.length, 2);
  assert.equal(next[1].priority, 'high');
  assert.notEqual(original, next);
});

test('addTodo throws on blank titles and falls back on unknown priorities', () => {
  assert.throws(() => core.addTodo([], '   '), /Please type a task/);
  const todos = core.addTodo([], 'task', { priority: 'urgent' });
  assert.equal(todos[0].priority, core.DEFAULT_PRIORITY);
});

test('createId returns unique ids', () => {
  const ids = new Set();
  for (let i = 0; i < 2000; i += 1) ids.add(core.createId());
  assert.equal(ids.size, 2000);
});

/* ------------------------------------------------------------------ *
 * Toggling, editing, priority
 * ------------------------------------------------------------------ */

test('toggleTodo flips completion and stamps updatedAt', () => {
  const todos = makeList('one', 'two');
  const done = core.toggleTodo(todos, 'id-2', { now: 9000 });
  assert.equal(core.findTodo(done, 'id-2').completed, true);
  assert.equal(core.findTodo(done, 'id-2').updatedAt, 9000);
  assert.equal(core.findTodo(done, 'id-1').completed, false);

  const undone = core.toggleTodo(done, 'id-2');
  assert.equal(core.findTodo(undone, 'id-2').completed, false);
});

test('toggleTodo throws for an unknown id', () => {
  assert.throws(() => core.toggleTodo(makeList('one'), 'nope'), /no longer exists/);
});

test('editTodo renames a task and reports no-op edits', () => {
  const todos = makeList('one', 'two');
  const renamed = core.editTodo(todos, 'id-1', '  one  edited ', { now: 7000 });
  assert.equal(core.findTodo(renamed, 'id-1').title, 'one edited');
  assert.equal(core.findTodo(renamed, 'id-1').updatedAt, 7000);
  assert.equal(core.findTodo(renamed, 'id-2').title, 'two');
  // An unchanged title returns the very same array (no wasted render/persist).
  assert.equal(core.editTodo(todos, 'id-1', 'one'), todos);
});

test('editTodo rejects blank titles and unknown ids', () => {
  const todos = makeList('one');
  assert.throws(() => core.editTodo(todos, 'id-1', '  '), /Please type a task/);
  assert.throws(() => core.editTodo(todos, 'missing', 'new'), /no longer exists/);
});

test('setPriority updates a task and validates its arguments', () => {
  const todos = makeList('one');
  const high = core.setPriority(todos, 'id-1', 'high', { now: 3000 });
  assert.equal(high[0].priority, 'high');
  assert.equal(high[0].updatedAt, 3000);
  assert.equal(core.setPriority(todos, 'id-1', 'medium'), todos, 'no-op returns the array');
  assert.throws(() => core.setPriority(todos, 'id-1', 'urgent'), /Unknown priority/);
  assert.throws(() => core.setPriority(todos, 'missing', 'high'), /no longer exists/);
});

/* ------------------------------------------------------------------ *
 * Removing and restoring
 * ------------------------------------------------------------------ */

test('removeTodo returns the removed task, its index and the new list', () => {
  const todos = makeList('one', 'two', 'three');
  const result = core.removeTodo(todos, 'id-2');
  assert.deepEqual(titlesOf(result.todos), ['one', 'three']);
  assert.equal(result.index, 1);
  assert.equal(result.removed.title, 'two');
  assert.equal(todos.length, 3, 'the input list is untouched');
});

test('removeTodo throws for an unknown id', () => {
  assert.throws(() => core.removeTodo(makeList('one'), 'nope'), /no longer exists/);
});

test('restoreTodo puts a task back at its original position', () => {
  const todos = makeList('one', 'two', 'three');
  const result = core.removeTodo(todos, 'id-2');
  const restored = core.restoreTodo(result.todos, result.removed, result.index);
  assert.deepEqual(titlesOf(restored), ['one', 'two', 'three']);
});

test('restoreTodo refuses duplicates, invalid tasks and clamps the index', () => {
  const todos = makeList('one');
  assert.throws(() => core.restoreTodo(todos, todos[0], 0), /already in the list/);
  assert.throws(() => core.restoreTodo(todos, { id: 'x', title: '   ' }, 0), /invalid task/);
  assert.throws(() => core.restoreTodo(todos, null, 0), /invalid task/);

  const extra = { id: 'extra', title: 'two', completed: false, priority: 'low' };
  assert.deepEqual(titlesOf(core.restoreTodo(todos, extra, 99)), ['one', 'two']);
  assert.deepEqual(titlesOf(core.restoreTodo(todos, extra, -5)), ['two', 'one']);
});

/* ------------------------------------------------------------------ *
 * Clear completed
 * ------------------------------------------------------------------ */

test('clearCompleted removes only finished tasks', () => {
  const todos = core.toggleTodo(makeList('one', 'two', 'three'), 'id-2');
  const result = core.clearCompleted(todos);
  assert.deepEqual(titlesOf(result.todos), ['one', 'three']);
  assert.deepEqual(titlesOf(result.removed), ['two']);
  assert.equal(todos.length, 3, 'the input list is untouched');
});

test('clearCompleted is a no-op when nothing is completed', () => {
  const todos = makeList('one', 'two');
  const result = core.clearCompleted(todos);
  assert.deepEqual(titlesOf(result.todos), ['one', 'two']);
  assert.deepEqual(result.removed, []);
});

/* ------------------------------------------------------------------ *
 * Filtering, searching, sorting, counting
 * ------------------------------------------------------------------ */

test('filterTodos applies the active filter', () => {
  const todos = core.toggleTodo(makeList('one', 'two', 'three'), 'id-2');
  assert.deepEqual(titlesOf(core.filterTodos(todos, { filter: 'all' })), ['three', 'two', 'one']);
  assert.deepEqual(titlesOf(core.filterTodos(todos, { filter: 'active' })), ['three', 'one']);
  assert.deepEqual(titlesOf(core.filterTodos(todos, { filter: 'completed' })), ['two']);
});

test('filterTodos searches titles case-insensitively', () => {
  const todos = makeList('Buy milk', 'walk dog', 'Buy bread');
  assert.deepEqual(titlesOf(core.filterTodos(todos, { query: 'buy' })), ['Buy bread', 'Buy milk']);
  assert.deepEqual(titlesOf(core.filterTodos(todos, { query: 'DOG' })), ['walk dog']);
  assert.deepEqual(core.filterTodos(todos, { query: 'nothing here' }), []);
});

test('filterTodos combines filter, query and sort', () => {
  const todos = core.toggleTodo(makeList('Buy milk', 'Buy bread', 'walk dog'), 'id-3');
  const visible = core.filterTodos(todos, { filter: 'active', query: 'buy', sort: 'alpha' });
  assert.deepEqual(titlesOf(visible), ['Buy bread', 'Buy milk']);
});

test('filterTodos sorts by newest, oldest, alpha and priority', () => {
  const todos = core.setPriority(
    core.setPriority(makeList('banana', 'Apple', 'cherry'), 'id-1', 'high'),
    'id-3',
    'low'
  );
  assert.deepEqual(titlesOf(core.filterTodos(todos, { sort: 'newest' })), [
    'cherry',
    'Apple',
    'banana'
  ]);
  assert.deepEqual(titlesOf(core.filterTodos(todos, { sort: 'oldest' })), [
    'banana',
    'Apple',
    'cherry'
  ]);
  assert.deepEqual(titlesOf(core.filterTodos(todos, { sort: 'alpha' })), [
    'Apple',
    'banana',
    'cherry'
  ]);
  assert.deepEqual(titlesOf(core.filterTodos(todos, { sort: 'priority' })), [
    'banana',
    'Apple',
    'cherry'
  ]);
});

test('filterTodos tolerates unknown filter and sort values', () => {
  const todos = makeList('one', 'two');
  assert.deepEqual(titlesOf(core.filterTodos(todos, { filter: 'nope', sort: 'nope' })), [
    'two',
    'one'
  ]);
  assert.deepEqual(titlesOf(core.filterTodos(todos)), ['two', 'one']);
});

test('countTodos counts total, active and completed', () => {
  const todos = core.toggleTodo(makeList('one', 'two', 'three'), 'id-3');
  assert.deepEqual(core.countTodos(todos), { total: 3, active: 2, completed: 1 });
  assert.deepEqual(core.countTodos([]), { total: 0, active: 0, completed: 0 });
});

/* ------------------------------------------------------------------ *
 * The observable store
 * ------------------------------------------------------------------ */

test('createStore adds, persists and rehydrates from storage', () => {
  const storage = memoryStorage();
  const store = core.createStore({ storage, key: 'test:key' });
  store.add('Buy milk', { id: 'id-1', priority: 'high' });
  store.add('Walk dog', { id: 'id-2' });

  assert.deepEqual(titlesOf(store.getTodos()), ['Buy milk', 'Walk dog']);
  assert.ok(storage.keys().includes('test:key'));

  const reloaded = core.createStore({ storage, key: "test:key" });
  assert.deepEqual(titlesOf(reloaded.getTodos()), ['Buy milk', 'Walk dog']);
  assert.equal(reloaded.getTodos()[0].priority, 'high');
});

test('createStore notifies subscribers and reports storage failures', () => {
  const events = [];
  const store = core.createStore({ storage: memoryStorage() });
  const unsubscribe = store.subscribe((todos, event) => events.push([todos.length, event]));

  store.add('one', { id: 'id-1' });
  store.toggle('id-1');
  assert.deepEqual(events, [[1, 'change'], [1, 'change']]);

  unsubscribe();
  store.remove('id-1');
  assert.equal(events.length, 2, 'unsubscribed listeners stop receiving events');

  const failing = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {}
  };
  const broken = core.createStore({ storage: failing });
  const failureEvents = [];
  broken.subscribe((todos, event) => failureEvents.push(event));
  broken.add('nope', { id: 'id-9' });
  assert.deepEqual(failureEvents, ['storage-unavailable']);
});
