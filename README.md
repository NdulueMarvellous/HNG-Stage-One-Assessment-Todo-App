# Todo — a functional, dependency-free todo web app

A complete todo app you can open straight from disk: no build step, no installs, no
frameworks. Priorities, search, sorting, filters, inline editing, undo and
localStorage persistence, with a light/dark theme and keyboard support.

## Run it

**Option 1 — just open it**

Double-click `index.html`.

**Option 2 — serve it (recommended)**

```bash
npm start            # http://127.0.0.1:4173
node server.js 8080  # pick your own port
```

`server.js` is a tiny static file server with no dependencies, so the app always
loads over `http://` where `localStorage` behaves identically in every browser.

## Features

- **Add tasks** — inline validation, whitespace is normalised, 200-character limit.
- **Complete / uncomplete** — checkbox toggles, strikethrough styling, live counts.
- **Edit** — click *Edit* or double-click the task text; `Enter` saves, `Esc` cancels.
- **Delete with undo** — deleting shows a toast with an *Undo* action (6s).
- **Priorities** — low / medium / high per task, colour-coded and sortable.
- **Filters** — All / Active / Done with per-filter counts.
- **Search** — live, case-insensitive filtering across task titles.
- **Sorting** — newest, oldest, A → Z or by priority.
- **Clear completed** — bulk removal, also undoable.
- **Persistence** — every change is saved to `localStorage` and restored on reload.
- **Theme** — follows your OS by default; the toggle remembers your choice.
- **Accessibility** — skip link, labelled controls, `aria-live` status, visible focus
  rings, `aria-pressed` filter state, `prefers-reduced-motion` support.
- **Safe rendering** — user text is only ever written with `textContent`.
- **Keyboard** — `/` focuses search, `Esc` clears search or cancels an edit.

## Project structure

```
index.html           Markup (semantic, accessible)
styles.css           Design tokens + light/dark themes, responsive layout
src/todos.js         Pure logic: validation, CRUD, filters, sort, storage (no DOM)
src/app.js           DOM wiring, rendering, events, theme, shortcuts
server.js            Dependency-free static server
tests/todos.test.js  Unit tests for the core (node:test)
tests/markup.test.js Integration test: app.js element hooks exist in index.html
```

`src/todos.js` is written as a UMD-lite module: the browser gets `window.TodoCore`,
and Node can `require()` the same file — so the tested code is exactly the code that
runs in the page.

## Test

```bash
npm test          # or: node --test
```

## Data model

```js
{
  id: "t...",           // generated, unique
  title: "Buy milk",    // trimmed, single-spaced, <= 200 chars
  completed: false,
  priority: "medium",   // "low" | "medium" | "high"
  createdAt: 1727000000000,
  updatedAt: 1727000000000
}
```

Storage key: `todo-app:todos:v1` (envelope `{ version, todos }`), theme key:
`todo-app:theme`. Anything read back from storage is normalised and filtered, so a
corrupted or hand-edited payload can never break the UI.

## Notes and limits

- Data lives in the browser only — there is no backend or sync.
- If storage is blocked (private mode), the app keeps working in memory and shows a
  warning instead of failing silently.
- Deleting is undoable through the toast; no confirmation dialog on purpose.
