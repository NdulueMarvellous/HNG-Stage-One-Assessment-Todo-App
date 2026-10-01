import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import core from './core/todos.js';
import useTodoStore from './hooks/useTodoStore.js';
import useTheme from './hooks/useTheme.js';
import Header from './components/Header.jsx';
import Composer from './components/Composer.jsx';
import Toolbar from './components/Toolbar.jsx';
import TodoList from './components/TodoList.jsx';
import Toast from './components/Toast.jsx';
import { formatToday, pluralise, truncate } from './lib/format.js';

const TOAST_TIMEOUT = 6000;

function getStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null; // private mode / blocked storage: stay in memory only
  }
}

function isTypingTarget(node) {
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function emptyMessageFor(all, visible, view) {
  if (visible.length) return '';
  // Nothing is visible: explain why in terms of the most specific cause —
  // an active search, then the active filter, then a genuinely empty list.
  if (view.query) return 'No tasks match "' + view.query + '".';
  if (view.filter === 'active') return 'All clear — nothing left to do.';
  if (view.filter === 'completed') return 'Nothing completed yet. Keep going!';
  if (!all.length) return 'Nothing here yet — add your first task above.';
  return '';
}

/**
 * The whole app. It owns the view state (filter, search, sort, inline editing),
 * the transient toast, and the keyboard shortcut — everything else lives in the
 * pure core or in the small presentational components.
 */
export default function App() {
  const storage = useMemo(getStorage, []);
  const { todos, actions, storageUnavailable, dismissStorageWarning } = useTodoStore(storage);
  const { isDark, toggle: toggleTheme } = useTheme(storage);

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [editingId, setEditingId] = useState(null);
  const [returnFocusId, setReturnFocusId] = useState(null);
  const [toast, setToast] = useState(null);

  const searchRef = useRef(null);
  const toastTimer = useRef(null);
  const today = useMemo(formatToday, []);

  const visible = useMemo(
    () => core.filterTodos(todos, { filter, query, sort }),
    [todos, filter, query, sort]
  );
  const totals = useMemo(() => core.countTodos(todos), [todos]);
  const counts = { all: totals.total, active: totals.active, completed: totals.completed };

  const hideToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message, actionLabel, onAction) => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, actionLabel: actionLabel || null, onAction: onAction || null });
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_TIMEOUT);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!storageUnavailable) return;
    showToast('Changes could not be saved — storage is unavailable in this browser.');
    dismissStorageWarning();
  }, [storageUnavailable, showToast, dismissStorageWarning]);

  const reportError = useCallback(
    (error) => showToast(error && error.message ? error.message : 'Something went wrong.'),
    [showToast]
  );

  const handleAdd = useCallback(
    (title, options) => {
      try {
        actions.add(title, options);
      } catch (error) {
        reportError(error);
      }
    },
    [actions, reportError]
  );

  const handleToggle = useCallback(
    (id) => {
      try {
        actions.toggle(id);
      } catch (error) {
        reportError(error);
      }
    },
    [actions, reportError]
  );

  const handlePriority = useCallback(
    (id, priority) => {
      try {
        actions.setPriority(id, priority);
      } catch (error) {
        reportError(error);
      }
    },
    [actions, reportError]
  );

  const startEditing = useCallback((id) => {
    setEditingId(id);
    setReturnFocusId(null);
  }, []);

  const stopEditing = useCallback((id) => {
    setEditingId(null);
    if (id) setReturnFocusId(id);
  }, []);

  const handleSave = useCallback(
    (id, title) => {
      try {
        actions.edit(id, title);
      } catch (error) {
        reportError(error);
        return;
      }
      stopEditing(id);
    },
    [actions, reportError, stopEditing]
  );

  const handleDelete = useCallback(
    (id) => {
      if (editingId === id) setEditingId(null);
      let result;
      try {
        result = actions.remove(id);
      } catch (error) {
        reportError(error);
        return;
      }
      showToast('Deleted "' + truncate(result.removed.title, 40) + '"', 'Undo', () => {
        try {
          actions.restore(result.removed, result.index);
        } catch (error) {
          reportError(error);
        }
      });
    },
    [actions, editingId, reportError, showToast]
  );

  const handleClearCompleted = useCallback(() => {
    const snapshot = [];
    todos.forEach((todo, index) => {
      if (todo.completed) snapshot.push({ todo, index });
    });

    let removed;
    try {
      removed = actions.clearCompleted();
    } catch (error) {
      reportError(error);
      return;
    }
    if (!removed.length) return;

    showToast('Cleared ' + pluralise(removed.length, 'completed task'), 'Undo', () => {
      snapshot.forEach((entry) => {
        try {
          actions.restore(entry.todo, entry.index);
        } catch (error) {
          reportError(error);
        }
      });
    });
  }, [actions, reportError, showToast, todos]);

  const handleReturnFocusHandled = useCallback(() => setReturnFocusId(null), []);

  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === 'Escape' && event.target.value) setQuery('');
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        const node = searchRef.current;
        if (node) {
          node.focus();
          if (typeof node.select === 'function') node.select();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (editingId && !core.findTodo(todos, editingId)) setEditingId(null);
  }, [todos, editingId]);

  const handlers = useMemo(
    () => ({
      onToggle: handleToggle,
      onEdit: startEditing,
      onCancel: stopEditing,
      onSave: handleSave,
      onDelete: handleDelete,
      onPriority: handlePriority
    }),
    [handleToggle, startEditing, stopEditing, handleSave, handleDelete, handlePriority]
  );

  const emptyMessage = emptyMessageFor(todos, visible, { filter, query });

  const summary = [
    pluralise(totals.total, 'task'),
    totals.active + ' active',
    totals.completed + ' completed'
  ];
  if (visible.length !== todos.length) summary.push(visible.length + ' shown');

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to your tasks
      </a>

      <div className="app">
        <Header today={today} isDark={isDark} onToggleTheme={toggleTheme} />

        <main id="main">
          <Composer onAdd={handleAdd} onError={reportError} />

          <section className="panel panel--list" aria-labelledby="list-heading">
            <h2 className="sr-only" id="list-heading">
              Your tasks
            </h2>

            <Toolbar
              filter={filter}
              sort={sort}
              query={query}
              counts={counts}
              searchRef={searchRef}
              onFilter={setFilter}
              onSort={setSort}
              onQuery={setQuery}
              onSearchKeyDown={handleSearchKeyDown}
            />

            <TodoList
              todos={visible}
              editingId={editingId}
              returnFocusId={returnFocusId}
              onReturnFocusHandled={handleReturnFocusHandled}
              handlers={handlers}
              emptyMessage={emptyMessage}
            />

            <div className="list-footer">
              <p id="status" className="status" aria-live="polite">
                {summary.join(' · ')}
              </p>
              <button
                type="button"
                id="clear-completed"
                className="button button--ghost"
                disabled={totals.completed === 0}
                onClick={handleClearCompleted}
              >
                Clear completed
              </button>
            </div>
          </section>
        </main>

        <footer className="app__footer">
          <p>Everything is stored in your browser — the app works offline.</p>
        </footer>
      </div>

      <Toast
        toast={toast}
        onAction={() => {
          const run = toast && toast.onAction;
          hideToast();
          if (run) run();
        }}
      />
    </>
  );
}
