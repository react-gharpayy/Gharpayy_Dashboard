"use client";

import { type ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import AppLayout from "@/components/AppLayout";

export default function MytLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const meta = useMemo(() => {
    if (pathname?.startsWith("/myt/schedule")) {
      return { title: "Schedule", subtitle: "Schedule a new tour" };
    }
    if (pathname?.startsWith("/myt/calendar")) {
      return { title: "Calendar", subtitle: "Tour calendar view" };
    }
    if (pathname?.startsWith("/myt/tour/")) {
      return { title: "Tour Detail", subtitle: "Tour command view" };
    }
    return { title: "Tours", subtitle: "MYT tours list" };
  }, [pathname]);

  return (
    <AppLayout title={meta.title} subtitle={meta.subtitle} showQuickAddLead={false}>
      {children}
    </AppLayout>
  );
}
