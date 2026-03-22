"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Activity, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export function LoginActivityTab() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadActivities(1);
  }, []);

  const loadActivities = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`/api/activity/login?page=${pageNum}&limit=50`);
      if (!res.ok) throw new Error('Failed to load login activities');
      const data = await res.json();
      
      if (pageNum === 1) {
        setActivities(data.activities);
      } else {
        setActivities(prev => [...prev, ...data.activities]);
      }
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadActivities(page + 1);
    }
  };

  const handleExport = () => {
    if (activities.length === 0) return;
    const csv = [
      ['Name', 'Role', 'Action', 'Time'].join(','),
      ...activities.map(act => [
        `"${act.name}"`,
        `"${act.role}"`,
        `"${act.actionType === 'login' ? 'Logged in' : 'Logged out'}"`,
        `"${format(new Date(act.createdAt), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity size={14} /> Login Activity
          </div>
          {!loading && activities.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-[10px] gap-1 px-2 rounded-lg">
              <Download size={12} /> Export
            </Button>
          )}
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin w-5 h-5 text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No login activity recorded yet.</p>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="rounded-xl bg-secondary/50 p-3 space-y-1">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {act.name} <span className="font-normal text-[10px] text-muted-foreground">({act.role})</span>
                      </p>
                      <p className="text-[11px] font-medium mt-0.5">
                        {act.actionType === 'login' ? (
                          <span className="text-green-600 dark:text-green-500">Logged in</span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-500">Logged out</span>
                        )}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(act.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
            
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  className="text-[10px] h-8 text-muted-foreground hover:text-foreground"
                >
                  {loadingMore ? <Loader2 className="animate-spin w-3 h-3 mr-2" /> : null}
                  Load older activity
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadActivityTab() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadActivities(1);
  }, []);

  const loadActivities = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`/api/activity/lead?page=${pageNum}&limit=50`);
      if (!res.ok) throw new Error('Failed to load lead activities');
      const data = await res.json();
      
      if (pageNum === 1) {
        setActivities(data.activities);
      } else {
        setActivities(prev => [...prev, ...data.activities]);
      }
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadActivities(page + 1);
    }
  };

  const handleExport = () => {
    if (activities.length === 0) return;
    const csv = [
      ['User', 'Role', 'Action', 'Lead Name', 'Lead ID', 'From', 'To', 'Time'].join(','),
      ...activities.map(act => [
        act.userName,
        act.userRole,
        act.actionType,
        act.leadName || 'Unknown',
        `L-${act.leadId.slice(-6).toUpperCase()}`,
        act.details?.from || '',
        act.details?.to || '',
        format(new Date(act.createdAt), 'yyyy-MM-dd HH:mm:ss')
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const renderActionText = (act: any) => {
    switch (act.actionType) {
      case 'added':
        return <span className="text-emerald-600 dark:text-emerald-500">Created a lead</span>;
      case 'deleted':
        return <span className="text-red-600 dark:text-red-500">Deleted a lead</span>;
      case 'status_changed':
        return (
          <span>
            Changed status from <span className="font-semibold">{act.details?.from || 'None'}</span> to <span className="font-semibold text-accent">{act.details?.to || 'None'}</span>
          </span>
        );
      case 'assigned':
        return (
          <span>
            Changed assignment from <span className="font-semibold">{act.details?.from || 'unassigned'}</span> to <span className="font-semibold text-accent">{act.details?.to || 'unassigned'}</span>
          </span>
        );
      default:
        return <span>{act.actionType}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="kpi-card">
        <h3 className="font-display font-semibold text-xs mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity size={14} /> Lead Activity
          </div>
          {!loading && activities.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-7 text-[10px] gap-1 px-2 rounded-lg">
              <Download size={12} /> Export
            </Button>
          )}
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin w-5 h-5 text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No lead activity recorded yet.</p>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="rounded-xl bg-secondary/50 p-3 space-y-1">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {act.userName} <span className="font-normal text-[10px] text-muted-foreground">({act.userRole})</span>
                      </p>
                      <p className="text-[11px] text-foreground mt-0.5">
                        {renderActionText(act)}
                      </p>
                      {/* Show lead Name & ID context */}
                      <p className="text-[9px] text-muted-foreground mt-1 font-mono">
                        Lead: <span className="text-foreground">{act.leadName || 'Unknown'}</span> <span className="opacity-70">(ID: L-{act.leadId.slice(-6).toUpperCase()})</span>
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(act.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}

            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  className="text-[10px] h-8 text-muted-foreground hover:text-foreground"
                >
                  {loadingMore ? <Loader2 className="animate-spin w-3 h-3 mr-2" /> : null}
                  Load older activity
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
