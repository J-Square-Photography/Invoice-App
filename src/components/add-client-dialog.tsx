'use client';

import { useEffect, useState } from 'react';
import { PhoneInput } from '@/components/phone-input';
import { SalutationNameFields, EMPTY_NAME_FIELDS, type NameFieldsValue } from '@/components/salutation-name-fields';
import { FieldTag } from '@/components/field-tag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Loader2 } from 'lucide-react';
import { logCancelledAction } from '@/lib/log-cancel';

export interface CreatedClient {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
}

const EMPTY_FORM = {
  companyName: '',
  email: '',
  phone: '',
  uen: '',
  address: '',
  socials: '',
  internalNotes: '',
};

/** The "Add Client" form, shared between the Clients page and anywhere else (e.g. project creation)
 * that needs to create a client on the spot without navigating away. */
export function AddClientDialog({
  open,
  onOpenChange,
  onCreated,
  initialCompanyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: CreatedClient) => void;
  /** Prefills Company Name, e.g. with whatever the user had already typed into a search box. */
  initialCompanyName?: string;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [nameFields, setNameFields] = useState<NameFieldsValue>(EMPTY_NAME_FIELDS);
  const { toast } = useToast();

  // Each time the dialog opens fresh, start from the given name (if any) rather than whatever
  // was left over from the last time it was opened.
  useEffect(() => {
    if (open) {
      setFormData({ ...EMPTY_FORM, companyName: initialCompanyName?.trim() || '' });
      setNameFields(EMPTY_NAME_FIELDS);
    }
  }, [open, initialCompanyName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Any close that isn't a successful save (Cancel button, X, backdrop, Escape all funnel here)
  const handleDismiss = (next: boolean) => {
    if (!next) logCancelledAction('CLIENT', 'Cancelled creating a new client.');
    onOpenChange(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, ...nameFields }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create client');

      toast({ title: 'Success', description: 'Client created successfully' });
      onOpenChange(false);
      onCreated(data.client);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create client. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>Enter the client details below. Click save when you're done.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ac-companyName">Client / Company Name <FieldTag required /></Label>
              <Input id="ac-companyName" name="companyName" required value={formData.companyName} onChange={handleInputChange} />
            </div>
            <SalutationNameFields idPrefix="ac" value={nameFields} onChange={setNameFields} />
            <div className="space-y-2">
              <Label htmlFor="ac-email">Email <FieldTag /></Label>
              <Input id="ac-email" name="email" type="email" value={formData.email} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-phone">Phone <FieldTag /></Label>
              <PhoneInput id="ac-phone" value={formData.phone} onChange={(v) => setFormData((prev) => ({ ...prev, phone: v }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-uen">UEN <FieldTag /></Label>
              <Input id="ac-uen" name="uen" value={formData.uen} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-address">Address <FieldTag /></Label>
              <Input id="ac-address" name="address" maxLength={300} placeholder="e.g. 123 Example Road, #01-23, Singapore 123456" value={formData.address} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-socials">Socials / Links <FieldTag /></Label>
              <Input id="ac-socials" name="socials" placeholder="e.g. instagram.com/company" value={formData.socials} onChange={handleInputChange} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ac-internalNotes">Internal Notes <FieldTag /></Label>
            <Textarea id="ac-internalNotes" name="internalNotes" rows={4} value={formData.internalNotes} onChange={handleInputChange} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => handleDismiss(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
