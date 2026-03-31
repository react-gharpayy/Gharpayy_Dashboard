"use client";

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgents } from '@/hooks/useCrmData';
import { useAuth } from '@/contexts/AuthContext';
import { SuperAdminSettingsPanel } from '@/components/SuperAdminSettingsPanel';

import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { KeyRound, UserCog, User, Save } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const { data: members } = useAgents();
  const isCEO = user?.role === 'super_admin';
  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';

  if (isCEO) {
    return (
      <AppLayout title="Settings" subtitle="Super Admin Control Panel">
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
    <AppLayout title="Settings" subtitle="System configuration">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        <Tabs defaultValue={isManager ? 'admins' : isAdmin ? 'members' : 'profile'} className="space-y-6">
          <TabsList className="flex flex-nowrap justify-start h-auto gap-2 w-full max-w-full overflow-x-auto bg-transparent p-0 pb-1">
            {isManager && (
              <TabsTrigger value="admins" className="shrink-0 text-[11px] sm:text-xs px-2.5 sm:px-3 gap-1.5 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><UserCog size={13} /> Admins</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="members" className="shrink-0 text-[11px] sm:text-xs px-2.5 sm:px-3 gap-1.5 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><UserCog size={13} /> Members</TabsTrigger>
            )}
            {!isManager && !isAdmin && !isMember && (
              <TabsTrigger value="team" className="shrink-0 text-[11px] sm:text-xs px-2.5 sm:px-3 gap-1.5 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><UserCog size={13} /> Team</TabsTrigger>
            )}
            <TabsTrigger value="profile" className="shrink-0 text-[11px] sm:text-xs px-2.5 sm:px-3 gap-1.5 whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary border bg-background"><User size={13} /> Profile</TabsTrigger>

          </TabsList>

          {!isManager && !isAdmin && !isMember && (
            <TabsContent value="team">
              <TeamTab members={members || []} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="members">
              <TeamTab members={members || []} title="Members" emptyLabel="No members in matching zones" />
            </TabsContent>
          )}
          {isManager && (
            <TabsContent value="admins">
              <AdminsTab />
            </TabsContent>
          )}

          <TabsContent value="profile">
            <ProfileTab user={user || {}} />
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

function TeamTab({ members, title = 'Team Members', emptyLabel = 'No members yet' }: { members: any[]; title?: string; emptyLabel?: string }) {

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4">{title}</h3>
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
          {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">{emptyLabel}</p>}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user }: { user: any }) {
  const [profileUser, setProfileUser] = useState<any>(user || {});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (data?.user) {
          setProfileUser(data.user);
          return;
        }
      } catch {}
      setProfileUser(user || {});
    };

    loadProfile();
  }, [user]);

  const effectiveUser = profileUser || user || {};
  const effectiveZones = Array.isArray(effectiveUser?.zones) && effectiveUser.zones.length > 0
    ? effectiveUser.zones
    : (effectiveUser?.zoneName ? [effectiveUser.zoneName] : []);

  const handleSave = async () => {
    if (!password) {
      toast.error('Please enter a new password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');
      toast.success('Password updated successfully');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="kpi-card max-w-lg">
      <h3 className="font-display font-semibold text-xs mb-4">Your Profile</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[10px]">Full Name</Label>
          <Input value={effectiveUser?.fullName || ''} disabled className="text-xs bg-secondary" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px]">Email</Label>
          <Input value={effectiveUser?.email || ''} disabled className="text-xs bg-secondary" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px]">Phone</Label>
          <Input value={effectiveUser?.phone || 'N/A'} disabled className="text-xs bg-secondary" />
        </div>
        {(effectiveUser?.role === 'admin' || effectiveUser?.role === 'member') && (
          <div className="space-y-1.5">
            <Label className="text-[10px]">Zones</Label>
            <Input value={effectiveZones.length > 0 ? effectiveZones.join(', ') : 'N/A'} disabled className="text-xs bg-secondary" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-[10px]">New Password</Label>
          <Input type="password" placeholder="Enter new password" value={password} onChange={e => setPassword(e.target.value)} className="text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px]">Confirm New Password</Label>
          <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="text-xs" />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
          <Save size={12} /> {saving ? 'Updating...' : 'Change Password'}
        </Button>
      </div>
    </div>
  );
}

export default SettingsPage;

