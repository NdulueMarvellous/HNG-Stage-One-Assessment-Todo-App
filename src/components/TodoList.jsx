import TodoItem from './TodoItem.jsx';

export default function TodoList({
  todos,
  editingId,
  returnFocusId,
  onReturnFocusHandled,
  handlers,
  emptyMessage
}) {
  return (
    <>
      <ul id="todo-list" className="todo-list" role="list">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            editing={editingId === todo.id}
            returnFocusId={returnFocusId}
            onReturnFocusHandled={onReturnFocusHandled}
            handlers={handlers}
          />
        ))}
      </ul>
      <p id="empty-state" className="empty-state" hidden={!emptyMessage}>
        {emptyMessage}
      </p>
    </>
  );
}
