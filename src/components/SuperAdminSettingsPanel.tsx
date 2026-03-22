"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, KeyRound, Loader2, Pencil } from 'lucide-react';
import { LoginActivityTab, LeadActivityTab } from '@/components/ActivityTabs';

interface ZoneOption {
  id: string;
  name: string;
}

interface Manager {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  admins: Admin[];
  createdAt: string;
}

interface Admin {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  zones: string[];
  role: string;
  members: Member[];
}

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  zones: string[];
  adminId?: any;
}

export function SuperAdminSettingsPanel() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [members, setAgents] = useState<Member[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'managers' | 'admins' | 'members' | 'login_activity' | 'lead_activity'>('managers');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [managersRes, adminsRes, agentsRes] = await Promise.all([
        fetch('/api/managers'),
        fetch('/api/admins'),
        fetch('/api/members'),
      ]);

      if (managersRes.ok) setManagers(await managersRes.json());
      if (adminsRes.ok) setAdmins(await adminsRes.json());
      if (agentsRes.ok) setAgents(await agentsRes.json());

      const zonesRes = await fetch('/api/zones');
      if (zonesRes.ok) {
        const rawZones = await zonesRes.json();
        const zoneOptions = (rawZones || []).map((z: any) => ({
          id: z.id || z._id,
          name: z.name,
        }));
        setZones(zoneOptions);
      }
    } catch (err: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto pb-1 scrollbar-hide">
        {[
          { id: 'managers', label: 'Managers' },
          { id: 'admins', label: 'Admins' },
          { id: 'members', label: 'Members' },
          { id: 'login_activity', label: 'Login Activity' },
          { id: 'lead_activity', label: 'Lead Activity' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'managers' && <ManagersSection managers={managers} onRefresh={loadData} />}
          {activeTab === 'admins' && <AdminsSection admins={admins} zones={zones} onRefresh={loadData} />}
          {activeTab === 'members' && <AgentsSection members={members} admins={admins} zones={zones} onRefresh={loadData} />}
          {activeTab === 'login_activity' && <LoginActivityTab />}
          {activeTab === 'lead_activity' && <LeadActivityTab />}
        </>
      )}
    </div>
  );
}

function ManagersSection({ managers, onRefresh }: { managers: Manager[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  });
  const [allAdmins, setAllAdmins] = useState<Admin[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
  });
  const [editAdminIds, setEditAdminIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchAllAdmins = async () => {
      try {
        const res = await fetch('/api/admins');
        if (res.ok) setAllAdmins(await res.json());
      } catch (err) {
        console.error('Failed to load admins');
      }
    };
    fetchAllAdmins();
  }, []);

  const handleAddManager = async () => {
    if (!form.fullName || !form.email || !form.phone || !form.username || !form.password) {
      toast.error('All fields are required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          adminIds: selectedAdmins,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);

      toast.success('Manager created successfully');
      setShowForm(false);
      setForm({ fullName: '', email: '', phone: '', username: '', password: '' });
      setSelectedAdmins([]);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteManager = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const res = await fetch(`/api/managers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Manager deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    const password = prompt(`Enter new password for ${name}:`);
    if (!password) return;

    try {
      const res = await fetch(`/api/managers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Password updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditManager = (manager: Manager) => {
    setEditingId(manager.id);
    setEditForm({
      fullName: manager.fullName || '',
      email: manager.email || '',
      phone: manager.phone || '',
      username: manager.username || '',
    });
    setEditAdminIds((manager.admins || []).map((admin) => admin.id));
  };

  const handleUpdateManager = async () => {
    if (!editingId) return;
    if (!editForm.fullName || !editForm.email || !editForm.phone || !editForm.username) {
      toast.error('All fields are required');
      return;
    }

    try {
      setUpdating(true);
      const res = await fetch(`/api/managers/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          username: editForm.username.trim(),
          adminIds: editAdminIds,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Manager updated');
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Manager Form */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-secondary/30">
          <h3 className="font-semibold mb-4">Add New Manager</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Manager name"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="manager@example.com"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Phone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91..."
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Username *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="manager@gharpayy"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Initial password"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Select Admins</Label>
              <Select
                value={selectedAdmins[0] || ''}
                onValueChange={(value) => {
                  if (!selectedAdmins.includes(value)) {
                    setSelectedAdmins([...selectedAdmins, value]);
                  }
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select admins..." />
                </SelectTrigger>
                <SelectContent>
                  {allAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedAdmins.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-2">Selected Admins:</p>
              <div className="flex flex-wrap gap-2">
                {selectedAdmins.map((adminId) => {
                  const admin = allAdmins.find((a) => a.id === adminId);
                  return (
                    <div
                      key={adminId}
                      className="bg-accent/20 text-accent px-2 py-1 rounded text-xs flex items-center gap-1"
                    >
                      {admin?.fullName}
                      <button
                        onClick={() =>
                          setSelectedAdmins(selectedAdmins.filter((id) => id !== adminId))
                        }
                        className="hover:text-accent/70"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleAddManager} disabled={saving}>
              <Plus size={14} className="mr-1" />
              {saving ? 'Creating...' : 'Create Manager'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setSelectedAdmins([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1" /> Add Manager
        </Button>
      )}

      {/* Managers List */}
      <div className="space-y-3">
        {managers.map((manager) => (
          <div key={manager.id} className="border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{manager.fullName}</h4>
                <p className="text-xs text-muted-foreground">Email: {manager.email}</p>
                <p className="text-xs text-muted-foreground">Phone: {manager.phone}</p>
                <p className="text-xs text-muted-foreground">Username: {manager.username}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEditManager(manager)}>
                  <Pencil size={12} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResetPassword(manager.id, manager.fullName)}>
                  <KeyRound size={12} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteManager(manager.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>

            {manager.admins.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Assigned Admins ({manager.admins.length})</p>
                {manager.admins.map((admin) => (
                  <div key={admin.id} className="bg-secondary/50 p-2 rounded text-xs">
                    <p className="font-medium">{admin.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">Zones: {admin.zones.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}

            {editingId === manager.id && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <h5 className="text-xs font-semibold">Edit Manager</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Full Name *</Label>
                    <Input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone *</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Username *</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Assign Admins</Label>
                  {allAdmins.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {allAdmins.map((admin) => (
                        <label key={admin.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editAdminIds.includes(admin.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAdminIds([...editAdminIds, admin.id]);
                              } else {
                                setEditAdminIds(editAdminIds.filter((id) => id !== admin.id));
                              }
                            }}
                            className="rounded"
                          />
                          {admin.fullName}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">No admins available.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdateManager} disabled={updating}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {managers.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No managers created yet</p>}
      </div>
    </div>
  );
}

function AdminsSection({ admins, zones, onRefresh }: { admins: Admin[]; zones: ZoneOption[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
  });
  const [editZones, setEditZones] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  const handleAddAdmin = async () => {
    if (!form.fullName || !form.email || !form.phone || !form.username || !form.password || selectedZones.length === 0) {
      toast.error('All fields and at least one zone are required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          zones: selectedZones,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);

      toast.success('Admin created successfully');
      setShowForm(false);
      setForm({ fullName: '', email: '', phone: '', username: '', password: '' });
      setSelectedZones([]);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Admin deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    const password = prompt(`Enter new password for ${name}:`);
    if (!password) return;

    try {
      const res = await fetch(`/api/admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Password updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditAdmin = (admin: Admin) => {
    setEditingId(admin.id);
    setEditForm({
      fullName: admin.fullName || '',
      email: admin.email || '',
      phone: admin.phone || '',
      username: admin.username || '',
    });
    setEditZones(admin.zones || []);
  };

  const handleUpdateAdmin = async () => {
    if (!editingId) return;
    if (!editForm.fullName || !editForm.email || !editForm.phone || !editForm.username) {
      toast.error('All fields are required');
      return;
    }
    if (editZones.length === 0) {
      toast.error('At least one zone is required');
      return;
    }

    try {
      setUpdating(true);
      const res = await fetch(`/api/admins/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          username: editForm.username.trim(),
          zones: editZones,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Admin updated');
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Admin Form */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-secondary/30">
          <h3 className="font-semibold mb-4">Add New Admin</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Admin name"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@example.com"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Phone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91..."
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Username *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin@gharpayy"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Initial password"
                className="text-xs"
              />
            </div>
          </div>

          {/* Zone Selection */}
          <div className="mt-4">
            <Label className="text-xs">Select Zones *</Label>
            {zones.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {zones.map((zone) => (
                  <label key={zone.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedZones.includes(zone.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZones([...selectedZones, zone.name]);
                        } else {
                          setSelectedZones(selectedZones.filter((z) => z !== zone.name));
                        }
                      }}
                      className="rounded"
                    />
                    {zone.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No zones available.</p>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleAddAdmin} disabled={saving || zones.length === 0}>
              <Plus size={14} className="mr-1" />
              {saving ? 'Creating...' : 'Create Admin'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setSelectedZones([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1" /> Add Admin
        </Button>
      )}

      {/* Admins List */}
      <div className="space-y-3">
        {admins.map((admin) => (
          <div key={admin.id} className="border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{admin.fullName}</h4>
                <p className="text-xs text-muted-foreground">Email: {admin.email}</p>
                <p className="text-xs text-muted-foreground">Phone: {admin.phone}</p>
                <p className="text-xs text-muted-foreground">Username: {admin.username}</p>
                <p className="text-xs text-muted-foreground">Zones: {admin.zones.join(', ')}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEditAdmin(admin)}>
                  <Pencil size={12} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResetPassword(admin.id, admin.fullName)}>
                  <KeyRound size={12} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteAdmin(admin.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>

            {admin.members && admin.members.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Assigned Members ({admin.members.length})</p>
                {admin.members.map((member) => (
                  <div key={member.id} className="bg-secondary/50 p-2 rounded text-xs">
                    <p className="font-medium">{member.name}</p>
                    <p className="text-[11px] text-muted-foreground">Zones: {member.zones.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}

            {editingId === admin.id && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <h5 className="text-xs font-semibold">Edit Admin</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Full Name *</Label>
                    <Input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone *</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Username *</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Select Zones *</Label>
                  {zones.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {zones.map((zone) => (
                        <label key={zone.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editZones.includes(zone.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditZones([...editZones, zone.name]);
                              } else {
                                setEditZones(editZones.filter((z) => z !== zone.name));
                              }
                            }}
                            className="rounded"
                          />
                          {zone.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">No zones available.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdateAdmin} disabled={updating}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {admins.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No admins created yet</p>}
      </div>
    </div>
  );
}

function AgentsSection({ members, admins, zones, onRefresh }: { members: Member[]; admins: Admin[]; zones: ZoneOption[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
  });
  const [editZones, setEditZones] = useState<string[]>([]);
  const [editAdminId, setEditAdminId] = useState<string>('__none__');
  const [updating, setUpdating] = useState(false);

  const handleAddAgent = async () => {
    if (!form.fullName || !form.email || !form.phone || !form.username || !form.password || selectedZones.length === 0) {
      toast.error('All fields and at least one zone are required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          zones: selectedZones,
          adminId: selectedAdmin || undefined,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);

      toast.success('Member created successfully');
      setShowForm(false);
      setForm({ fullName: '', email: '', phone: '', username: '', password: '' });
      setSelectedZones([]);
      setSelectedAdmin('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Member deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    const password = prompt(`Enter new password for ${name}:`);
    if (!password) return;

    try {
      const res = await fetch(`/api/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Password updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditAgent = (member: Member) => {
    setEditingId(member.id);
    setEditForm({
      fullName: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      username: member.username || '',
    });
    setEditZones(member.zones || []);
    const currentAdminId = typeof member.adminId === 'string' ? member.adminId : member.adminId?._id;
    setEditAdminId(currentAdminId || '__none__');
  };

  const handleUpdateAgent = async () => {
    if (!editingId) return;
    if (!editForm.fullName || !editForm.email || !editForm.phone || !editForm.username) {
      toast.error('All fields are required');
      return;
    }
    if (editZones.length === 0) {
      toast.error('At least one zone is required');
      return;
    }

    try {
      setUpdating(true);
      const res = await fetch(`/api/members/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          username: editForm.username.trim(),
          zones: editZones,
          adminId: editAdminId === '__none__' ? null : editAdminId,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Member updated');
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Member Form */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-secondary/30">
          <h3 className="font-semibold mb-4">Add New Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Member name"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="member@example.com"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Phone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91..."
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Username *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="member@gharpayy"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Initial password"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Assign Admin (Optional)</Label>
              <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select an admin..." />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Zone Selection */}
          <div className="mt-4">
            <Label className="text-xs">Select Zones *</Label>
            {zones.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {zones.map((zone) => (
                  <label key={zone.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedZones.includes(zone.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZones([...selectedZones, zone.name]);
                        } else {
                          setSelectedZones(selectedZones.filter((z) => z !== zone.name));
                        }
                      }}
                      className="rounded"
                    />
                    {zone.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No zones available.</p>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleAddAgent} disabled={saving || zones.length === 0}>
              <Plus size={14} className="mr-1" />
              {saving ? 'Creating...' : 'Create Member'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setSelectedZones([]);
                setSelectedAdmin('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1" /> Add Member
        </Button>
      )}

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold">{member.name}</h4>
                <p className="text-xs text-muted-foreground">Email: {member.email}</p>
                <p className="text-xs text-muted-foreground">Phone: {member.phone}</p>
                <p className="text-xs text-muted-foreground">Username: {member.username}</p>
                <p className="text-xs text-muted-foreground">Zones: {member.zones.join(', ')}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEditAgent(member)}>
                  <Pencil size={12} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResetPassword(member.id, member.name)}>
                  <KeyRound size={12} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteAgent(member.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>

            {editingId === member.id && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <h5 className="text-xs font-semibold">Edit Member</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Full Name *</Label>
                    <Input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone *</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Username *</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Assign Admin (Optional)</Label>
                    <Select value={editAdminId} onValueChange={setEditAdminId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select an admin..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {admins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Select Zones *</Label>
                  {zones.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {zones.map((zone) => (
                        <label key={zone.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editZones.includes(zone.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditZones([...editZones, zone.name]);
                              } else {
                                setEditZones(editZones.filter((z) => z !== zone.name));
                              }
                            }}
                            className="rounded"
                          />
                          {zone.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">No zones available.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdateAgent} disabled={updating}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No members created yet</p>}
      </div>
    </div>
  );
}
