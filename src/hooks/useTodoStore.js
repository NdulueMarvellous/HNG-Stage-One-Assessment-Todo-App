import { useCallback, useEffect, useMemo, useState } from 'react';
import core from '../core/todos.js';

/**
 * Subscribe the component tree to the pure store in `core/todos.js`.
 *
 * The store instance is created once per mount and re-reads storage, so the
 * React layer stays a thin, declarative shell over the tested core.
 */
export default function useTodoStore(storage) {
  const [store] = useState(() => core.createStore({ storage }));
  const [todos, setTodos] = useState(() => store.getTodos());
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe((next, event) => {
      setTodos(next);
      if (event === 'storage-unavailable') setStorageUnavailable(true);
    });
    // Sync once in case anything changed between render and effect.
    setTodos(store.getTodos());
    return unsubscribe;
  }, [store]);

  const actions = useMemo(
    () => ({
      add: (title, options) => store.add(title, options),
      toggle: (id) => store.toggle(id),
      setPriority: (id, priority) => store.setPriority(id, priority),
      edit: (id, title) => store.edit(id, title),
      remove: (id) => store.remove(id),
      restore: (todo, index) => store.restore(todo, index),
      clearCompleted: () => store.clearCompleted()
    }),
    [store]
  );

  const dismissStorageWarning = useCallback(() => setStorageUnavailable(false), []);

  return { todos, actions, storageUnavailable, dismissStorageWarning };
}
