import { AlertTriangle } from 'lucide-react';
import type { DeleteImpact } from '@/lib/delete-impact';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The list of related records that will be deleted too, shown inside a delete confirmation. */
export function DeleteImpactWarning({ impact, showProjects }: { impact: DeleteImpact | null | undefined; showProjects?: boolean }) {
  if (!impact) return <p className="text-sm text-muted-foreground">Checking what else will be deleted...</p>;

  const lines: string[] = [];
  if (showProjects && impact.projects > 0) lines.push(plural(impact.projects, 'project'));
  if (impact.invoices > 0) lines.push(plural(impact.invoices, 'invoice'));
  if (impact.quotes > 0) lines.push(plural(impact.quotes, 'quotation'));
  if (impact.payments > 0) lines.push(`${plural(impact.payments, 'payment record')} ($${impact.paymentsTotal.toFixed(2)} recorded as paid)`);
  if (impact.contracts > 0) {
    lines.push(
      `${plural(impact.contracts, 'contract')}${impact.signedContracts > 0 ? `, including ${impact.signedContracts} signed (their signing links and audit records are removed)` : ''}`
    );
  }

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing else is linked to it.</p>;
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" /> This will also permanently delete:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
