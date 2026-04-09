"use client";

import AppLayout from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlowOpsPanel } from '@/components/tours/FlowOpsPanel';
import { TCMPanel } from '@/components/tours/TCMPanel';
import { ToursProvider } from '@/contexts/ToursContext';

export default function ToursPage() {
  return (
    <ToursProvider>
      <AppLayout title="Tours" subtitle="Flow Ops and TCM operations">
        <div className="space-y-4">
          <Tabs defaultValue="flow-ops" className="w-full">
            <TabsList className="h-9">
              <TabsTrigger value="flow-ops" className="text-xs md:text-sm">Flow Ops</TabsTrigger>
              <TabsTrigger value="tcm" className="text-xs md:text-sm">TCM</TabsTrigger>
            </TabsList>

            <TabsContent value="flow-ops">
              <FlowOpsPanel />
            </TabsContent>

            <TabsContent value="tcm">
              <TCMPanel />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </ToursProvider>
  );
}
