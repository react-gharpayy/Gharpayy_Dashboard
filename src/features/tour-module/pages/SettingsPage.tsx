"use client";

import { useState } from "react";
import { useSettings, type MessageTemplate, type ScoreWeights, type CustomField, type CustomTarget } from "@/myt/lib/settings-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { settings, update, reset, upsertTemplate, removeTemplate } = useSettings();

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Edit message templates, custom fields, scoring weights, reminders & targets. Stored locally.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { reset(); toast.success("Settings reset"); }}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset all
        </Button>
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="templates">Message templates</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="weights">Score weights</TabsTrigger>
          <TabsTrigger value="reminders">Reminder timing</TabsTrigger>
          <TabsTrigger value="custom">Custom fields & lists</TabsTrigger>
          <TabsTrigger value="targets">Custom targets</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-3">
          {settings.templates.map((t) => (
            <TemplateEditor key={t.id} t={t} onSave={upsertTemplate} onDelete={() => removeTemplate(t.id)} />
          ))}
          <NewTemplate onAdd={upsertTemplate} />
        </TabsContent>

        <TabsContent value="branding">
          <Card><CardContent className="p-4 space-y-3">
            <div><Label>Site name</Label><Input value={settings.siteName} onChange={(e) => update("siteName", e.target.value)} /></div>
            <div><Label>Signature line</Label><Input value={settings.signatureLine} onChange={(e) => update("signatureLine", e.target.value)} /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="weights">
          <WeightsEditor weights={settings.weights} onChange={(w) => update("weights", w)} />
        </TabsContent>

        <TabsContent value="reminders">
          <Card><CardContent className="p-4 space-y-3">
            <div>
              <Label>Pre-tour reminder offsets (minutes before tour, comma-separated)</Label>
              <Input
                value={settings.reminders.beforeTourMinutes.join(", ")}
                onChange={(e) =>
                  update("reminders", {
                    ...settings.reminders,
                    beforeTourMinutes: e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite),
                  })
                }
              />
            </div>
            <div>
              <Label>Post-booking follow-up if no reply (minutes, comma-separated)</Label>
              <Input
                value={settings.reminders.postBookingFollowupMinutes.join(", ")}
                onChange={(e) =>
                  update("reminders", {
                    ...settings.reminders,
                    postBookingFollowupMinutes: e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite),
                  })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">These show as a copy-paste plan on each tour. Manual send for now.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <ListEditor
            title="Areas"
            items={settings.customAreas}
            onChange={(v) => update("customAreas", v)}
            placeholder="Koramangala"
          />
          <ListEditor
            title="Objection tags"
            items={settings.customObjections}
            onChange={(v) => update("customObjections", v)}
            placeholder="Too expensive"
          />
          <ListEditor
            title="Custom outcomes"
            items={settings.customOutcomes}
            onChange={(v) => update("customOutcomes", v)}
            placeholder="Token paid via UPI"
          />
          <PropertyEditor
            items={settings.customProperties}
            onChange={(v) => update("customProperties", v)}
          />
          <TcmEditor items={settings.customTcms} onChange={(v) => update("customTcms", v)} />
          <CustomFieldsEditor fields={settings.customFields} onChange={(v) => update("customFields", v)} />
        </TabsContent>

        <TabsContent value="targets">
          <TargetsEditor targets={settings.targets} onChange={(v) => update("targets", v)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplateEditor({ t, onSave, onDelete }: { t: MessageTemplate; onSave: (t: MessageTemplate) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(t);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="max-w-xs font-medium" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onSave(draft); toast.success("Saved"); }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input value={draft.scenario} onChange={(e) => setDraft({ ...draft, scenario: e.target.value })} placeholder="When to send" />
        <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} className="font-mono text-xs" />
        <p className="text-[11px] text-muted-foreground">Variables: {"{{leadName}} {{propertyName}} {{area}} {{when}} {{tcmName}} {{tcmPhone}} {{budget}} {{workLocation}} {{mapsLink}} {{etaMinutes}} {{otp}} {{siteName}} {{signature}}"}</p>
      </CardContent>
    </Card>
  );
}

function NewTemplate({ onAdd }: { onAdd: (t: MessageTemplate) => void }) {
  const [draft, setDraft] = useState<MessageTemplate>({ id: "", label: "", scenario: "", body: "" });
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="text-sm font-medium">+ Add new template</div>
        <Input placeholder="ID (e.g. weekend_special)" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value.replace(/\s+/g, "_") })} />
        <Input placeholder="Label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <Input placeholder="Scenario" value={draft.scenario} onChange={(e) => setDraft({ ...draft, scenario: e.target.value })} />
        <Textarea placeholder="Body with {{variables}}" rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <Button size="sm" onClick={() => {
          if (!draft.id || !draft.label || !draft.body) return toast.error("ID, label and body required");
          onAdd(draft); setDraft({ id: "", label: "", scenario: "", body: "" }); toast.success("Added");
        }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </CardContent>
    </Card>
  );
}

function WeightsEditor({ weights, onChange }: { weights: ScoreWeights; onChange: (w: ScoreWeights) => void }) {
  const total = Object.values(weights).reduce((s, n) => s + n, 0);
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-xs text-muted-foreground">Total weight: <b>{total}</b> (recommended ~100)</div>
      {(Object.keys(weights) as Array<keyof ScoreWeights>).map((k) => (
        <div key={k} className="grid grid-cols-3 items-center gap-2">
          <Label className="capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
          <Input type="number" value={weights[k]} onChange={(e) => onChange({ ...weights, [k]: parseInt(e.target.value, 10) || 0 })} />
        </div>
      ))}
    </CardContent></Card>
  );
}

function ListEditor({ title, items, onChange, placeholder }: { title: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs">
            {it}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="hover:text-destructive">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
        <Button size="sm" onClick={() => { if (v.trim()) { onChange([...items, v.trim()]); setV(""); } }}>Add</Button>
      </div>
    </CardContent></Card>
  );
}

function PropertyEditor({ items, onChange }: { items: { id: string; name: string; area: string; basePrice: number }[]; onChange: (v: { id: string; name: string; area: string; basePrice: number }[]) => void }) {
  const [d, setD] = useState({ name: "", area: "", basePrice: 12000 });
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-sm font-medium">Custom properties</div>
      {items.map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-sm border-b py-1">
          <span className="flex-1">{p.name} <span className="text-muted-foreground">· {p.area} · ₹{p.basePrice.toLocaleString("en-IN")}</span></span>
          <button onClick={() => onChange(items.filter((x) => x.id !== p.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <Input placeholder="Area" value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })} />
        <Input type="number" placeholder="Base price" value={d.basePrice} onChange={(e) => setD({ ...d, basePrice: parseInt(e.target.value, 10) || 0 })} />
      </div>
      <Button size="sm" onClick={() => { if (!d.name) return; onChange([...items, { id: `cp${Date.now()}`, ...d }]); setD({ name: "", area: "", basePrice: 12000 }); }}>
        <Plus className="h-4 w-4 mr-1" /> Add property
      </Button>
    </CardContent></Card>
  );
}

function TcmEditor({ items, onChange }: { items: { id: string; name: string; phone: string; zoneId: string }[]; onChange: (v: { id: string; name: string; phone: string; zoneId: string }[]) => void }) {
  const [d, setD] = useState({ name: "", phone: "", zoneId: "" });
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-sm font-medium">Custom TCMs / coordinators</div>
      {items.map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-sm border-b py-1">
          <span className="flex-1">{p.name} <span className="text-muted-foreground">· {p.phone} · zone {p.zoneId}</span></span>
          <button onClick={() => onChange(items.filter((x) => x.id !== p.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <Input placeholder="Phone" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        <Input placeholder="Zone id" value={d.zoneId} onChange={(e) => setD({ ...d, zoneId: e.target.value })} />
      </div>
      <Button size="sm" onClick={() => { if (!d.name) return; onChange([...items, { id: `tcm${Date.now()}`, ...d }]); setD({ name: "", phone: "", zoneId: "" }); }}>
        <Plus className="h-4 w-4 mr-1" /> Add TCM
      </Button>
    </CardContent></Card>
  );
}

function CustomFieldsEditor({ fields, onChange }: { fields: CustomField[]; onChange: (v: CustomField[]) => void }) {
  const [d, setD] = useState<CustomField>({ id: "", label: "", type: "text", appliesTo: "tour" });
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-sm font-medium">Custom fields</div>
      {fields.map((f) => (
        <div key={f.id} className="flex items-center gap-2 text-sm border-b py-1">
          <span className="flex-1">{f.label} <span className="text-muted-foreground">· {f.type} · {f.appliesTo}</span></span>
          <button onClick={() => onChange(fields.filter((x) => x.id !== f.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="grid grid-cols-4 gap-2">
        <Input placeholder="Label" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
        <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as CustomField["type"] })} className="h-10 bg-background border rounded px-2 text-sm">
          <option value="text">text</option><option value="number">number</option><option value="select">select</option><option value="boolean">boolean</option>
        </select>
        <select value={d.appliesTo} onChange={(e) => setD({ ...d, appliesTo: e.target.value as CustomField["appliesTo"] })} className="h-10 bg-background border rounded px-2 text-sm">
          <option value="tour">tour</option><option value="property">property</option><option value="lead">lead</option>
        </select>
        <Button size="sm" onClick={() => { if (!d.label) return; onChange([...fields, { ...d, id: `f${Date.now()}` }]); setD({ id: "", label: "", type: "text", appliesTo: "tour" }); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </CardContent></Card>
  );
}

function TargetsEditor({ targets, onChange }: { targets: CustomTarget[]; onChange: (v: CustomTarget[]) => void }) {
  const [d, setD] = useState<CustomTarget>({ id: "", label: "", metric: "tours", scope: "global", value: 100, period: "week" });
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-sm font-medium">Custom targets</div>
      {targets.map((t) => (
        <div key={t.id} className="flex items-center gap-2 text-sm border-b py-1">
          <span className="flex-1">{t.label}: {t.value} {t.metric}/{t.period} <span className="text-muted-foreground">· scope {t.scope}{t.scopeId ? ":" + t.scopeId : ""}</span></span>
          <button onClick={() => onChange(targets.filter((x) => x.id !== t.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Input placeholder="Label" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
        <select value={d.metric} onChange={(e) => setD({ ...d, metric: e.target.value as CustomTarget["metric"] })} className="h-10 bg-background border rounded px-2 text-sm">
          <option value="tours">tours</option><option value="showups">showups</option><option value="bookings">bookings</option><option value="score">score</option>
        </select>
        <select value={d.scope} onChange={(e) => setD({ ...d, scope: e.target.value as CustomTarget["scope"] })} className="h-10 bg-background border rounded px-2 text-sm">
          <option value="global">global</option><option value="tcm">tcm</option><option value="zone">zone</option><option value="property">property</option>
        </select>
        <Input placeholder="Scope id (optional)" value={d.scopeId ?? ""} onChange={(e) => setD({ ...d, scopeId: e.target.value })} />
        <Input type="number" value={d.value} onChange={(e) => setD({ ...d, value: parseInt(e.target.value, 10) || 0 })} />
        <select value={d.period} onChange={(e) => setD({ ...d, period: e.target.value as CustomTarget["period"] })} className="h-10 bg-background border rounded px-2 text-sm">
          <option value="day">day</option><option value="week">week</option><option value="month">month</option>
        </select>
      </div>
      <Button size="sm" onClick={() => { if (!d.label) return; onChange([...targets, { ...d, id: `tg${Date.now()}` }]); setD({ id: "", label: "", metric: "tours", scope: "global", value: 100, period: "week" }); }}>
        <Plus className="h-4 w-4 mr-1" /> Add target
      </Button>
    </CardContent></Card>
  );
}

