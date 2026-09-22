/**
 * Where to go after signing in. Only paths inside the admin area are allowed, so a crafted
 * login link (?redirect=https://evil.example or //evil.example) can never send someone off-site.
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/admin')) return '/admin';
  // "/admin" itself, or "/admin/..." / "/admin?..." only: not lookalikes such as "/administrator" or "/admin\..."
  const next = value.charAt('/admin'.length);
  if (next !== '' && next !== '/' && next !== '?' && next !== '#') return '/admin';
  if (value.includes('\\') || value.includes('//') || /[\u0000-\u001f]/.test(value)) return '/admin';
  return value;
}
