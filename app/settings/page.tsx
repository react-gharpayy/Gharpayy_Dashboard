"use client";

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgents, useProperties, useCreateAgent, useUpdateAgent, useDeleteAgent, useCreateProperty, useDeleteProperty } from '@/hooks/useCrmData';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminSettingsPanel } from '@/components/SuperAdminSettingsPanel';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { KeyRound, Plus, Trash2, UserCog, Building2, User, Save, Activity } from 'lucide-react';
import { LoginActivityTab, LeadActivityTab } from '@/components/ActivityTabs';

const SettingsPage = () => {
  const { user } = useAuth();
  const { data: members } = useAgents();
  const { data: properties } = useProperties();
  const isCEO = user?.role === 'super_admin';
  const isManager = user?.role === 'manager';

  if (isCEO) {
    return (
      <AppLayout title="Settings" subtitle="Super Admin Control Panel" showQuickAddLead={false}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">Manage Organization</h2>
            <SuperAdminSettingsPanel />
          </div>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" subtitle="System configuration" showQuickAddLead={false}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        <Tabs defaultValue={isManager ? 'admins' : 'team'} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 w-full max-w-full bg-transparent p-0">
            {isManager ? (
              <TabsTrigger value="admins" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><UserCog size={13} /> Admins</TabsTrigger>
            ) : (
              <TabsTrigger value="team" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><UserCog size={13} /> Team</TabsTrigger>
            )}
            <TabsTrigger value="properties" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><Building2 size={13} /> Properties</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><User size={13} /> Profile</TabsTrigger>
            <TabsTrigger value="loginActivity" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><Activity size={13} /> Login Activity</TabsTrigger>
            <TabsTrigger value="leadActivity" className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><Activity size={13} /> Lead Activity</TabsTrigger>
          </TabsList>

          {!isManager && (
            <TabsContent value="team">
              <TeamTab members={members || []} />
            </TabsContent>
          )}
          {isManager && (
            <TabsContent value="admins">
              <AdminsTab />
            </TabsContent>
          )}
          <TabsContent value="properties">
            <PropertiesTab properties={properties || []} />
          </TabsContent>
          <TabsContent value="profile">
            <ProfileTab user={user || {}} />
          </TabsContent>
          <TabsContent value="loginActivity">
            <LoginActivityTab />
          </TabsContent>
          <TabsContent value="leadActivity">
            <LeadActivityTab />
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

function AdminsTab() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admins');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load admins');
      setAdmins(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4">Admin List</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading admins...</p>
        ) : (
          <div className="space-y-3">
            {admins.map((admin) => (
              <div key={admin.id} className="rounded-xl bg-secondary/50 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Admin Details</p>
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Name:</span> {admin.fullName}</p>
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Email:</span> {admin.email}</p>
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Phone:</span> {admin.phone || 'No phone'}</p>
                  </div>
                </div>
              </div>
            ))}
            {admins.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No admins found</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamTab({ members }: { members: any[] }) {
  const { user, loading, checkUser } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.username?.endsWith('admin@gharpayy');
  const updateAgent = useUpdateAgent();

  useEffect(() => {
    if (!user && !loading) {
      checkUser();
    }
  }, [user, loading, checkUser]);

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4">Team Members</h3>
        <div className="space-y-2">
          {members.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-secondary/50">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Member Details</p>
                <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Name:</span> {a.name}</p>
                <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Email:</span> {a.email || 'No email'}</p>
                <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Phone:</span> {a.phone || 'No phone'}</p>
                <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Zone:</span> {a.zones?.join(', ') || 'NA'}</p>
              </div>
            </div>
          ))}
          {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No members yet</p>}
        </div>
      </div>
    </div>
  );
}

function PropertiesTab({ properties }: { properties: any[] }) {
  const [form, setForm] = useState({ name: '', city: '', area: '', price_range: '', address: '' });
  const createProperty = useCreateProperty();
  const deleteProperty = useDeleteProperty();

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      await createProperty.mutateAsync(form);
      toast.success('Property added');
      setForm({ name: '', city: '', area: '', price_range: '', address: '' });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!confirm('Are you sure?')) return;
      await deleteProperty.mutateAsync(id);
      toast.success('Property removed');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4">Add Property</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px]">Name *</Label>
            <Input placeholder="Property name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px]">City</Label>
            <Input placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px]">Area</Label>
            <Input placeholder="Area" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px]">Price Range</Label>
            <Input placeholder="₹50L - 80L" value={form.price_range} onChange={e => setForm(f => ({ ...f, price_range: e.target.value }))} className="text-xs" />
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={createProperty.isPending} className="mt-3 gap-1.5 text-xs">
          <Plus size={12} /> {createProperty.isPending ? 'Adding...' : 'Add Property'}
        </Button>
      </div>

      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4">Properties</h3>
        <div className="space-y-2">
          {properties.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
              <div>
                <p className="text-xs font-medium text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{[p.area, p.city].filter(Boolean).join(', ')} {(p as any).price_range ? `· ${(p as any).price_range}` : ''}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
          {properties.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No properties yet</p>}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user }: { user: any }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Stub for profile update using fetch
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Profile updated (simulated)');
      setPassword('');
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="kpi-card max-w-md">
      <h3 className="font-display font-semibold text-xs mb-4">Your Profile</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[10px]">Email</Label>
          <Input value={user?.email || ''} disabled className="text-xs bg-secondary" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px]">Full Name</Label>
          <Input placeholder="Update your name" value={name} onChange={e => setName(e.target.value)} className="text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px]">New Password</Label>
          <Input type="password" placeholder="Leave blank to keep current" value={password} onChange={e => setPassword(e.target.value)} className="text-xs" />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
          <Save size={12} /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

export default SettingsPage;

