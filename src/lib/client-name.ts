/**
 * How a client's name is captured and printed.
 *
 * Rather than one free-text "Contact Name" box, or a rigid First/Middle/Last split, the form
 * collects Salutation + Given Name + Family Name — the same two-field shape passports and airline
 * tickets use (ICAO Doc 9303 has exactly "Surname" and "Given Names", no middle-name field at
 * all), because a forced three-way split produces wrong data for names that don't fit it:
 * Chinese and Korean names (family name first), Malay/Indonesian names (bin/binti, no family
 * name), many South Indian names (no surname), and single-name (mononym) clients. Family Name
 * is always optional here for exactly that reason. Singapore's own NRIC goes further still and
 * uses a single unsplit "Name" field, which is why the composed, printable name (`contactName`)
 * remains the one value every invoice, contract and search actually reads — the split fields
 * exist only to build it accurately and to allow a correct honorific ("Dear Mr Tan,").
 */
export interface NameParts {
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** The printable name built from the parts, e.g. "Mr Wei Ming Tan". Empty if all parts are blank. */
export function composeContactName(parts: NameParts): string {
  return [parts.salutation, parts.firstName, parts.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Every client is either a person (a wedding couple, a private booking) or an organisation (a
 * company, school club, grassroots network). An organisation is always dealt with through one
 * representative, the contact person, who appears as "Attn:" on documents. An individual is their
 * own contact, so their documents carry just their name.
 */
export const CLIENT_TYPE = { INDIVIDUAL: 'INDIVIDUAL', ORGANISATION: 'ORGANISATION' } as const;
export type ClientType = (typeof CLIENT_TYPE)[keyof typeof CLIENT_TYPE];
/** In the order the client form offers them */
export const CLIENT_TYPES: ClientType[] = [CLIENT_TYPE.INDIVIDUAL, CLIENT_TYPE.ORGANISATION];
/** Clients saved before client types existed. Must match the column default in prisma/schema.prisma. */
export const DEFAULT_CLIENT_TYPE: ClientType = CLIENT_TYPE.ORGANISATION;
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  [CLIENT_TYPE.INDIVIDUAL]: 'Individual',
  [CLIENT_TYPE.ORGANISATION]: 'Organisation',
};
/** Longest contact person role kept, e.g. "Teacher-in-charge" */
export const CONTACT_ROLE_MAX_LENGTH = 80;

/** Reads a client type from a request; anything unrecognised is null so the route can answer 400. */
export function parseClientType(value: unknown): ClientType | null {
  return CLIENT_TYPES.find((t) => t === value) ?? null;
}

/** A stored client's type, treating a missing or unknown value as the default (organisation). */
export function clientTypeOf(c: { clientType?: string | null }): ClientType {
  return parseClientType(c.clientType) ?? DEFAULT_CLIENT_TYPE;
}

export interface BillableClient {
  clientType?: string | null;
  companyName: string;
  contactName?: string | null;
  contactRole?: string | null;
}

export const isIndividual = (c: { clientType?: string | null }) => clientTypeOf(c) === CLIENT_TYPE.INDIVIDUAL;

/**
 * The name an individual client is listed and sorted under: given and family name without the
 * salutation, so "Mr" and "Ms" don't bunch everyone together. Documents use the full name instead.
 */
export function individualListName(parts: NameParts): string {
  return composeContactName({ firstName: parts.firstName, lastName: parts.lastName });
}

/** The bold "Bill To" name: an individual's full name with salutation, or the organisation's name. */
export function billToName(c: BillableClient): string {
  return (isIndividual(c) && c.contactName?.trim()) || c.companyName.trim();
}

/** "Ms Jacqueline Yeo, Teacher-in-charge" for an organisation; empty for an individual or when no contact is recorded. */
export function attnName(c: BillableClient): string {
  if (isIndividual(c)) return '';
  const name = c.contactName?.trim() ?? '';
  const role = c.contactRole?.trim() ?? '';
  return name ? (role ? `${name}, ${role}` : name) : '';
}

/** How the client is named as a party to a contract: "SP Academic Club (Attn: Ms Jacqueline Yeo)", or just "Mr Zhun Hung". */
export function contractPartyName(c: BillableClient): string {
  const attn = attnName(c);
  return attn ? `${billToName(c)} (Attn: ${attn})` : billToName(c);
}
