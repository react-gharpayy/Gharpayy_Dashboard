"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import AddLeadDialog from '@/components/AddLeadDialog';
import type { LeadWithRelations } from '@/hooks/useCrmData';

const LeadIntakePageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);
  const [editingLead, setEditingLead] = useState<LeadWithRelations | null>(null);
  const [loadingEditLead, setLoadingEditLead] = useState(false);

  const editId = searchParams.get('editId');

  useEffect(() => {
    if (open) return;

    // If this page was opened via window.open, close the tab after dialog close.
    window.close();

    const t = window.setTimeout(() => {
      router.replace('/leads');
    }, 120);

    return () => window.clearTimeout(t);
  }, [open, router]);

  useEffect(() => {
    let cancelled = false;

    if (!editId) {
      setEditingLead(null);
      setLoadingEditLead(false);
      return;
    }

    setLoadingEditLead(true);
    fetch(`/api/leads/${encodeURIComponent(editId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load lead for editing');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setEditingLead(data);
      })
      .catch(() => {
        if (cancelled) return;
        setEditingLead(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingEditLead(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editId]);

  if (editId && loadingEditLead) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#f4f7ff_0%,#eef3fb_35%,#e9eef8_65%,#e2e9f5_100%)] text-slate-900 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-300/80 bg-white/80 px-5 py-4 text-sm text-slate-600 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm">
          Loading lead edit workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#f4f7ff_0%,#eef3fb_35%,#e9eef8_65%,#e2e9f5_100%)] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-5 rounded-2xl border border-slate-300/80 bg-white/75 px-4 py-4 backdrop-blur md:px-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Gharpayy CRM</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Lead Intake Workspace</h1>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">Capture and qualify incoming leads in a dedicated full-page flow.</p>
        </div>

        <div className="h-[calc(100vh-10.5rem)] min-h-[680px] rounded-2xl border border-slate-300/90 bg-white/70 p-2 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm md:p-3">
          <AddLeadDialog open={open} onOpenChange={setOpen} layout="page" editingLead={editingLead} />
        </div>
      </div>
    </div>
  );
};

const LeadIntakePage = () => {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#f4f7ff_0%,#eef3fb_35%,#e9eef8_65%,#e2e9f5_100%)] text-slate-900 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-300/80 bg-white/80 px-5 py-4 text-sm text-slate-600 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm">
            Loading lead intake workspace...
          </div>
        </div>
      )}
    >
      <LeadIntakePageContent />
    </Suspense>
  );
};

export default LeadIntakePage;
