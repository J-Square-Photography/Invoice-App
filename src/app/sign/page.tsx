'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  CheckCircle,
  FileSignature,
  Download,
  AlertCircle,
  Clock,
  RotateCcw,
  ShieldCheck,
  Building2,
  Calendar,
  Loader2,
} from 'lucide-react';

interface ContractData {
  contract: {
    id: string;
    title: string;
    contractBody: string;
    isSigned: boolean;
    signedAt: string | null;
    isExpired: boolean;
    tokenExpiresAt: string;
    signatureAudit?: {
      signerName: string;
      signerEmail: string | null;
      signedUtcTimestamp: string;
      documentSha256: string;
    } | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    balanceDue: number;
    dueDate: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  };
  project: {
    title: string;
    projectType: string;
    shootDate: string | null;
  };
  client: {
    companyName: string;
    contactName: string;
    email: string;
    uen: string | null;
  };
}

function SigningPortal() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContractData | null>(null);
  const [error, setError] = useState('');

  // Signature Form State
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [intentConfirmed, setIntentConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);
  const [auditInfo, setAuditInfo] = useState<{ documentSha256: string; signedAt: string } | null>(null);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Fetch contract details by token
  useEffect(() => {
    if (!token) {
      setError('No signing token provided in the URL.');
      setLoading(false);
      return;
    }

    const fetchContract = async () => {
      try {
        const res = await fetch(`/api/sign?token=${token}`);
        const result = await res.json();

        if (!res.ok) {
          setError(result.error || 'Failed to load contract');
          return;
        }

        setData(result);
        setSignerName(result.client?.contactName || '');
        setSignerEmail(result.client?.email || '');

        if (result.contract.isSigned) {
          setSignedSuccess(true);
          if (result.contract.signatureAudit) {
            setAuditInfo({
              documentSha256: result.contract.signatureAudit.documentSha256,
              signedAt: result.contract.signatureAudit.signedUtcTimestamp,
            });
          }
        }
      } catch {
        setError('Network error while loading contract');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [token]);

  // Setup Canvas with Retina / Touch support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
  }, [loading, signedSuccess]);

  // Canvas Drawing Handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  // Submit Signature
  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasDrawn) {
      toast({ title: 'Signature Required', description: 'Please draw your signature on the pad below', variant: 'destructive' });
      return;
    }

    if (!intentConfirmed) {
      toast({ title: 'Consent Required', description: 'Please check the legal acknowledgment checkbox', variant: 'destructive' });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureImageBase64 = canvas.toDataURL('image/png');

    setSubmitting(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signerName,
          signerEmail,
          signatureImageBase64,
          intentConfirmed: true,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({ title: 'Submission Error', description: result.error || 'Failed to submit signature', variant: 'destructive' });
        return;
      }

      setSignedSuccess(true);
      setAuditInfo({
        documentSha256: result.documentSha256,
        signedAt: result.signedAt,
      });
      toast({ title: 'Contract Signed', description: 'Thank you! Your agreement has been legally sealed.' });
    } catch {
      toast({ title: 'Error', description: 'Network error submitting signature', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-neutral-600 mb-4" />
        <p className="text-sm font-medium text-neutral-600">Loading your secure agreement...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4">
        <Card className="max-w-md w-full text-center p-6 shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
          <CardTitle className="text-xl">Unable to Access Contract</CardTitle>
          <CardDescription className="mt-2 text-neutral-600">
            {error || 'This signing link is either invalid, tampered with, or expired.'}
          </CardDescription>
          <p className="text-xs text-neutral-400 mt-4">
            If you believe this is an error, please contact J Square Photography directly.
          </p>
        </Card>
      </div>
    );
  }

  if (data.contract.isExpired && !signedSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4">
        <Card className="max-w-md w-full text-center p-6 shadow-lg">
          <Clock className="mx-auto h-12 w-12 text-amber-500 mb-3" />
          <CardTitle className="text-xl">Signing Link Expired</CardTitle>
          <CardDescription className="mt-2 text-neutral-600">
            This agreement link expired on {new Date(data.contract.tokenExpiresAt).toLocaleDateString('en-SG')}.
          </CardDescription>
          <p className="text-xs text-neutral-400 mt-4">
            Please request an updated contract link from J Square Photography.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-neutral-900 p-2 shadow-sm">
            <img src="/logo-white.png" alt="J Square" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">J Square Photography</h1>
          <p className="text-xs text-neutral-500 font-medium tracking-wider uppercase">
            Secure Digital Contract & E-Signature Portal
          </p>
        </div>

        {/* Signed Success Banner */}
        {signedSuccess && (
          <Card className="border-2 border-emerald-500 bg-emerald-50/50 shadow-md">
            <CardContent className="p-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500 text-white">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-emerald-900">Agreement Legally Executed & Sealed</h2>
              <p className="text-sm text-emerald-800 max-w-lg mx-auto">
                Thank you, <strong>{signerName || data.client.contactName}</strong>. Your electronic signature has been authenticated and stamped under the Singapore Electronic Transactions Act 2010.
              </p>

              {auditInfo && (
                <div className="bg-white p-3 rounded-lg border border-emerald-200 text-left max-w-xl mx-auto text-xs space-y-1 font-mono text-neutral-600">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Timestamp (UTC):</span>
                    <span>{new Date(auditInfo.signedAt).toUTCString()}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-400">SHA-256 Fingerprint:</span>
                    <span className="truncate text-emerald-700 font-bold">{auditInfo.documentSha256}</span>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <a
                  href={`/api/contracts/${data.contract.id}/pdf?token=${token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                    <Download className="mr-2 h-4 w-4" /> Download Signed Agreement (PDF)
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agreement Summary Box */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-neutral-900">{data.contract.title}</CardTitle>
                <CardDescription className="text-xs">
                  Invoice Ref: <span className="font-mono font-medium">{data.invoice.invoiceNumber}</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={signedSuccess ? 'success' : 'warning'}>
                  {signedSuccess ? 'Signed & Sealed' : 'Action Required: Pending Signature'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-neutral-200 text-sm">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase">Client</p>
                <p className="font-semibold text-neutral-900 mt-1">{data.client.companyName}</p>
                <p className="text-neutral-600 text-xs">{data.client.contactName}</p>
                {data.client.uen && <p className="text-neutral-500 text-xs font-mono">UEN: {data.client.uen}</p>}
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase">Project</p>
                <p className="font-semibold text-neutral-900 mt-1">{data.project.title}</p>
                <p className="text-neutral-600 text-xs">
                  Shoot Date:{' '}
                  {data.project.shootDate
                    ? new Date(data.project.shootDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'To be scheduled'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase">Financial Consideration</p>
                <p className="text-lg font-bold text-neutral-900 mt-1">SGD ${data.invoice.totalAmount.toFixed(2)}</p>
                <p className="text-xs text-neutral-500">Deposit Due: SGD ${(data.invoice.totalAmount * 0.5).toFixed(2)}</p>
              </div>
            </div>

            {/* Contract Body Scrollable View */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase text-neutral-400 mb-2">Contract Terms & Conditions</h3>
              <div className="p-5 bg-white rounded-lg border border-neutral-200 text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
                {data.contract.contractBody}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* E-Signature Canvas & Submission Form */}
        {!signedSuccess && (
          <Card className="shadow-md border-neutral-300">
            <CardHeader className="bg-neutral-50/50 border-b border-neutral-200">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-neutral-700" /> Sign Agreement
              </CardTitle>
              <CardDescription className="text-xs">
                Draw your signature below using your finger, stylus, or mouse.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSign} className="space-y-6">
                {/* Signer Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signerName" className="text-xs font-semibold">Signer Full Name *</Label>
                    <Input
                      id="signerName"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="e.g. Marcus Tan"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signerEmail" className="text-xs font-semibold">Signer Official Email *</Label>
                    <Input
                      id="signerEmail"
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      placeholder="e.g. marcus@company.com"
                      required
                    />
                  </div>
                </div>

                {/* HTML5 Canvas Signature Pad */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">Signature Pad *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearCanvas}
                      className="h-7 text-xs text-neutral-500 hover:text-neutral-900"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Clear Pad
                    </Button>
                  </div>

                  <div className="relative border-2 border-dashed border-neutral-300 rounded-xl bg-white overflow-hidden shadow-inner touch-none">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-44 cursor-crosshair block"
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-neutral-400 text-xs font-medium">
                        ✍️ Sign with finger, stylus, or mouse here
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    High-resolution vector rasterization with anti-aliased stroke capture.
                  </p>
                </div>

                {/* Legal Disclaimer & Checkbox */}
                <div className="p-4 bg-neutral-100 rounded-xl space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={intentConfirmed}
                      onChange={(e) => setIntentConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-950"
                      required
                    />
                    <span className="text-xs text-neutral-700 leading-normal">
                      <strong>Legal Acknowledgment & Consent:</strong> I confirm that I am an authorized representative of{' '}
                      <strong>{data.client.companyName}</strong>. I understand and agree that executing this digital signature serves as a legally binding acceptance under the <strong>Singapore Electronic Transactions Act 2010</strong>, with full legal effect, validity, and enforceability.
                    </span>
                  </label>

                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1 border-t border-neutral-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Captures UTC timestamp, client IP address, and SHA-256 tamper-evident digital fingerprint.</span>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || !hasDrawn || !intentConfirmed}
                    className="w-full sm:w-auto px-8"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sealing Agreement...
                      </>
                    ) : (
                      <>
                        <FileSignature className="mr-2 h-4 w-4" /> Legally Sign Agreement
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-600" />
        </div>
      }
    >
      <SigningPortal />
    </Suspense>
  );
}
