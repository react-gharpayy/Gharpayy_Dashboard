"use client";

import { createContext, useContext, useMemo, useState } from 'react';
import type { Tour } from '@/features/tours/types';

type ToursContextType = {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  updateTour: (tourId: string, updates: Partial<Tour>) => void;
};

const ToursContext = createContext<ToursContextType | null>(null);

export function ToursProvider({ children }: { children: React.ReactNode }) {
  const [tours, setTours] = useState<Tour[]>([]);

  const updateTour = (tourId: string, updates: Partial<Tour>) => {
    setTours((prev) => prev.map((tour) => (tour.id === tourId ? { ...tour, ...updates } : tour)));
  };

  const value = useMemo(
    () => ({ tours, setTours, updateTour }),
    [tours]
  );

  return <ToursContext.Provider value={value}>{children}</ToursContext.Provider>;
}

export function useToursState() {
  const ctx = useContext(ToursContext);
  if (!ctx) throw new Error('useToursState must be used inside ToursProvider');
  return ctx;
}
