import { useCallback, useEffect, useState } from 'react';
import core from '../core/todos.js';

const THEMES = ['light', 'dark'];

function systemPrefersDark() {
  return !!(
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readStoredTheme(storage) {
  const value = storage ? core.safeGet(storage, core.THEME_KEY) : null;
  return THEMES.indexOf(value) !== -1 ? value : null;
}

/**
 * Theme preference: an explicit choice wins; otherwise follow the OS and keep
 * following it until the visitor toggles the switch themselves.
 */
export default function useTheme(storage) {
  const [theme, setTheme] = useState(
    () => readStoredTheme(storage) || (systemPrefersDark() ? 'dark' : 'light')
  );
  const [followsSystem, setFollowsSystem] = useState(() => readStoredTheme(storage) === null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!followsSystem || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setTheme(media.matches ? 'dark' : 'light');
    if (typeof media.addEventListener === 'function') media.addEventListener('change', listener);
    else if (typeof media.addListener === 'function') media.addListener(listener);
    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', listener);
      else if (typeof media.removeListener === 'function') media.removeListener(listener);
    };
  }, [followsSystem]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      if (storage) core.safeSet(storage, core.THEME_KEY, next);
      return next;
    });
    setFollowsSystem(false);
  }, [storage]);

  return { theme, isDark: theme === 'dark', toggle };
}
