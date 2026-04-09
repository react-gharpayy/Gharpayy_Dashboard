import React, { createContext, useContext, useState } from 'react';
import { Tour, Role } from './types';
import { tours as initialTours } from './mock-data';

interface AppState {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentMemberId: string | null;
  setCurrentMemberId: (id: string | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tours, setTours] = useState<Tour[]>(initialTours);
  const [currentRole, setCurrentRole] = useState<Role>('hr');
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  return (
    <AppContext.Provider value={{ tours, setTours, currentRole, setCurrentRole, currentMemberId, setCurrentMemberId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
