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
