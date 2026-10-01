export default function Toast({ toast, onAction }) {
  if (!toast) return null;
  return (
    <div id="toast" className="toast" role="status" aria-live="polite">
      <span id="toast-message" className="toast__message">
        {toast.message}
      </span>
      {toast.actionLabel ? (
        <button type="button" id="toast-action" className="toast__action" onClick={onAction}>
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
