"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-sm">G</span>
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">Gharpayy</span>
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-semibold text-foreground">Choose your login</h1>
          <p className="text-sm text-muted-foreground mt-2">Select the system you want to access.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <ShieldCheck className="text-accent" size={22} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">CRM Login</h2>
            <p className="text-sm text-muted-foreground mt-1">Access the Gharpayy CRM dashboard.</p>
            <Button
              className="mt-6 w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => router.push('/auth')}
            >
              Proceed
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <Clock className="text-accent" size={22} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Attendance Login</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to ARENA OS attendance system.</p>
            <Button
              className="mt-6 w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => window.location.href = 'https://gharpayy-core.vercel.app/login'}
            >
              Proceed
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
