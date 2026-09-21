'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  ExternalLink,
  ShieldCheck,
  Clock,
  Trash2,
  Loader2,
  FileSignature,
  Building2,
  Calendar,
} from 'lucide-react';

interface ContractDetail {
  id: string;
  title: string;
  contractBody: string;
  signingToken: string;
  isSigned: boolean;
  signedAt: string | null;
  tokenExpiresAt: string;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    balanceDue: number;
    dueDate: string;
    project: {
      id: string;
      title: string;
      projectType: string;
      shootDate: string | null;
      client: {
        id: string;
        companyName: string;
        contactName: string;
        email: string;
        uen: string | null;
      };
    };
  };
  signatureAudit?: {
    signatureImageBase64: string;
    signerName: string;
    signerEmail: string | null;
    signerIp: string;
    userAgent: string;
    documentSha256: string;
    signedUtcTimestamp: string;
    intentConfirmed: boolean;
  } | null;
}

export default function ContractDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContract(data.contract);
      } else {
        toast({ title: 'Error', description: 'Contract not found', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load contract', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) fetchContract();
  }, [id, fetchContract]);

  const copySigningLink = () => {
    if (!contract) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/sign?token=${contract.signingToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link Copied', description: 'Client signing link copied to clipboard!' });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contract? This will invalidate the signing link.')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Contract deleted successfully' });
        router.push('/admin/contracts');
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete contract', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error deleting contract', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-neutral-500">Contract could not be found.</p>
        <Link href="/admin/contracts">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contracts
          </Button>
        </Link>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const signingUrl = `${origin}/sign?token=${contract.signingToken}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/contracts">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-neutral-900">{contract.title}</h1>
              {contract.isSigned ? (
                <Badge variant="success" className="shrink-0 whitespace-nowrap">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Signed & Sealed
                </Badge>
              ) : (
                <Badge variant="warning" className="shrink-0 whitespace-nowrap">
                  <Clock className="mr-1 h-3 w-3" /> Pending Client Signature
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Invoice #{contract.invoice.invoiceNumber} • Created {new Date(contract.createdAt).toLocaleDateString('en-SG')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!contract.isSigned && (
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="text-red-600 hover:text-red-700">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          )}

          <a href={`/api/contracts/${contract.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download Contract PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Signing Link Banner */}
      <Card className="bg-neutral-50 border-neutral-300 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
              <FileSignature className="h-4 w-4 text-neutral-600" />
              Client Public Signing URL (Zero-Login Required)
            </p>
            <p className="text-xs text-neutral-500 font-mono mt-0.5 break-all">{signingUrl}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={copySigningLink} className="h-8 text-xs">
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <a href={signingUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="h-8 text-xs">
                Open Portal <ExternalLink className="ml-1.5 h-3 w-3" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Meta Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-400 uppercase">Client Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="font-semibold text-neutral-900">{contract.invoice.project.client.companyName}</p>
            <p className="text-neutral-600 text-xs">{contract.invoice.project.client.contactName}</p>
            <p className="text-neutral-500 text-xs">{contract.invoice.project.client.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-400 uppercase">Project / Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="font-semibold text-neutral-900">{contract.invoice.project.title}</p>
            <p className="text-neutral-600 text-xs">
              Shoot:{' '}
              {contract.invoice.project.shootDate
                ? new Date(contract.invoice.project.shootDate).toLocaleDateString('en-SG')
                : 'To be scheduled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-neutral-400 uppercase">Invoice Value</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="text-lg font-bold text-neutral-900">SGD ${contract.invoice.totalAmount.toFixed(2)}</p>
            <Link href={`/admin/invoices/${contract.invoice.id}`} className="text-xs text-blue-600 hover:underline">
              View Invoice #{contract.invoice.invoiceNumber} →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Legal Audit Trail Certificate (If Signed) */}
      {contract.isSigned && contract.signatureAudit && (
        <Card className="border-2 border-emerald-500 bg-emerald-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base text-emerald-950 font-bold">
                Electronic Signature Audit Trail Certificate
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-emerald-800">
              Authenticated & stamped in compliance with the Singapore Electronic Transactions Act 2010
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-emerald-200 text-xs">
              <div>
                <p className="text-neutral-500">Signer Full Name:</p>
                <p className="font-semibold text-neutral-900 text-sm mt-0.5">{contract.signatureAudit.signerName}</p>
              </div>

              <div>
                <p className="text-neutral-500">Signer Email:</p>
                <p className="font-semibold text-neutral-900 text-sm mt-0.5">
                  {contract.signatureAudit.signerEmail || contract.invoice.project.client.email}
                </p>
              </div>

              <div>
                <p className="text-neutral-500">Execution UTC Timestamp:</p>
                <p className="font-mono text-neutral-900 mt-0.5">
                  {new Date(contract.signatureAudit.signedUtcTimestamp).toUTCString()}
                </p>
              </div>

              <div>
                <p className="text-neutral-500">Signer IP Address:</p>
                <p className="font-mono text-neutral-900 mt-0.5">{contract.signatureAudit.signerIp}</p>
              </div>
            </div>

            {/* SHA-256 Hash & Device */}
            <div className="pt-3 space-y-2 text-xs">
              <div>
                <p className="text-neutral-500 font-medium">Cryptographic SHA-256 Document Fingerprint:</p>
                <p className="font-mono text-neutral-900 text-[11px] bg-white p-2 rounded border border-emerald-200 mt-1 break-all">
                  {contract.signatureAudit.documentSha256}
                </p>
              </div>

              <div>
                <p className="text-neutral-500 font-medium">Signing Device / User-Agent:</p>
                <p className="text-neutral-600 text-[11px] truncate">{contract.signatureAudit.userAgent}</p>
              </div>

              {/* Signature Image Render */}
              <div className="pt-2">
                <p className="text-neutral-500 font-medium mb-1">Captured Signature Pad Raster:</p>
                {/* Fixed white (not themed) so the signature always shows exactly as signed */}
                <div className="p-3 bg-[#ffffff] rounded-lg border border-neutral-300 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={contract.signatureAudit.signatureImageBase64}
                    alt="Digital Signature"
                    className="h-16 max-w-xs object-contain"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Terms Text View */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Agreement Text</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 font-mono text-xs whitespace-pre-wrap leading-relaxed text-neutral-800 max-h-[500px] overflow-y-auto">
            {contract.contractBody}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
