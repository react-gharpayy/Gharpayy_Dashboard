import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────
export type AppRole = 'admin' | 'manager' | 'agent' | 'owner';

interface AuthContextType {
  user:     User | null;
  session:  Session | null;
  role:     AppRole | null;
  agentId:  string | null;      // agents.id for the current user
  loading:  boolean;
  roleLoading: boolean;
  signOut:  () => Promise<void>;
  // Convenience helpers
  isAdmin:   boolean;
  isManager: boolean;
  isAgent:   boolean;
  isOwner:   boolean;
  canManageTeam: boolean;       // admin or manager
}

const AuthContext = createContext<AuthContextType>({
  user:         null,
  session:      null,
  role:         null,
  agentId:      null,
  loading:      true,
  roleLoading:  true,
  signOut:      async () => {},
  isAdmin:      false,
  isManager:    false,
  isAgent:      false,
  isOwner:      false,
  canManageTeam: false,
});

export const useAuth = () => useContext(AuthContext);

// ── Provider ──────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,        setUser]        = useState<User | null>(null);
  const [session,     setSession]     = useState<Session | null>(null);
  const [role,        setRole]        = useState<AppRole | null>(null);
  const [agentId,     setAgentId]     = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  // Fetch role + agentId for a given user
  const loadRoleAndAgent = useCallback(async (userId: string) => {
    setRoleLoading(true);
    try {
      // Call DB function — returns highest-privilege role
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_my_role');

      if (roleError) {
        console.error('[AuthContext] get_my_role error:', roleError.message);
      } else {
        setRole(roleData as AppRole ?? null);
      }

      // Resolve agents.id (null for owner-only users)
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (agentError) {
        console.error('[AuthContext] agent lookup error:', agentError.message);
      } else {
        setAgentId(agentData?.id ?? null);
      }
    } finally {
      setRoleLoading(false);
    }
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setSession(null);
    setRole(null);
    setAgentId(null);
    setRoleLoading(false);
  }, []);

  useEffect(() => {
    // Single source of truth: onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (newSession?.user) {
          // Defer Supabase calls to avoid auth deadlock
          setTimeout(() => loadRoleAndAgent(newSession.user.id), 0);
        } else {
          clearAuth();
        }
      }
    );

    // Hydrate on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user) {
        loadRoleAndAgent(s.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadRoleAndAgent, clearAuth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuth();
  };

  const isAdmin        = role === 'admin';
  const isManager      = role === 'manager';
  const isAgent        = role === 'agent';
  const isOwner        = role === 'owner';
  const canManageTeam  = isAdmin || isManager;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        agentId,
        loading,
        roleLoading,
        signOut,
        isAdmin,
        isManager,
        isAgent,
        isOwner,
        canManageTeam,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
