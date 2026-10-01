import { useEffect, useRef, useState } from 'react';
import core from '../core/todos.js';
import { formatTimestamp } from '../lib/format.js';

function labelFor(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * One task row. Owns the rename draft (so both Enter and the Save button can
 * commit the same value) and the two focus behaviours the original had:
 * focus the editor when it opens, and return focus to Edit when it closes.
 */
export default function TodoItem({ todo, editing, returnFocusId, onReturnFocusHandled, handlers }) {
  const [draft, setDraft] = useState(todo.title);
  const editInputRef = useRef(null);
  const editButtonRef = useRef(null);

  useEffect(() => {
    if (editing) setDraft(todo.title);
  }, [editing, todo.title]);

  useEffect(() => {
    if (!editing || !editInputRef.current) return;
    editInputRef.current.focus();
    if (typeof editInputRef.current.select === 'function') editInputRef.current.select();
  }, [editing]);

  useEffect(() => {
    if (returnFocusId && returnFocusId === todo.id && editButtonRef.current) {
      editButtonRef.current.focus();
      onReturnFocusHandled();
    }
  }, [returnFocusId, todo.id, onReturnFocusHandled]);

  function commit() {
    handlers.onSave(todo.id, draft);
  }

  function handleEditKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onCancel(todo.id);
    }
  }

  const classes = ['todo'];
  if (todo.completed) classes.push('todo--done');
  if (editing) classes.push('todo--editing');

  const created = formatTimestamp(todo.createdAt);

  return (
    <li className={classes.join(' ')} data-id={todo.id} data-priority={todo.priority}>
      <input
        className="todo__toggle"
        type="checkbox"
        checked={todo.completed}
        data-action="toggle"
        aria-label={'Mark "' + todo.title + '" as ' + (todo.completed ? 'active' : 'done')}
        onChange={() => handlers.onToggle(todo.id)}
      />

      <div className="todo__main">
        {editing ? (
          <>
            <input
              ref={editInputRef}
              className="todo__edit"
              type="text"
              data-action="edit-input"
              aria-label={'Rename "' + todo.title + '"'}
              maxLength={core.MAX_TITLE_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleEditKeyDown}
            />
            <p className="todo__meta">Enter to save · Esc to cancel</p>
          </>
        ) : (
          <>
            <span className="todo__title" onDoubleClick={() => handlers.onEdit(todo.id)}>
              {todo.title}
            </span>
            <p className="todo__meta">
              <span className={'badge badge--' + todo.priority}>{todo.priority}</span>
              {created ? <span className="todo__time">Added {created}</span> : null}
            </p>
          </>
        )}
      </div>

      <div className="todo__side">
        <select
          className="select select--tiny"
          data-action="priority"
          value={todo.priority}
          aria-label={'Priority for "' + todo.title + '"'}
          onChange={(event) => handlers.onPriority(todo.id, event.target.value)}
        >
          {core.PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {labelFor(value)}
            </option>
          ))}
        </select>

        {editing ? (
          <>
            <button
              type="button"
              className="button button--small button--primary"
              data-action="save"
              onClick={commit}
            >
              Save
            </button>
            <button
              type="button"
              className="button button--small button--ghost"
              data-action="cancel"
              onClick={() => handlers.onCancel(todo.id)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              ref={editButtonRef}
              className="button button--small button--ghost"
              data-action="edit"
              aria-label={'Edit "' + todo.title + '"'}
              onClick={() => handlers.onEdit(todo.id)}
            >
              Edit
            </button>
            <button
              type="button"
              className="button button--small button--danger"
              data-action="delete"
              aria-label={'Delete "' + todo.title + '"'}
              onClick={() => handlers.onDelete(todo.id)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
