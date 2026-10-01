import core from '../core/todos.js';

const FILTER_LABELS = { all: 'All', active: 'Active', completed: 'Done' };
const SORT_LABELS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  alpha: 'A → Z',
  priority: 'Priority'
};

export default function Toolbar({
  filter,
  sort,
  query,
  counts,
  searchRef,
  onFilter,
  onSort,
  onQuery,
  onSearchKeyDown
}) {
  return (
    <div className="toolbar">
      <div className="filters" role="group" aria-label="Filter tasks">
        {core.FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className="chip"
            data-filter={value}
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            {FILTER_LABELS[value]}{' '}
            <span className="chip__count" data-count={value}>
              {counts[value]}
            </span>
          </button>
        ))}
      </div>
      <div className="toolbar__right">
        <label className="sr-only" htmlFor="sort">
          Sort tasks
        </label>
        <select
          id="sort"
          className="select select--subtle"
          value={sort}
          onChange={(event) => onSort(event.target.value)}
        >
          {core.SORTS.map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="search">
          Search tasks
        </label>
        <input
          id="search"
          ref={searchRef}
          className="search"
          type="search"
          placeholder="Search tasks"
          autoComplete="off"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
      </div>
    </div>
  );
}
