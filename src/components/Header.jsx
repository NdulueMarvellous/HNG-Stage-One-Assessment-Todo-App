export default function Header({ today, isDark, onToggleTheme }) {
  return (
    <header className="app__header">
      <div>
        <p className="app__eyebrow">My day</p>
        <h1 className="app__title">Todo</h1>
        <p className="app__subtitle" id="today">
          {today}
        </p>
      </div>
      <button
        type="button"
        id="theme-toggle"
        className="icon-button"
        aria-pressed={isDark}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={onToggleTheme}
      >
        <span className="icon icon--sun" aria-hidden="true">
          ☀
        </span>
        <span className="icon icon--moon" aria-hidden="true">
          ☾
        </span>
      </button>
    </header>
  );
}
