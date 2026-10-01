/**
 * Todo Core - the pure, DOM-free heart of the app.
 *
 * An ES module imported by both the React UI (src/App.jsx and friends) and
 * the unit tests, so the exact same code that runs in the page is the code
 * under test. No DOM, no globals, no dependencies.
 */
const core = (function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var STORAGE_KEY = 'todo-app:todos:v1';
  var THEME_KEY = 'todo-app:theme';
  var MAX_TITLE_LENGTH = 200;

  var PRIORITIES = ['low', 'medium', 'high'];
  var DEFAULT_PRIORITY = 'medium';
  var FILTERS = ['all', 'active', 'completed'];
  var SORTS = ['newest', 'oldest', 'alpha', 'priority'];
  var PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

  var MESSAGES = {
    empty: 'Please type a task before adding it.',
    tooLong: 'Tasks can be at most ' + MAX_TITLE_LENGTH + ' characters long.',
    missing: 'That task no longer exists — it may have been deleted elsewhere.'
  };

  /* ------------------------------------------------------------------ *
   * Titles
   * ------------------------------------------------------------------ */

  /** Collapse runs of whitespace and trim: "  buy   milk " -> "buy milk". */
  function sanitizeTitle(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(/\s+/g, ' ').trim();
  }

  /**
   * Validate a user supplied title without touching any state.
   * Always returns { ok, error, value } so the form can show a message.
   */
  function validateTitle(raw) {
    var title = sanitizeTitle(raw);
    if (!title) {
      return { ok: false, error: MESSAGES.empty, value: '' };
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return { ok: false, error: MESSAGES.tooLong, value: title.slice(0, MAX_TITLE_LENGTH) };
    }
    return { ok: true, error: '', value: title };
  }

  function isPriority(value) {
    return PRIORITIES.indexOf(value) !== -1;
  }

  /* ------------------------------------------------------------------ *
   * Ids and factories
   * ------------------------------------------------------------------ */

  var idCounter = 0;

  function createId() {
    idCounter += 1;
    var random = Math.random().toString(36).slice(2, 8);
    return 't' + Date.now().toString(36) + random + idCounter.toString(36);
  }

  function now(options) {
    var opts = options || {};
    return typeof opts.now === 'number' && isFinite(opts.now) ? opts.now : Date.now();
  }

  function createTodo(title, options) {
    var opts = options || {};
    var timestamp = now(opts);
    return {
      id: opts.id || createId(),
      title: title,
      completed: false,
      priority: isPriority(opts.priority) ? opts.priority : DEFAULT_PRIORITY,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function findTodo(todos, id) {
    for (var i = 0; i < todos.length; i += 1) {
      if (todos[i].id === id) return todos[i];
    }
    return null;
  }

  /** Map over one todo, throwing when the id is unknown. */
  function updateOne(todos, id, updater) {
    var found = false;
    var next = todos.map(function (todo) {
      if (todo.id !== id) return todo;
      found = true;
      return updater(todo);
    });
    if (!found) throw new Error(MESSAGES.missing);
    return next;
  }

  /* ------------------------------------------------------------------ *
   * Mutations — every function is pure: it returns a new array and never
   * touches the one it was handed.
   * ------------------------------------------------------------------ */

  function addTodo(todos, rawTitle, options) {
    var checked = validateTitle(rawTitle);
    if (!checked.ok) throw new Error(checked.error);
    var opts = options || {};
    return todos.concat([
      createTodo(checked.value, { id: opts.id, priority: opts.priority, now: now(opts) })
    ]);
  }

  function toggleTodo(todos, id, options) {
    var timestamp = now(options);
    return updateOne(todos, id, function (todo) {
      return Object.assign({}, todo, { completed: !todo.completed, updatedAt: timestamp });
    });
  }

  function setPriority(todos, id, priority, options) {
    if (!isPriority(priority)) throw new Error('Unknown priority: ' + priority);
    var current = findTodo(todos, id);
    if (!current) throw new Error(MESSAGES.missing);
    if (current.priority === priority) return todos;
    var timestamp = now(options);
    return updateOne(todos, id, function (todo) {
      return Object.assign({}, todo, { priority: priority, updatedAt: timestamp });
    });
  }

  function editTodo(todos, id, rawTitle, options) {
    var checked = validateTitle(rawTitle);
    if (!checked.ok) throw new Error(checked.error);
    var current = findTodo(todos, id);
    if (!current) throw new Error(MESSAGES.missing);
    if (current.title === checked.value) return todos;
    var timestamp = now(options);
    return updateOne(todos, id, function (todo) {
      return Object.assign({}, todo, { title: checked.value, updatedAt: timestamp });
    });
  }

  /** Returns { todos, removed, index } so the UI can offer an undo. */
  function removeTodo(todos, id) {
    var index = -1;
    for (var i = 0; i < todos.length; i += 1) {
      if (todos[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) throw new Error(MESSAGES.missing);
    return {
      todos: todos.slice(0, index).concat(todos.slice(index + 1)),
      removed: todos[index],
      index: index
    };
  }

  /** Put a removed todo back where it was (powers the undo action). */
  function restoreTodo(todos, todo, index) {
    if (!todo || typeof todo !== 'object' || !sanitizeTitle(todo.title)) {
      throw new Error('Cannot restore an invalid task.');
    }
    if (findTodo(todos, todo.id)) throw new Error('That task is already in the list.');
    // Clamp into [0, todos.length]: too-large appends at the end, negatives land at the start.
    var at = typeof index === 'number' && isFinite(index)
      ? Math.max(0, Math.min(Math.floor(index), todos.length))
      : todos.length;
    return todos.slice(0, at).concat([todo], todos.slice(at));
  }

  function clearCompleted(todos) {
    var removed = [];
    var kept = [];
    todos.forEach(function (todo) {
      if (todo.completed) removed.push(todo);
      else kept.push(todo);
    });
    return { todos: kept, removed: removed };
  }

  /* ------------------------------------------------------------------ *
   * Reading: filter, search, sort, count
   * ------------------------------------------------------------------ */

  function sortTodos(todos, sort) {
    var list = todos.slice();
    switch (sort) {
      case 'oldest':
        return list;
      case 'alpha':
        // Array#sort is stable, so equal titles keep their insertion order.
        return list.sort(function (a, b) {
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
        });
      case 'priority':
        return list.sort(function (a, b) {
          return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        });
      case 'newest':
      default:
        return list.reverse();
    }
  }

  /**
   * Apply the active filter, the search query and the sort order.
   * Unknown values fall back to sensible defaults instead of throwing.
   */
  function filterTodos(todos, options) {
    var opts = options || {};
    var filter = FILTERS.indexOf(opts.filter) !== -1 ? opts.filter : 'all';
    var sort = SORTS.indexOf(opts.sort) !== -1 ? opts.sort : 'newest';
    var query = sanitizeTitle(opts.query || '').toLowerCase();

    var matches = todos.filter(function (todo) {
      if (filter === 'active' && todo.completed) return false;
      if (filter === 'completed' && !todo.completed) return false;
      if (query && todo.title.toLowerCase().indexOf(query) === -1) return false;
      return true;
    });

    return sortTodos(matches, sort);
  }

  function countTodos(todos) {
    var completed = 0;
    todos.forEach(function (todo) {
      if (todo.completed) completed += 1;
    });
    return { total: todos.length, active: todos.length - completed, completed: completed };
  }

  /* ------------------------------------------------------------------ *
   * Persistence — everything read back from storage is treated as
   * untrusted input and normalised before it is handed to the UI.
   * ------------------------------------------------------------------ */

  function normalizeTodo(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var title = sanitizeTitle(raw.title);
    if (!title) return null;
    var createdAt =
      typeof raw.createdAt === 'number' && isFinite(raw.createdAt) ? raw.createdAt : Date.now();
    var updatedAt =
      typeof raw.updatedAt === 'number' && isFinite(raw.updatedAt) ? raw.updatedAt : createdAt;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
      title: title.slice(0, MAX_TITLE_LENGTH),
      completed: raw.completed === true,
      priority: isPriority(raw.priority) ? raw.priority : DEFAULT_PRIORITY,
      createdAt: createdAt,
      updatedAt: updatedAt
    };
  }

  function serialize(todos) {
    return JSON.stringify({ version: SCHEMA_VERSION, todos: todos });
  }

  /** Never throws: corrupt or hostile payloads simply yield an empty list. */
  function deserialize(text) {
    if (typeof text !== 'string' || !text.trim()) return [];
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return [];
    }
    var list = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.todos)
        ? parsed.todos
        : null;
    if (!list) return [];
    var seen = Object.create(null);
    return list
      .map(normalizeTodo)
      .filter(function (todo) {
        if (!todo || seen[todo.id]) return false; // drop junk and duplicate ids
        seen[todo.id] = true;
        return true;
      });
  }

  /* Guarded storage helpers: Safari private mode and quota errors throw. */
  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeRemove(storage, key) {
    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * A tiny observable store around the pure functions above.
   * `storage` is injectable so tests can run without a browser.
   */
  function createStore(options) {
    var opts = options || {};
    var key = opts.key || STORAGE_KEY;
    var storage =
      opts.storage !== undefined
        ? opts.storage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;
    var listeners = [];
    var todos = deserialize(storage ? safeGet(storage, key) : null);

    /**
     * Persist the current list, reporting whether it reached storage.
     * Returns true when there is nothing to save or the write succeeded.
     */
    function persist() {
      if (!storage) return true;
      return safeSet(storage, key, serialize(todos));
    }

    function emit(event) {
      listeners.slice().forEach(function (listener) {
        listener(getTodos(), event);
      });
    }

    function getTodos() {
      return todos.slice();
    }

    /**
     * Adopt a new list and notify listeners exactly once: a failed save is
     * reported as `storage-unavailable` (the in-memory list is still updated),
     * a successful one as `change`.
     */
    function commit(next) {
      if (next === todos) return todos;
      todos = next;
      emit(persist() ? 'change' : 'storage-unavailable');
      return todos;
    }

    /** Run a pure mutation against the current list and persist the result. */
    function apply(mutator) {
      return mutator(todos);
    }

    return {
      key: key,
      getTodos: getTodos,
      count: function () {
        return countTodos(todos);
      },
      subscribe: function (listener) {
        listeners.push(listener);
        return function unsubscribe() {
          listeners = listeners.filter(function (item) {
            return item !== listener;
          });
        };
      },
      add: function (title, addOptions) {
        commit(apply(function (list) {
          return addTodo(list, title, addOptions);
        }));
        return countTodos(todos);
      },
      toggle: function (id) {
        commit(apply(function (list) {
          return toggleTodo(list, id);
        }));
      },
      setPriority: function (id, priority) {
        commit(apply(function (list) {
          return setPriority(list, id, priority);
        }));
      },
      edit: function (id, title) {
        commit(apply(function (list) {
          return editTodo(list, id, title);
        }));
      },
      remove: function (id) {
        var result = apply(function (list) {
          return removeTodo(list, id);
        });
        commit(result.todos);
        return { removed: result.removed, index: result.index };
      },
      restore: function (todo, index) {
        commit(apply(function (list) {
          return restoreTodo(list, todo, index);
        }));
      },
      clearCompleted: function () {
        var result = apply(clearCompleted);
        commit(result.todos);
        return result.removed;
      }
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    THEME_KEY: THEME_KEY,
    MAX_TITLE_LENGTH: MAX_TITLE_LENGTH,
    PRIORITIES: PRIORITIES,
    DEFAULT_PRIORITY: DEFAULT_PRIORITY,
    FILTERS: FILTERS,
    SORTS: SORTS,
    MESSAGES: MESSAGES,
    sanitizeTitle: sanitizeTitle,
    validateTitle: validateTitle,
    isPriority: isPriority,
    createId: createId,
    createTodo: createTodo,
    findTodo: findTodo,
    addTodo: addTodo,
    toggleTodo: toggleTodo,
    setPriority: setPriority,
    editTodo: editTodo,
    removeTodo: removeTodo,
    restoreTodo: restoreTodo,
    clearCompleted: clearCompleted,
    sortTodos: sortTodos,
    filterTodos: filterTodos,
    countTodos: countTodos,
    normalizeTodo: normalizeTodo,
    serialize: serialize,
    deserialize: deserialize,
    safeGet: safeGet,
    safeSet: safeSet,
    safeRemove: safeRemove,
    createStore: createStore
  };
})();

export const {
  SCHEMA_VERSION,
  STORAGE_KEY,
  THEME_KEY,
  MAX_TITLE_LENGTH,
  PRIORITIES,
  DEFAULT_PRIORITY,
  FILTERS,
  SORTS,
  MESSAGES,
  sanitizeTitle,
  validateTitle,
  isPriority,
  createId,
  createTodo,
  findTodo,
  addTodo,
  toggleTodo,
  setPriority,
  editTodo,
  removeTodo,
  restoreTodo,
  clearCompleted,
  sortTodos,
  filterTodos,
  countTodos,
  normalizeTodo,
  serialize,
  deserialize,
  safeGet,
  safeSet,
  safeRemove,
  createStore
} = core;

export default core;
