/**
 * Presentation-only helpers shared by the React components.
 * They never read or write application state.
 */

export function formatTimestamp(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (error) {
    return '';
  }
}

export function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export function pluralise(count, singular) {
  return count + ' ' + singular + (count === 1 ? '' : 's');
}

export function formatToday() {
  try {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return '';
  }
}
