/**
 * Only the client's name is needed to create a profile. Everything else can be
 * filled in later, so this reports which useful details a client is still missing.
 * An individual is their own contact, so only an organisation can be missing a contact person.
 */
import { isIndividual } from './client-name';

export interface ClientInfoFields {
  clientType?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export function missingClientInfo(client: ClientInfoFields): string[] {
  const missing: string[] = [];
  if (!isIndividual(client) && !client.contactName?.trim()) missing.push('contact person');
  if (!client.email?.trim()) missing.push('email');
  if (!client.phone?.trim()) missing.push('phone');
  if (!client.address?.trim()) missing.push('address');
  return missing;
}
