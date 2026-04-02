"use client";

import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import LeadCard from '@/components/LeadCard';
import LeadDetailDrawer from '@/components/LeadDetailDrawer';
import EditLeadDialog from '@/components/EditLeadDialog';
import { useLeads, usePipelineStages, useSavePipelineStages, useUpdateLead, type PipelineStageConfig } from '@/hooks/useCrmData';
import { PIPELINE_STAGES, type PipelineStage } from '@/types/crm';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DndContext, DragOverlay, pointerWithin, rectIntersection,
  PointerSensor, TouchSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { toast } from 'sonner';
import type { LeadWithRelations } from '@/hooks/useCrmData';
import { motion } from 'framer-motion';
import { ArrowRight, MoreVertical, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] flex-1 space-y-2 rounded-lg transition-colors duration-150 ${
        isOver ? 'bg-accent/10 ring-2 ring-accent/30' : ''
      }`}
    >
      {children}
    </div>
  );
}

function DraggableCard({ lead, onClick, onEdit }: { lead: LeadWithRelations; onClick: () => void; onEdit: (lead: LeadWithRelations) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { lead } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ willChange: isDragging ? 'transform' : 'auto' }}
      className={`cursor-grab active:cursor-grabbing touch-none select-none transition-opacity duration-150 ${isDragging ? 'opacity-20 scale-[0.98]' : ''}`}
      onDoubleClick={onClick}
    >
      <LeadCard lead={{
        id: lead.id, name: lead.name, phone: lead.phone,
        source: lead.source as any, status: lead.status as any,
        assignedAgent: lead.members?.name || 'Unassigned',
        zone: (lead as any).zone ?? undefined,
        createdAt: lead.createdAt, lastActivity: lead.lastActivityAt,
        firstResponseTime: lead.firstResponseTimeMin ?? undefined,
        budget: lead.budget ?? undefined, preferredLocation: lead.preferredLocation ?? undefined,
        property: lead.properties?.name ?? undefined,
      }} stale={new Date(lead.lastActivityAt).getTime() < Date.now() - 7 * 86400000}
        extraActions={
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-lg hover:bg-secondary transition-colors" title="More options">
                  <MoreVertical size={11} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(lead)}>
                  Edit Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
    </div>
  );
}

function slugifyStageKey(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function EditStagesDialog({
  open,
  onOpenChange,
  stages,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStageConfig[];
  onSave: (stages: PipelineStageConfig[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [draftStages, setDraftStages] = useState<PipelineStageConfig[]>([]);
  const [newStageLabel, setNewStageLabel] = useState('');

  const resetFromProps = () => {
    setDraftStages(stages.map((s, index) => ({ ...s, order: index })));
    setNewStageLabel('');
  };

  useEffect(() => {
    if (open) {
      resetFromProps();
    }
  }, [open, stages]);

  const reorderStage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= draftStages.length || toIndex >= draftStages.length) return;
    const copy = [...draftStages];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
    setDraftStages(copy.map((s, i) => ({ ...s, order: i })));
  };

  const removeStage = (index: number) => {
    if (draftStages.length <= 1) {
      toast.error('At least one stage is required');
      return;
    }
    const copy = draftStages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    setDraftStages(copy);
  };

  const addStage = () => {
    const label = newStageLabel.trim();
    if (!label) return;

    let baseKey = slugifyStageKey(label);
    if (!baseKey) {
      toast.error('Please enter a valid stage name');
      return;
    }
    let key = baseKey;
    let n = 2;
    const keySet = new Set(draftStages.map((s) => s.key));
    while (keySet.has(key)) {
      key = `${baseKey}_${n}`;
      n += 1;
    }

    setDraftStages([
      ...draftStages,
      {
        key,
        label,
        color: 'bg-secondary',
        order: draftStages.length,
      },
    ]);
    setNewStageLabel('');
  };

  const save = async () => {
    const cleaned = draftStages
      .map((s, index) => ({
        ...s,
        label: String(s.label || '').trim(),
        key: String(s.key || '').trim(),
        color: String(s.color || 'bg-secondary').trim(),
        order: index,
      }))
      .filter((s) => s.key && s.label);

    if (cleaned.length === 0) {
      toast.error('At least one stage is required');
      return;
    }
    if (new Set(cleaned.map((s) => s.key)).size !== cleaned.length) {
      toast.error('Stage keys must be unique');
      return;
    }

    await onSave(cleaned);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) resetFromProps();
      }}
    >
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Edit Pipeline Stages</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={newStageLabel}
              onChange={(e) => setNewStageLabel(e.target.value)}
              placeholder="Add new stage name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStage();
                }
              }}
            />
            <Button type="button" variant="outline" className="gap-1.5" onClick={addStage}>
              <Plus size={14} /> Add Stage
            </Button>
          </div>

          <div className="max-h-[52vh] overflow-y-auto border rounded-md">
            <div className="p-2 space-y-2">
              {draftStages.length === 0 && (
                <div className="text-sm text-muted-foreground p-3 text-center">
                  No stages loaded yet. Add a stage to begin.
                </div>
              )}
              {draftStages.map((stage, index) => (
                <div
                  key={stage.key}
                  className="grid grid-cols-12 gap-2 items-center border rounded-md p-2"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    if (!Number.isNaN(from)) reorderStage(from, index);
                  }}
                >
                  <div className="col-span-1 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing" title="Drag to reorder">
                    <GripVertical size={14} />
                  </div>

                  <div className="col-span-10">
                    <Input
                      value={stage.label}
                      onChange={(e) => {
                        const copy = [...draftStages];
                        copy[index] = { ...copy[index], label: e.target.value };
                        setDraftStages(copy);
                      }}
                      placeholder="Stage label"
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStage(index)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Deleting a stage will automatically move its leads to the first stage.</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Stages'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Pipeline = () => {
  const { user } = useAuth();
  const { data: leads, isLoading } = useLeads();
  const { data: pipelineStagesData } = usePipelineStages();
  const savePipelineStages = useSavePipelineStages();
  const updateLead = useUpdateLead();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<LeadWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStagesOpen, setEditStagesOpen] = useState(false);
  const pipelineStages: PipelineStageConfig[] =
    (pipelineStagesData && pipelineStagesData.length > 0)
      ? pipelineStagesData
      : PIPELINE_STAGES.map((stage, index) => ({ ...stage, order: index }));
  const canEditStages = user?.role === 'super_admin';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  // Custom collision detection: only consider droppable columns (stage keys), never other draggable cards
  const stageKeys = useMemo(() => new Set(pipelineStages.map(s => s.key)), [pipelineStages]);
  const columnOnlyCollision: CollisionDetection = (args) => {
    // First try pointerWithin — the most intuitive algorithm
    const pointerCollisions = pointerWithin(args);
    const columnHits = pointerCollisions.filter(c => stageKeys.has(String(c.id)));
    if (columnHits.length > 0) return columnHits;

    // Fallback to rectIntersection for edge cases (fast drags)
    const rectCollisions = rectIntersection(args);
    const rectColumnHits = rectCollisions.filter(c => stageKeys.has(String(c.id)));
    if (rectColumnHits.length > 0) return rectColumnHits;

    return [];
  };
  const activeLead = leads?.find(l => l.id === activeId);

  // Conversion rates between stages
  const conversionRates = useMemo(() => {
    if (!leads) return {};
    const rates: Record<string, number> = {};
    for (let i = 0; i < pipelineStages.length - 1; i++) {
      const current = leads.filter(l => {
        const idx = pipelineStages.findIndex(s => s.key === l.status);
        return idx >= i;
      }).length;
      const next = leads.filter(l => {
        const idx = pipelineStages.findIndex(s => s.key === l.status);
        return idx >= i + 1;
      }).length;
      rates[pipelineStages[i].key] = current > 0 ? Math.round((next / current) * 100) : 0;
    }
    return rates;
  }, [leads, pipelineStages]);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const newStatus = over.id as PipelineStage;
    const lead = leads?.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    try {
      await updateLead.mutateAsync({ id: leadId, status: newStatus });
      toast.success(`Moved to ${pipelineStages.find(s => s.key === newStatus)?.label || newStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lead');
    }
  };

  const openDetail = (lead: LeadWithRelations) => { setSelectedLead(lead); setDrawerOpen(true); };
  const openEdit = (lead: LeadWithRelations) => { setSelectedLeadForEdit(lead); setEditDialogOpen(true); };
  const handleSaveStages = async (stages: PipelineStageConfig[]) => {
    await savePipelineStages.mutateAsync(stages);
  };

  if (isLoading) {
    return (
      <AppLayout title="Pipeline" subtitle="Revenue engine — track leads through every stage">
        <div className="flex gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[400px] w-[272px] rounded-xl" />)}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Pipeline"
      subtitle="Revenue engine — track leads through every stage"
      actions={
        <div className="flex items-center gap-2">
          {canEditStages && (
            <Button variant="outline" size="sm" onClick={() => setEditStagesOpen(true)}>
              Edit Stages
            </Button>
          )}
        </div>
      }
    >
      <DndContext sensors={sensors} collisionDetection={columnOnlyCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-2 min-w-max">
            {pipelineStages.map((stage, i) => {
              const stageLeads = leads?.filter(l => l.status === stage.key) || [];
              const rate = conversionRates[stage.key];
              return (
                <div key={stage.key} className="flex items-start">
                  <motion.div
                    className="pipeline-column bg-secondary/30 w-[272px] flex flex-col"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-[11px] text-foreground">{stage.label}</h3>
                      </div>
                      <span className="text-[10px] font-medium bg-card px-1.5 py-0.5 rounded-md text-muted-foreground border border-border">
                        {stageLeads.length}
                      </span>
                    </div>
                    <DroppableColumn id={stage.key}>
                      {stageLeads.map(lead => (
                        <DraggableCard key={lead.id} lead={lead} onClick={() => openDetail(lead)} onEdit={openEdit} />
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="text-center py-8 text-[11px] text-muted-foreground">No leads</div>
                      )}
                    </DroppableColumn>
                  </motion.div>

                  {/* Conversion arrow between stages */}
                  {i < pipelineStages.length - 1 && (
                    <div className="flex flex-col items-center justify-start pt-8 px-0.5 min-w-[28px]">
                      <ArrowRight size={10} className="text-muted-foreground/40" />
                      {rate !== undefined && (
                        <span className={`text-[9px] font-bold mt-0.5 ${
                          rate >= 50 ? 'status-good' : rate >= 25 ? 'status-warn' : 'status-bad'
                        }`}>
                          {rate}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeLead ? (
            <div className="rotate-1 opacity-95 shadow-xl rounded-xl" style={{ willChange: 'transform', pointerEvents: 'none' }}>
              <LeadCard lead={{
                id: activeLead.id, name: activeLead.name, phone: activeLead.phone,
                source: activeLead.source as any, status: activeLead.status as any,
                assignedAgent: activeLead.members?.name || 'Unassigned',
                zone: (activeLead as any).zone ?? undefined,
                createdAt: activeLead.createdAt, lastActivity: activeLead.lastActivityAt,
                firstResponseTime: activeLead.firstResponseTimeMin ?? undefined,
                budget: activeLead.budget ?? undefined, preferredLocation: activeLead.preferredLocation ?? undefined,
                property: activeLead.properties?.name ?? undefined,
              }} compact stale={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDetailDrawer lead={selectedLead} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <EditLeadDialog
        lead={selectedLeadForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      {canEditStages && (
        <EditStagesDialog
          open={editStagesOpen}
          onOpenChange={setEditStagesOpen}
          stages={pipelineStages}
          onSave={handleSaveStages}
          isSaving={savePipelineStages.isPending}
        />
      )}
    </AppLayout>
  );
};

export default Pipeline;
