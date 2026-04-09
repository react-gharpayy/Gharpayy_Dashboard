/**
 * Navigation items for Flow Ops and TCM roles.
 * Add these to your sidebar/nav component.
 * 
 * Icons used: LayoutDashboard, CalendarPlus, BarChart3 from 'lucide-react'
 */

import { LayoutDashboard, CalendarPlus, BarChart3 } from 'lucide-react';

// Flow Ops navigation items
export const flowOpsNavItems = [
  { label: 'Dashboard', path: '/flow-ops', icon: LayoutDashboard },
  { label: 'Schedule', path: '/schedule', icon: CalendarPlus },
  { label: 'My Tours', path: '/tours', icon: BarChart3 },
];

// TCM navigation items
export const tcmNavItems = [
  { label: 'Tours', path: '/tcm', icon: LayoutDashboard },
  { label: 'Actions', path: '/tcm/actions', icon: CalendarPlus },
  { label: 'Stats', path: '/tcm/performance', icon: BarChart3 },
];

// Role configuration
export const roleConfig = {
  'flow-ops': {
    label: 'Flow Ops',
    color: 'bg-role-flow',     // Blue dot
    navItems: flowOpsNavItems,
  },
  tcm: {
    label: 'TCM',
    color: 'bg-role-tcm',      // Green dot
    navItems: tcmNavItems,
  },
};
