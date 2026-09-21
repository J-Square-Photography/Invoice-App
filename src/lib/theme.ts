export const THEME_STORAGE_KEY = 'jsquare-theme';

/**
 * Runs before first paint (inlined in the root layout) so the saved theme is
 * applied without a light-mode flash.
 */
export const themeInitScript = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`;

/** Toggles dark mode on <html> and remembers the choice in this browser. */
export function toggleTheme(): void {
  const root = document.documentElement;
  const isDark = root.classList.toggle('dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch {
    // Storage can be unavailable (private mode); the toggle still works for this visit.
  }
}
