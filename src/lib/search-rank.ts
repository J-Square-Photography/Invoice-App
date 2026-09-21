export interface SearchableClient {
  companyName: string;
  contactName: string;
  email?: string | null;
}

/** Does any word in `text` start with `q`? ("Maguire Lim Wei Bin" matches "lim" and "wei".) */
function wordStartsWith(text: string, q: string): boolean {
  return text
    .toLowerCase()
    .split(/[\s\-_.,&()/]+/)
    .some((word) => word.startsWith(q));
}

/**
 * Orders clients for type-ahead search, best match first:
 *  1. company name starts with what was typed
 *  2. contact name starts with it
 *  3. a later word of the company name starts with it
 *  4. a later word of the contact name starts with it
 *  5. email starts with it
 *  6. anything else that merely contains it
 * Ties are broken alphabetically by company name. Case is ignored.
 */
export function rankClients<T extends SearchableClient>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  const byName = (a: T, b: T) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' });
  if (!q) return [...items].sort(byName);

  const score = (c: T): number => {
    if (c.companyName.toLowerCase().startsWith(q)) return 0;
    if (c.contactName.toLowerCase().startsWith(q)) return 1;
    if (wordStartsWith(c.companyName, q)) return 2;
    if (wordStartsWith(c.contactName, q)) return 3;
    if ((c.email ?? '').toLowerCase().startsWith(q)) return 4;
    return 5;
  };

  return items
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => a.s - b.s || byName(a.c, b.c))
    .map((x) => x.c);
}

export interface SearchableProject {
  title: string;
}

/** Best matches first: title starts with the query, then a later word starts with it, then contains. */
export function rankProjects<T extends SearchableProject>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  if (!q) return [...items].sort(byTitle);
  const score = (p: T): number => {
    const title = p.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (wordStartsWith(p.title, q)) return 1;
    return title.includes(q) ? 2 : 3;
  };
  return items
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => a.s - b.s || byTitle(a.p, b.p))
    .map((x) => x.p);
}