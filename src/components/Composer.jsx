import { useRef, useState } from 'react';
import core from '../core/todos.js';

function labelFor(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * The "add a task" form. Owns its own draft + inline validation error, exactly
 * like the original: validate first, show the message, then hand a clean title
 * to the store.
 */
export default function Composer({ onAdd, onError }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(core.DEFAULT_PRIORITY);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  function handleSubmit(event) {
    event.preventDefault();
    const checked = core.validateTitle(title);
    if (!checked.ok) {
      setError(checked.error);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    setError('');
    try {
      onAdd(checked.value, { priority });
    } catch (addError) {
      onError(addError);
      return;
    }
    setTitle('');
    setPriority(core.DEFAULT_PRIORITY);
    if (inputRef.current) inputRef.current.focus();
  }

  function handleTitleChange(event) {
    setTitle(event.target.value);
    if (error) setError('');
  }

  return (
    <section className="panel" aria-labelledby="add-heading">
      <h2 className="sr-only" id="add-heading">
        Add a task
      </h2>
      <form id="todo-form" className="composer" noValidate onSubmit={handleSubmit}>
        <div className="composer__field">
          <label className="sr-only" htmlFor="new-todo">
            Task description
          </label>
          <input
            id="new-todo"
            ref={inputRef}
            className="composer__input"
            name="title"
            type="text"
            placeholder="What needs doing?"
            autoComplete="off"
            maxLength={core.MAX_TITLE_LENGTH}
            required
            value={title}
            onChange={handleTitleChange}
            aria-invalid={error ? 'true' : undefined}
          />
        </div>
        <div className="composer__controls">
          <label className="sr-only" htmlFor="new-priority">
            Priority
          </label>
          <select
            id="new-priority"
            className="select"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            {core.PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {labelFor(value)}
              </option>
            ))}
          </select>
          <button type="submit" className="button button--primary">
            Add task
          </button>
        </div>
      </form>
      <p id="form-error" className="form-error" role="alert" hidden={!error}>
        {error}
      </p>
      <p className="hint">
        Press <kbd>/</kbd> to search · double-click a task to rename it · your list is saved in
        this browser.
      </p>
    </section>
  );
}
