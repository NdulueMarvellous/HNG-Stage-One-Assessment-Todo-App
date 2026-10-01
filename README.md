# Todo — a React todo web app

A fast, offline-friendly todo app built with **React 19 + Vite**. Priorities, search,
sorting, filters, inline editing, undo and `localStorage` persistence, with a light/dark
theme and keyboard support.

The logic lives in a dependency-free, DOM-free core module that is shared by the UI and
the unit tests, so the code that runs in the page is exactly the code under test.

## Run it

```bash
npm install     # installs React, Vite and the test tooling
npm run dev     # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build     # production build into dist/
npm run preview   # serve the built output locally
```

Node **24.x** is required (pinned in `package.json` → `engines.node`).

## Test

```bash
npm test          # runs the core tests, then the React component tests
npm run test:core # node --test  → the pure core (src/core/todos.js)
npm run test:ui   # vitest run   → the React app in jsdom
```

- `tests/core.test.js` — 27 unit tests for the pure core (validation, CRUD, filters,
  sorting, storage, the observable store). Runs on the built-in `node:test` runner with
  no DOM.
- `tests/ui.test.jsx` — 16 component tests that render the real app with
  `@testing-library/react` and assert on what a user would see.

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
- **Theme** — follows your OS by default; the toggle remembers your choice. The saved
  theme is applied by a tiny inline script in `index.html` before first paint, so there is
  no flash of the wrong theme.
- **Accessibility** — skip link, labelled controls, `aria-live` status and toast,
  visible focus rings, `aria-pressed` filter/theme state, and focus management when an
  inline editor opens and closes.
- **Keyboard** — press `/` to focus search; `Esc` clears search or cancels an edit.

## Project structure

```
index.html                 Vite entry + the pre-paint theme script
vercel.json                Vercel config (framework: vite, output: dist)
vite.config.js             Build config + Vitest (jsdom) config
public/                    Static assets copied to the build (favicons, robots.txt, …)
src/
  main.jsx                 Mounts <App/> into #root
  App.jsx                  The app: view state, toast, shortcuts, composition
  styles.css               Design tokens, light/dark themes, responsive layout
  core/todos.js            Pure logic: validation, CRUD, filters, sort, storage, store
  hooks/
    useTodoStore.js        Subscribes React to the pure store
    useTheme.js            Theme preference (stored choice or OS default)
  lib/format.js            Presentation-only helpers (dates, pluralise, truncate)
  components/
    Header.jsx             Title, today's date, theme toggle
    Composer.jsx           The "add a task" form with inline validation
    Toolbar.jsx            Filter chips, sort select, search box
    TodoList.jsx           The list container + empty state
    TodoItem.jsx           One task row (toggle, rename, priority, delete)
    Toast.jsx              Transient status message with an optional action
tests/
  core.test.js             Unit tests for the pure core (node:test)
  ui.test.jsx              Component tests for the app (Vitest + Testing Library)
  setup.js                 Vitest setup (jest-dom, matchMedia shim, storage reset)
```

## Architecture

`src/core/todos.js` is a plain ES module with no DOM or framework dependencies. It
exposes pure functions (validation, `addTodo`, `toggleTodo`, `editTodo`, `filterTodos`,
`sortTodos`, …) plus a small observable **store** created with `createStore()`:

- `store.getTodos()` returns a copy of the current list.
- `store.subscribe(listener)` registers a listener and returns an unsubscribe function.
  Listeners are called as `(todos, event)`, where `event` is either `'change'`
  (the list was saved) or `'storage-unavailable'` (the list changed in memory but the
  write failed).
- `store.add / toggle / setPriority / edit / remove / restore / clearCompleted` run a pure
  mutation, persist the result and notify subscribers exactly once.

`useTodoStore()` subscribes React to that store, so the React components stay a thin,
declarative shell over the tested core.

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

## Deploy to Vercel

`vercel.json` tells Vercel exactly how to build and serve the site:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

Vercel runs `npm run build` and serves the resulting `dist/` directory as a static site.
(If you configure the project in the dashboard instead, use **Framework Preset: Vite**,
**Build Command: `npm run build`** and **Output Directory: `dist`**.)

## Notes and limits

- Data lives in the browser only — there is no backend or sync.
- If storage is blocked (private mode / quota), the app keeps working in memory and shows
  a warning toast instead of failing silently.
- Deleting is undoable through the toast; there is no confirmation dialog on purpose.

