"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, Loader2, MoreVertical, UserPlus, Users, Shield, User, ChevronRight, KeyRound, Pencil, MapPin, Eye, EyeOff, Trophy, Link2, Copy, RefreshCcw } from 'lucide-react';
import { LoginActivityTab, LeadActivityTab } from '@/components/ActivityTabs';
import { useAuth } from '@/contexts/AuthContext';

/* ========== Types ========== */
interface UserItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  role: string;
  status: string;
  zones: string[];
  adminId?: any;
  managerId?: any;
  invitedAt?: string;
  deletedAt?: string;
  createdAt: string;
}

interface RoleUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  role: string;
  status?: string;
  zones: string[];
  admins?: RoleUser[];
  members?: RoleUser[];
  adminIds?: any[];
  managerId?: any;
}

interface ZoneOption {
  id: string;
  name: string;
}

/* ========== Main Panel ========== */
export function SuperAdminSettingsPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'profiles' | 'activity' | 'leaderboard' | 'integration'>('users');

  return (
    <div className="space-y-6">
      {/* Top-level Tabs */}
      <div className="flex flex-nowrap gap-1 border-b overflow-x-auto pb-1">
        {[
          { id: 'users', label: 'Users', icon: Users },
          { id: 'roles', label: 'Roles', icon: Shield },
          { id: 'profiles', label: 'Profiles', icon: User },
          { id: 'activity', label: 'Activity', icon: KeyRound },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'integration', label: 'Integration', icon: Link2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 font-medium text-[11px] sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'profiles' && <ProfilesTab />}
      {activeTab === 'activity' && <ActivityTab />}
      {activeTab === 'integration' && <IntegrationTab />}
    </div>
  );
}

/* ========== USERS TAB ========== */
function UsersTab() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'active' | 'inactive' | 'deleted'>('active');
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [managers, setManagers] = useState<RoleUser[]>([]);
  const [admins, setAdmins] = useState<RoleUser[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadSupportData = async () => {
    try {
      const [mRes, aRes, zRes] = await Promise.all([
        fetch('/api/managers'),
        fetch('/api/admins'),
        fetch('/api/zones'),
      ]);
      if (mRes.ok) setManagers(await mRes.json());
      if (aRes.ok) setAdmins(await aRes.json());
      if (zRes.ok) {
        const raw = await zRes.json();
        setZones((raw || []).map((z: any) => ({ id: z.id || z._id, name: z.name })));
      }
    } catch {
      console.error('Failed to load support data');
    }
  };

  useEffect(() => {
    loadUsers();
    loadSupportData();
  }, []);

  const filteredUsers = users.filter((u) => (u.status || 'active') === subTab);

  const handleStatusChange = async (userId: string, action: 'activate' | 'deactivate' | 'delete') => {
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`User ${action}d successfully`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const statusCounts = {
    active: users.filter((u) => (u.status || 'active') === 'active').length,
    inactive: users.filter((u) => u.status === 'inactive').length,
    deleted: users.filter((u) => u.status === 'deleted').length,
  };

  return (
    <div className="space-y-4">
      {/* Add User Button + Sub-tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {(['active', 'inactive', 'deleted'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize flex items-center gap-1.5 ${
                subTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {statusCounts[tab] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  subTab === tab ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
                }`}>
                  {statusCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus size={14} /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <AddUserForm
              managers={managers}
              admins={admins}
              zones={zones}
              onSuccess={() => {
                setShowAddUserDialog(false);
                loadUsers();
                loadSupportData();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-card border hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-accent font-semibold text-sm">
                    {user.fullName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{user.fullName}</p>
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                      {user.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {user.phone && <p className="text-[11px] text-muted-foreground">{user.phone}</p>}
                </div>
              </div>

              {/* 3-dot menu */}
              {subTab !== 'deleted' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {subTab === 'active' && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(user.id, 'deactivate')}
                          className="text-yellow-600"
                        >
                          Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(user.id, 'delete')}
                          className="text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                    {subTab === 'inactive' && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(user.id, 'activate')}
                          className="text-green-600"
                        >
                          Activate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(user.id, 'delete')}
                          className="text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">
              No {subTab} users
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== ADD USER FORM ========== */
function AddUserForm({
  managers,
  admins,
  zones,
  onSuccess,
}: {
  managers: RoleUser[];
  admins: RoleUser[];
  zones: ZoneOption[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: '',
  });
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.phone || !form.role || !form.password) {
      toast.error('All fields are required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          zones: selectedZones,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('User added successfully.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Full Name *</Label>
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="John Doe"
            className="text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email *</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="john@example.com"
            className="text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone *</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91..."
            className="text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Password *</Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Initial password"
              className="text-xs pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Role *</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="Select role..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zone Selection for Admin and Member */}
      {(form.role === 'admin' || form.role === 'member') && zones.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <MapPin size={12} />
            Assign Zones *
          </Label>
          <div className="grid grid-cols-2 gap-2">
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
        </div>
      )}

      <Button onClick={handleSubmit} disabled={saving} className="w-full gap-1.5">
        <UserPlus size={14} />
        {saving ? 'Adding User...' : 'Add User'}
      </Button>
    </div>
  );
}

/* ========== ROLES TAB ========== */
function RolesTab() {
  const [roleTab, setRoleTab] = useState<'managers' | 'admins' | 'members'>('managers');
  const [managers, setManagers] = useState<RoleUser[]>([]);
  const [admins, setAdmins] = useState<RoleUser[]>([]);
  const [members, setMembers] = useState<RoleUser[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '' });
  const [updating, setUpdating] = useState(false);

  const isRoleVisibleUser = (u: any) => {
    const s = (u?.status || 'active').toLowerCase();
    return s === 'active' || s === 'inactive';
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, aRes, memRes, zRes] = await Promise.all([
        fetch('/api/managers'),
        fetch('/api/admins'),
        fetch('/api/members'),
        fetch('/api/zones'),
      ]);
      if (mRes.ok) {
        const data = await mRes.json();
        setManagers((data || []).filter(isRoleVisibleUser));
      }
      if (aRes.ok) {
        const data = await aRes.json();
        setAdmins((data || []).filter(isRoleVisibleUser));
      }
      if (memRes.ok) {
        const data = await memRes.json();
        setMembers((data || []).filter(isRoleVisibleUser));
      }
      if (zRes.ok) {
        const raw = await zRes.json();
        setZones((raw || []).map((z: any) => ({ id: z.id || z._id, name: z.name })));
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({
      fullName: user.fullName || user.name || '',
      email: user.email || '',
      phone: user.phone || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      setUpdating(true);
      const res = await fetch(`/api/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Updated successfully');
      setEditingId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    const password = prompt(`Enter new password for ${name}:`);
    if (!password) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
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

  return (
    <div className="space-y-4">
      {/* Role sub-tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {(['managers', 'admins', 'members'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setRoleTab(tab); setExpandedId(null); setEditingId(null); }}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              roleTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Managers */}
          {roleTab === 'managers' && managers.map((manager) => (
            <div key={manager.id} className="border rounded-xl bg-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === manager.id ? null : manager.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="text-blue-500 font-semibold text-sm">
                      {manager.fullName?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{manager.fullName}</p>
                    <p className="text-xs text-muted-foreground">{manager.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {manager.admins?.length || 0} Admins
                  </Badge>
                  <ChevronRight size={16} className={`transform transition-transform ${expandedId === manager.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {expandedId === manager.id && (
                <div className="border-t p-4 space-y-4 bg-secondary/10">
                  {/* Manager Details */}
                  {editingId === manager.id ? (
                    <EditForm form={editForm} setForm={setEditForm} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} saving={updating} />
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground">{manager.phone || 'N/A'}</span></p>
                        <p className="text-xs text-muted-foreground">Username: <span className="text-foreground">{manager.username}</span></p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(manager)}><Pencil size={12} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(manager.id, manager.fullName)}><KeyRound size={12} /></Button>
                      </div>
                    </div>
                  )}

                  {/* Admins under this manager */}
                  {manager.admins && manager.admins.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Admins under {manager.fullName}</p>
                      {manager.admins.map((admin) => (
                        <div key={admin.id} className="bg-background rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium">{admin.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">{admin.email}</p>
                            {admin.zones && admin.zones.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin size={10} className="text-muted-foreground" />
                                <p className="text-[10px] text-muted-foreground">{admin.zones.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Admins */}
          {roleTab === 'admins' && admins.map((admin) => (
            <div key={admin.id} className="border rounded-xl bg-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === admin.id ? null : admin.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <span className="text-green-500 font-semibold text-sm">
                      {admin.fullName?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{admin.fullName}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                </div>
              <div className="flex items-center gap-2">
                  {admin.zones && admin.zones.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{admin.zones.length} Zones</Badge>
                  )}
                  {(() => {
                    const matchingMembers = members.filter(m => 
                      m.zones && admin.zones && m.zones.some(mz => admin.zones!.includes(mz))
                    );
                    return (
                      <Badge variant="secondary" className="text-[10px]">
                        {matchingMembers.length} Members
                      </Badge>
                    );
                  })()}
                  <ChevronRight size={16} className={`transform transition-transform ${expandedId === admin.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {expandedId === admin.id && (
                <div className="border-t p-4 space-y-4 bg-secondary/10">
                  {editingId === admin.id ? (
                    <EditForm form={editForm} setForm={setEditForm} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} saving={updating} />
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground">{admin.phone || 'N/A'}</span></p>
                        <p className="text-xs text-muted-foreground">Username: <span className="text-foreground">{admin.username}</span></p>
                        <p className="text-xs text-muted-foreground">Zones: <span className="text-foreground">{admin.zones?.join(', ') || 'None'}</span></p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(admin)}><Pencil size={12} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(admin.id, admin.fullName)}><KeyRound size={12} /></Button>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const matchingMembers = members.filter(m => 
                      m.zones && admin.zones && m.zones.some(mz => admin.zones!.includes(mz))
                    );
                    return (
                      <>
                        {matchingMembers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Members</p>
                            {matchingMembers.map((member) => (
                              <div key={member.id} className="bg-background rounded-lg p-3 flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-medium">{member.fullName || (member as any).name}</p>
                                  <p className="text-[11px] text-muted-foreground">{member.email}</p>
                                  {member.zones && member.zones.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <MapPin size={10} className="text-muted-foreground" />
                                      <p className="text-[10px] text-muted-foreground">{member.zones.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {matchingMembers.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No members in matching zones</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}

          {/* Members */}
          {roleTab === 'members' && members.map((member) => (
            <div key={member.id} className="border rounded-xl bg-card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <span className="text-purple-500 font-semibold text-sm">
                      {(member.fullName || (member as any).name)?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{member.fullName || (member as any).name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.zones && member.zones.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{member.zones.join(', ')}</Badge>
                  )}
                  <ChevronRight size={16} className={`transform transition-transform ${expandedId === member.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {expandedId === member.id && (
                <div className="border-t p-4 space-y-4 bg-secondary/10">
                  {editingId === member.id ? (
                    <EditForm form={editForm} setForm={setEditForm} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} saving={updating} />
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground">{member.phone || 'N/A'}</span></p>
                        <p className="text-xs text-muted-foreground">Username: <span className="text-foreground">{member.username}</span></p>
                        <p className="text-xs text-muted-foreground">Zones: <span className="text-foreground">{member.zones?.join(', ') || 'None'}</span></p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleStartEdit(member)}><Pencil size={12} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(member.id, member.fullName || (member as any).name)}><KeyRound size={12} /></Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Empty states */}
          {roleTab === 'managers' && managers.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No managers yet</p>}
          {roleTab === 'admins' && admins.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No admins yet</p>}
          {roleTab === 'members' && members.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No members yet</p>}
        </div>
      )}
    </div>
  );
}

/* ========== EDIT FORM (inline) ========== */
function EditForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
}: {
  form: { fullName: string; email: string; phone: string };
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Full Name</Label>
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="text-xs" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="text-xs" />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="text-xs" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/* ========== PROFILES TAB ========== */
function ProfilesTab() {
  const { user } = useAuth();
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

  const handlePasswordChange = async () => {
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

    try {
      setSaving(true);
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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {effectiveUser && (
        <div className="max-w-lg space-y-4 border rounded-xl p-6 bg-card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-accent font-bold text-xl">{effectiveUser.fullName?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{effectiveUser.fullName}</h3>
              <Badge variant="secondary" className="text-[10px] capitalize mt-1">{effectiveUser.role?.replace('_', ' ')}</Badge>
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={effectiveUser.fullName || ''} disabled className="text-xs bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={effectiveUser.email || ''} disabled className="text-xs bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={effectiveUser.phone || 'N/A'} disabled className="text-xs bg-secondary" />
            </div>
            {(effectiveUser.role === 'admin' || effectiveUser.role === 'member') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Zones</Label>
                <Input value={effectiveZones.length > 0 ? effectiveZones.join(', ') : 'N/A'} disabled className="text-xs bg-secondary" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm New Password</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-xs"
              />
            </div>
            <Button onClick={handlePasswordChange} disabled={saving} className="w-full gap-1.5">
              <KeyRound size={14} />
              {saving ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  const [activeSection, setActiveSection] = useState<'login_activity' | 'lead_activity'>('login_activity');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {[
          { id: 'login_activity', label: 'Login Activity' },
          { id: 'lead_activity', label: 'Lead Activity' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'login_activity' && <LoginActivityTab />}
      {activeSection === 'lead_activity' && <LeadActivityTab />}
    </div>
  );
}

function IntegrationTab() {
  const [keyValue, setKeyValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [rotatedAt, setRotatedAt] = useState<string | null>(null);

  const loadKey = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integration-key', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load key');
      setKeyValue(data.key || '');
      setRotatedAt(data.rotatedAt ? new Date(data.rotatedAt).toLocaleString('en-IN') : null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKey();
  }, []);

  const handleCopy = async () => {
    if (!keyValue) return;
    try {
      await navigator.clipboard.writeText(keyValue);
      toast.success('Integration key copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleRotate = async () => {
    if (!confirm('Regenerate integration key? This will disconnect existing integrations.')) return;
    try {
      setRotating(true);
      const res = await fetch('/api/integration-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate');
      setKeyValue(data.key || '');
      setRotatedAt(data.rotatedAt ? new Date(data.rotatedAt).toLocaleString('en-IN') : null);
      toast.success('Integration key regenerated');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="kpi-card max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-xs text-foreground">Integration Key</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Use this key to connect Attendance system.</p>
        </div>
        {rotatedAt && <span className="text-[10px] text-muted-foreground">Updated {rotatedAt}</span>}
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading key...</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={keyValue} readOnly className="text-xs" />
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              <Copy size={12} /> Copy
            </Button>
          </div>
          <Button size="sm" variant="secondary" onClick={handleRotate} disabled={rotating} className="gap-1.5 text-xs">
            <RefreshCcw size={12} />
            {rotating ? 'Regenerating...' : 'Regenerate Key'}
          </Button>
          <div className="text-[11px] text-muted-foreground">
            Share this key once in ARENA OS &gt; Connect to CRM. It acts like a pairing code.
          </div>
        </div>
      )}
    </div>
  );
}
