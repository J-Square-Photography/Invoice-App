import { Badge } from '@/components/ui/badge';
import { QUOTE_STATUS_LABELS, displayQuoteStatus } from '@/lib/quote-status';

/** Draft / Sent / Accepted / Declined, with a sent quote past its date shown as Expired. */
export function QuoteStatusBadge({ status, validUntil }: { status: string; validUntil: string | Date }) {
  const shown = displayQuoteStatus(status, validUntil);
  const variant =
    shown === 'ACCEPTED' ? 'success' : shown === 'SENT' ? 'outline' : shown === 'EXPIRED' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{QUOTE_STATUS_LABELS[shown] ?? shown}</Badge>;
}
