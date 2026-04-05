"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const ATTENDANCE_URL = "https://gharpayy-core.vercel.app/login";

export default function AttendanceLogin() {
  useEffect(() => {
    window.location.href = ATTENDANCE_URL;
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
        <h1 className="text-lg font-semibold text-foreground">Redirecting…</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Taking you to the ARENA OS attendance login.
        </p>
        <Button
          className="mt-6 w-full h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => {
            window.location.href = ATTENDANCE_URL;
          }}
        >
          Continue to Attendance
        </Button>
        <button
          type="button"
          onClick={() => window.open(ATTENDANCE_URL, "_blank")}
          className="mt-4 w-full text-xs text-muted-foreground hover:text-accent flex items-center justify-center gap-1.5"
        >
          Open in a new tab <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
