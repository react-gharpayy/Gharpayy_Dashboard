'use client';

import AddLeadDialog from '@/components/AddLeadDialog';
import type { LeadWithRelations } from '@/hooks/useCrmData';

interface EditLeadDialogProps {
  lead: LeadWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditLeadDialog = ({ lead, open, onOpenChange }: EditLeadDialogProps) => {
  return <AddLeadDialog editingLead={lead} open={open} onOpenChange={onOpenChange} />;
};

export default EditLeadDialog;
