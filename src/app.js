/**
 * Todo UI — all of the DOM wiring for the app.
 *
 * Depends on `window.TodoCore` (src/todos.js) for every piece of logic; this
 * file only translates user events into core calls and core state into DOM.
 * User text is always written with textContent, never innerHTML.
 */
(function () {
  'use strict';

  var core = window.TodoCore;
  if (!core) {
    console.error('TodoCore failed to load — check that src/todos.js is present.');
    return;
  }

  /* ------------------------------------------------------------------ *
   * Elements
   * ------------------------------------------------------------------ */

  var form = document.getElementById('todo-form');
  var input = document.getElementById('new-todo');
  var prioritySelect = document.getElementById('new-priority');
  var formError = document.getElementById('form-error');
  var list = document.getElementById('todo-list');
  var emptyState = document.getElementById('empty-state');
  var statusLine = document.getElementById('status');
  var filterButtons = document.querySelectorAll('[data-filter]');
  var filterCounts = document.querySelectorAll('[data-count]');
  var sortSelect = document.getElementById('sort');
  var searchInput = document.getElementById('search');
  var clearButton = document.getElementById('clear-completed');
  var themeToggle = document.getElementById('theme-toggle');
  var todayLabel = document.getElementById('today');
  var toast = document.getElementById('toast');
  var toastMessage = document.getElementById('toast-message');
  var toastAction = document.getElementById('toast-action');

  function safeStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null; // private mode / blocked storage: stay in-memory only
    }
  }

  var storage = safeStorage();
  var store = core.createStore({ storage: storage });

  /* ------------------------------------------------------------------ *
   * View state (never persisted — it is a preference of the moment)
   * ------------------------------------------------------------------ */

  var view = { filter: 'all', query: '', sort: 'newest', editingId: null };
  var toastTimer = null;
  var focusRequest = null; // { id, type: 'edit' | 'editButton' }

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function escapeId(id) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(id);
    return String(id).replace(/["\\]/g, '\\$&');
  }

  function formatTimestamp(value) {
    if (typeof value !== 'number' || !isFinite(value) || value <= 0) return '';
    try {
      return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  }

  function truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function pluralise(count, singular) {
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  /* ------------------------------------------------------------------ *
   * Rendering one task
   * ------------------------------------------------------------------ */

  function renderItem(todo) {
    var editing = view.editingId === todo.id;
    var item = el('li', 'todo');
    item.dataset.id = todo.id;
    item.dataset.priority = todo.priority;
    if (todo.completed) item.classList.add('todo--done');
    if (editing) item.classList.add('todo--editing');

    var checkbox = el('input', 'todo__toggle');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.dataset.action = 'toggle';
    checkbox.setAttribute(
      'aria-label',
      'Mark "' + todo.title + '" as ' + (todo.completed ? 'active' : 'done')
    );
    item.appendChild(checkbox);

    var main = el('div', 'todo__main');
    if (editing) {
      var editInput = el('input', 'todo__edit');
      editInput.type = 'text';
      editInput.value = todo.title;
      editInput.maxLength = core.MAX_TITLE_LENGTH;
      editInput.dataset.action = 'edit-input';
      editInput.setAttribute('aria-label', 'Rename "' + todo.title + '"');
      main.appendChild(editInput);
      main.appendChild(el('p', 'todo__meta', 'Enter to save · Esc to cancel'));
    } else {
      main.appendChild(el('span', 'todo__title', todo.title));
      var meta = el('p', 'todo__meta');
      meta.appendChild(el('span', 'badge badge--' + todo.priority, todo.priority));
      var created = formatTimestamp(todo.createdAt);
      if (created) meta.appendChild(el('span', 'todo__time', 'Added ' + created));
      main.appendChild(meta);
    }
    item.appendChild(main);

    var side = el('div', 'todo__side');
    var priority = el('select', 'select select--tiny');
    priority.dataset.action = 'priority';
    priority.setAttribute('aria-label', 'Priority for "' + todo.title + '"');
    core.PRIORITIES.forEach(function (value) {
      var option = el('option', null, value.charAt(0).toUpperCase() + value.slice(1));
      option.value = value;
      if (value === todo.priority) option.selected = true;
      priority.appendChild(option);
    });
    side.appendChild(priority);

    if (editing) {
      var save = el('button', 'button button--small button--primary', 'Save');
      save.type = 'button';
      save.dataset.action = 'save';
      side.appendChild(save);

      var cancel = el('button', 'button button--small button--ghost', 'Cancel');
      cancel.type = 'button';
      cancel.dataset.action = 'cancel';
      side.appendChild(cancel);
    } else {
      var edit = el('button', 'button button--small button--ghost', 'Edit');
      edit.type = 'button';
      edit.dataset.action = 'edit';
      edit.setAttribute('aria-label', 'Edit "' + todo.title + '"');
      side.appendChild(edit);

      var remove = el('button', 'button button--small button--danger', 'Delete');
      remove.type = 'button';
      remove.dataset.action = 'delete';
      remove.setAttribute('aria-label', 'Delete "' + todo.title + '"');
      side.appendChild(remove);
    }

    item.appendChild(side);
    return item;
  }

  function emptyMessage(all, visible) {
    if (!all.length) return 'Nothing here yet — add your first task above.';
    if (!visible.length) {
      if (view.query) return 'No tasks match "' + view.query + '".';
      if (view.filter === 'active') return 'All clear — nothing left to do.';
      if (view.filter === 'completed') return 'Nothing completed yet. Keep going!';
    }
    return '';
  }

  function applyFocusRequest() {
    if (!focusRequest) return;
    var request = focusRequest;
    focusRequest = null;
    var action = request.type === 'edit' ? 'edit-input' : 'edit';
    var target = list.querySelector(
      '[data-id="' + escapeId(request.id) + '"] [data-action="' + action + '"]'
    );
    if (!target) return;
    target.focus();
    if (typeof target.select === 'function') target.select();
  }

  /** The single render pass: list, counts, filters, empty state, footer. */
  function render() {
    var all = store.getTodos();
    var visible = core.filterTodos(all, view);
    var totals = core.countTodos(all);

    var fragment = document.createDocumentFragment();
    visible.forEach(function (todo) {
      fragment.appendChild(renderItem(todo));
    });
    list.textContent = '';
    list.appendChild(fragment);

    filterCounts.forEach(function (node) {
      var key = node.dataset.count;
      node.textContent =
        key === 'all' ? totals.total : key === 'active' ? totals.active : totals.completed;
    });

    filterButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === view.filter));
    });

    var message = emptyMessage(all, visible);
    emptyState.hidden = !message;
    emptyState.textContent = message;

    var summary = [
      pluralise(totals.total, 'task'),
      totals.active + ' active',
      totals.completed + ' completed'
    ];
    if (visible.length !== all.length) summary.push(visible.length + ' shown');
    statusLine.textContent = summary.join(' · ');

    clearButton.disabled = totals.completed === 0;
    sortSelect.value = view.sort;
    applyFocusRequest();
  }

  /* ------------------------------------------------------------------ *
   * Feedback: toast + inline form error
   * ------------------------------------------------------------------ */

  function hideToast() {
    window.clearTimeout(toastTimer);
    toast.hidden = true;
    toastAction.hidden = true;
    toastAction.onclick = null;
  }

  function showToast(message, actionLabel, onAction) {
    window.clearTimeout(toastTimer);
    toastMessage.textContent = message;
    if (actionLabel && typeof onAction === 'function') {
      toastAction.textContent = actionLabel;
      toastAction.hidden = false;
      toastAction.onclick = function () {
        hideToast();
        onAction();
      };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }
    toast.hidden = false;
    toastTimer = window.setTimeout(hideToast, 6000);
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearFormError() {
    if (formError.hidden) return;
    formError.textContent = '';
    formError.hidden = true;
    input.removeAttribute('aria-invalid');
  }

  function reportError(error) {
    showToast(error && error.message ? error.message : 'Something went wrong.');
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function itemIdOf(node) {
    var item = node.closest ? node.closest('.todo') : null;
    return item ? item.dataset.id : null;
  }

  function editFieldFor(id) {
    return list.querySelector('[data-id="' + escapeId(id) + '"] [data-action="edit-input"]');
  }

  function startEditing(id) {
    view.editingId = id;
    focusRequest = { id: id, type: 'edit' };
    render();
  }

  function stopEditing(id) {
    view.editingId = null;
    focusRequest = { id: id, type: 'editButton' };
    render();
  }

  function saveEdit(id, field) {
    if (!field) return;
    try {
      store.edit(id, field.value);
    } catch (error) {
      reportError(error);
      field.focus();
      field.select();
      return;
    }
    stopEditing(id);
  }

  function deleteTodo(id) {
    if (view.editingId === id) view.editingId = null;
    var result;
    try {
      result = store.remove(id);
    } catch (error) {
      reportError(error);
      return;
    }
    showToast('Deleted "' + truncate(result.removed.title, 40) + '"', 'Undo', function () {
      try {
        store.restore(result.removed, result.index);
      } catch (error) {
        reportError(error);
      }
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    var checked = core.validateTitle(input.value);
    if (!checked.ok) {
      showFormError(checked.error);
      input.focus();
      return;
    }
    clearFormError();
    try {
      store.add(checked.value, { priority: prioritySelect.value });
    } catch (error) {
      reportError(error);
      return;
    }
    form.reset();
    prioritySelect.value = core.DEFAULT_PRIORITY;
    input.focus();
  }

  function handleListClick(event) {
    var node = event.target.closest ? event.target.closest('[data-action]') : null;
    if (!node) return;
    var id = itemIdOf(node);
    if (!id) return;

    switch (node.dataset.action) {
      case 'toggle':
        try {
          store.toggle(id);
        } catch (error) {
          reportError(error);
        }
        break;
      case 'edit':
        startEditing(id);
        break;
      case 'cancel':
        stopEditing(id);
        break;
      case 'save':
        saveEdit(id, editFieldFor(id));
        break;
      case 'delete':
        deleteTodo(id);
        break;
      default:
        break;
    }
  }

  function handleListChange(event) {
    var node = event.target;
    if (!node.dataset || node.dataset.action !== 'priority') return;
    var id = itemIdOf(node);
    if (!id) return;
    try {
      store.setPriority(id, node.value);
    } catch (error) {
      reportError(error);
    }
  }

  function handleListKeyDown(event) {
    var node = event.target;
    if (!node.dataset || node.dataset.action !== 'edit-input') return;
    var id = itemIdOf(node);
    if (!id) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEdit(id, node);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      stopEditing(id);
    }
  }

  function handleListDoubleClick(event) {
    var title = event.target.closest ? event.target.closest('.todo__title') : null;
    if (!title) return;
    var id = itemIdOf(title);
    if (id) startEditing(id);
  }

  function handleFilterClick(event) {
    var button = event.target.closest ? event.target.closest('[data-filter]') : null;
    if (!button) return;
    view.filter = button.dataset.filter;
    render();
  }

  function handleSearchInput() {
    view.query = searchInput.value;
    render();
  }

  function handleSortChange() {
    view.sort = sortSelect.value;
    render();
  }

  function handleClearCompleted() {
    var snapshot = [];
    store.getTodos().forEach(function (todo, index) {
      if (todo.completed) snapshot.push({ todo: todo, index: index });
    });

    var removed = store.clearCompleted();
    if (!removed.length) return;

    if (view.editingId && !core.findTodo(store.getTodos(), view.editingId)) {
      view.editingId = null;
      render();
    }

    showToast('Cleared ' + pluralise(removed.length, 'completed task'), 'Undo', function () {
      snapshot.forEach(function (entry) {
        try {
          store.restore(entry.todo, entry.index);
        } catch (error) {
          reportError(error);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Theme — a saved preference, otherwise the OS setting
   * ------------------------------------------------------------------ */

  function readStoredTheme() {
    var value = storage ? core.safeGet(storage, core.THEME_KEY) : null;
    return value === 'dark' || value === 'light' ? value : null;
  }

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function applyTheme(theme) {
    var resolved = theme || (systemPrefersDark() ? 'dark' : 'light');
    var isDark = resolved === 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute(
      'aria-label',
      isDark ? 'Switch to light theme' : 'Switch to dark theme'
    );
    return resolved;
  }

  function handleThemeToggle() {
    var next =
      document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (storage) core.safeSet(storage, core.THEME_KEY, next);
  }

  /** Follow the OS only while the visitor has not picked a theme themselves. */
  function watchSystemTheme() {
    if (!window.matchMedia) return;
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var listener = function () {
      if (!readStoredTheme()) applyTheme(null);
    };
    if (typeof media.addEventListener === 'function') media.addEventListener('change', listener);
    else if (typeof media.addListener === 'function') media.addListener(listener);
  }

  function formatToday() {
    try {
      return new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return '';
    }
  }

  /* ------------------------------------------------------------------ *
   * Keyboard shortcuts
   * ------------------------------------------------------------------ */

  function isTypingTarget(node) {
    if (!node) return false;
    if (node.isContentEditable) return true;
    var tag = node.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function handleDocumentKeyDown(event) {
    if (event.key === '/' && !isTypingTarget(event.target)) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (event.key === 'Escape' && event.target === searchInput && searchInput.value) {
      searchInput.value = '';
      view.query = '';
      render();
    }
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function bindEvents() {
    form.addEventListener('submit', handleSubmit);
    input.addEventListener('input', clearFormError);
    list.addEventListener('click', handleListClick);
    list.addEventListener('change', handleListChange);
    list.addEventListener('keydown', handleListKeyDown);
    list.addEventListener('dblclick', handleListDoubleClick);
    filterButtons.forEach(function (button) {
      button.addEventListener('click', handleFilterClick);
    });
    searchInput.addEventListener('input', handleSearchInput);
    sortSelect.addEventListener('change', handleSortChange);
    clearButton.addEventListener('click', handleClearCompleted);
    themeToggle.addEventListener('click', handleThemeToggle);
    document.addEventListener('keydown', handleDocumentKeyDown);
  }

  function init() {
    applyTheme(readStoredTheme());
    watchSystemTheme();
    todayLabel.textContent = formatToday();

    store.subscribe(function (todos, event) {
      render();
      if (event === 'storage-unavailable') {
        showToast('Changes could not be saved — storage is unavailable in this browser.');
      }
    });

    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
