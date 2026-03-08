import { useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useLeads } from '@/hooks/useCrmData';
import { useAllBeds, usePropertiesWithOwners } from '@/hooks/useInventoryData';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, MapPin, IndianRupee, Bed, ArrowRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const Matching = () => {
  const { data: leads } = useLeads();
  const { data: beds } = useAllBeds();
  const { data: properties } = usePropertiesWithOwners();
  const [selectedLead, setSelectedLead] = useState<string>('');

  const activeLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter(l => l.status !== 'booked' && l.status !== 'lost');
  }, [leads]);

  const lead = activeLeads.find(l => l.id === selectedLead);

  // Matching logic
  const matches = useMemo(() => {
    if (!lead || !beds || !properties) return [];

    const vacantBeds = (beds as any[]).filter(b => b.status === 'vacant');

    return vacantBeds
      .map(bed => {
        const prop = properties.find((p: any) => p.id === bed.rooms?.property_id);
        if (!prop) return null;

        let score = 0;
        const reasons: string[] = [];

        // Location match
        const area = ((prop as any).area || '').toLowerCase();
        const leadLoc = (lead.preferred_location || '').toLowerCase();
        if (leadLoc && area && area.includes(leadLoc)) {
          score += 40;
          reasons.push('Location match');
        } else if (leadLoc && area) {
          score += 5;
        }

        // Budget match
        const rent = Number(bed.rooms?.rent_per_bed || bed.rooms?.expected_rent || 0);
        const budget = parseBudget(lead.budget || '');
        if (budget > 0 && rent > 0) {
          if (rent <= budget) {
            score += 35;
            reasons.push('Within budget');
          } else if (rent <= budget * 1.15) {
            score += 15;
            reasons.push('Slightly over budget');
          }
        }

        // Room type from notes
        const notes = (lead.notes || '').toLowerCase();
        const roomType = (bed.rooms?.room_type || '').toLowerCase();
        if (notes.includes('single') && roomType.includes('single')) { score += 15; reasons.push('Single room'); }
        else if (notes.includes('2') && roomType.includes('2 sharing')) { score += 15; reasons.push('2 sharing'); }
        else if (notes.includes('3') && roomType.includes('3 sharing')) { score += 15; reasons.push('3 sharing'); }

        // Availability bonus
        score += 10;
        reasons.push('Available now');

        return {
          bed,
          property: prop,
          rent,
          score,
          reasons,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10);
  }, [lead, beds, properties]);

  return (
    <AppLayout title="Lead ↔ Room Matching" subtitle="AI-powered inventory recommendations for each lead">
      <div className="space-y-6">
        {/* Lead selector */}
        <div className="max-w-md">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select a lead to match</label>
          <Select value={selectedLead} onValueChange={setSelectedLead}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Choose a lead..." /></SelectTrigger>
            <SelectContent>
              {activeLeads.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} — {l.preferred_location || 'No location'} · {l.budget || 'No budget'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lead summary */}
        {lead && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border bg-card">
            <h3 className="text-sm font-semibold">{lead.name}</h3>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              {lead.preferred_location && <span className="flex items-center gap-1"><MapPin size={12} /> {lead.preferred_location}</span>}
              {lead.budget && <span className="flex items-center gap-1"><IndianRupee size={12} /> {lead.budget}</span>}
              {lead.notes && <span className="flex items-center gap-1"><Bed size={12} /> {lead.notes}</span>}
            </div>
          </motion.div>
        )}

        {/* Matches */}
        {lead && matches.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              Top Matches
              <Badge variant="secondary" className="text-[10px]">{matches.length} found</Badge>
            </h2>
            <div className="grid gap-2">
              {(matches as any[]).map((m, i) => (
                <motion.div
                  key={m.bed.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl border bg-card hover:border-accent/20 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-5 text-center">{i + 1}.</span>
                        <h3 className="text-sm font-semibold">{m.property.name}</h3>
                        <Badge variant="secondary" className="text-[10px]">{(m.property as any).area}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-7">
                        Room {m.bed.rooms?.room_number} · Bed {m.bed.bed_number}
                        {m.bed.rooms?.room_type && ` · ${m.bed.rooms.room_type}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">₹{m.rent.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">/month</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5 ml-7">
                    {m.reasons.map((r: string) => (
                      <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium status-good-bg border">
                        <Check size={9} className="status-good" /> {r}
                      </span>
                    ))}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/10 text-accent border border-accent/20">
                      {m.score}% match
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {lead && matches.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bed size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No matching beds available</p>
            <p className="text-xs mt-1">Try adding inventory or adjusting lead requirements</p>
          </div>
        )}

        {!lead && (
          <div className="text-center py-20 text-muted-foreground">
            <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a lead above to see matched inventory</p>
            <p className="text-xs mt-1">The system matches location, budget, and room preferences</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function parseBudget(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.toLowerCase().replace(/[₹,\s]/g, '');
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|l|lakh|cr)?/);
  if (!match) return 0;
  let val = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'k') val *= 1000;
  else if (suffix === 'l' || suffix === 'lakh') val *= 100000;
  else if (suffix === 'cr') val *= 10000000;
  return val;
}

export default Matching;
