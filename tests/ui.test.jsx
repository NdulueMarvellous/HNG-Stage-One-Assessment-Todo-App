import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App.jsx';

function renderApp() {
  return render(<App />);
}

function addTask(title, priority) {
  fireEvent.change(screen.getByLabelText('Task description'), { target: { value: title } });
  if (priority) {
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: priority } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
}

function listTitles() {
  return Array.from(document.querySelectorAll('#todo-list .todo__title')).map(
    (node) => node.textContent
  );
}

function statusText() {
  return document.getElementById('status').textContent;
}

function countFor(filter) {
  return document.querySelector('[data-count="' + filter + '"]').textContent;
}

describe('Todo app', () => {
  it('adds a task and reports the counts', () => {
    renderApp();
    addTask('Buy milk');
    expect(listTitles()).toEqual(['Buy milk']);
    expect(statusText()).toBe('1 task · 1 active · 0 completed');
    expect(countFor('all')).toBe('1');
    expect(countFor('active')).toBe('1');
  });

  it('shows an inline error instead of adding a blank task', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    const error = document.getElementById('form-error');
    expect(error).toHaveTextContent('Please type a task before adding it.');
    expect(error).toBeVisible();
    expect(listTitles()).toEqual([]);
  });

  it('toggles a task complete and updates the counts', () => {
    renderApp();
    addTask('Walk dog');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark "Walk dog" as done' }));
    expect(document.querySelector('.todo').className).toContain('todo--done');
    expect(statusText()).toBe('1 task · 0 active · 1 completed');
    expect(document.getElementById('clear-completed')).toBeEnabled();
  });

  it('sets a priority from the row select', () => {
    renderApp();
    addTask('Ship release');
    fireEvent.change(screen.getByLabelText('Priority for "Ship release"'), {
      target: { value: 'high' }
    });
    expect(document.querySelector('.todo').dataset.priority).toBe('high');
  });

  it('filters by active and completed', () => {
    renderApp();
    addTask('one');
    addTask('two');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark "two" as done' }));
    fireEvent.click(screen.getByRole('button', { name: /^Active/ }));
    expect(listTitles()).toEqual(['one']);
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(listTitles()).toEqual(['two']);
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(listTitles()).toEqual(['two', 'one']);
  });

  it('searches case-insensitively and clears on Escape', () => {
    renderApp();
    addTask('Buy milk');
    addTask('Walk dog');
    const search = screen.getByLabelText('Search tasks');
    fireEvent.change(search, { target: { value: 'DOG' } });
    expect(listTitles()).toEqual(['Walk dog']);
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(listTitles()).toEqual(['Walk dog', 'Buy milk']);
  });

  it('sorts alphabetically', () => {
    renderApp();
    addTask('banana');
    addTask('Apple');
    fireEvent.change(screen.getByLabelText('Sort tasks'), { target: { value: 'alpha' } });
    expect(listTitles()).toEqual(['Apple', 'banana']);
  });

  it('renames a task by double-clicking and pressing Enter', () => {
    renderApp();
    addTask('Buy milk');
    fireEvent.doubleClick(screen.getByText('Buy milk'));
    const editor = screen.getByLabelText('Rename "Buy milk"');
    fireEvent.change(editor, { target: { value: 'Buy oat milk' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(listTitles()).toEqual(['Buy oat milk']);
    expect(screen.queryByLabelText('Rename "Buy milk"')).not.toBeInTheDocument();
  });

  it('cancels an edit with Escape', () => {
    renderApp();
    addTask('Buy milk');
    fireEvent.doubleClick(screen.getByText('Buy milk'));
    const editor = screen.getByLabelText('Rename "Buy milk"');
    fireEvent.change(editor, { target: { value: 'discard me' } });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(listTitles()).toEqual(['Buy milk']);
  });

  it('deletes a task and restores it through the toast undo', () => {
    renderApp();
    addTask('one');
    addTask('two');
    fireEvent.click(screen.getByRole('button', { name: 'Delete "one"' }));
    expect(listTitles()).toEqual(['two']);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted "one"');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(listTitles()).toEqual(['two', 'one']);
  });

  it('clears completed tasks and undoes the whole batch', () => {
    renderApp();
    addTask('one');
    addTask('two');
    addTask('three');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark "one" as done' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark "three" as done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));
    expect(listTitles()).toEqual(['two']);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(listTitles()).toEqual(['three', 'two', 'one']);
  });

  it('persists tasks to localStorage', () => {
    renderApp();
    addTask('remember me');
    const raw = window.localStorage.getItem('todo-app:todos:v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).todos.map((todo) => todo.title)).toEqual(['remember me']);
  });

  it('rehydrates tasks that were saved earlier', () => {
    window.localStorage.setItem(
      'todo-app:todos:v1',
      JSON.stringify({
        version: 1,
        todos: [
          {
            id: 'seed',
            title: 'From storage',
            completed: false,
            priority: 'low',
            createdAt: 1,
            updatedAt: 1
          }
        ]
      })
    );
    renderApp();
    expect(listTitles()).toEqual(['From storage']);
  });

  it('toggles the theme and remembers the choice', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('todo-app:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('keeps the empty state and the filter chips in sync', () => {
    renderApp();
    expect(document.getElementById('empty-state')).toHaveTextContent(
      'Nothing here yet — add your first task above.'
    );
    addTask('only one');
    fireEvent.click(screen.getByRole('button', { name: 'Delete "only one"' }));
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(document.getElementById('empty-state')).toHaveTextContent('Nothing completed yet.');
  });
});

describe('Toast a11y', () => {
  it('exposes the toast as a polite live region', () => {
    renderApp();
    addTask('one');
    fireEvent.click(screen.getByRole('button', { name: 'Delete "one"' }));
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(within(toast).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
