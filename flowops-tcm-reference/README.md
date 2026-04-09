# Flow Ops & TCM Features — Reference Code

This folder contains ALL the code needed to implement the **Flow Ops** and **TCM** features in your main project. Hand this entire folder to your AI agent.

## What These Features Do

### Flow Ops (Tour Scheduling / Lead Operations)
- **FlowOpsDashboard** — Shows the scheduling agent's personal metrics (tours booked, pending, show-ups, drafts) and a list of tours they scheduled.
- **ScheduleTour** — A form to schedule a new tour (lead name, phone, property, zone, date/time, budget, booking source, lead type, assign to a TCM).
- **AllTours** — Master list of all tours with status & outcome filters. Shows mobile cards + desktop table views.

### TCM (Tour Closure Manager)
- **TCMDashboard** — The TCM's execution panel: personal metrics, "Confirm Now" queue for upcoming tours, "Update Outcome" section for completed tours, and full schedule with confirm/show/no-show actions.
- **TCMActions** — An action-queue view grouped by: confirm attendance, missed follow-ups, update outcomes, push draft agreements.
- **TCMPerformance** — Personal performance stats (total tours, completed, show-up %, drafts, daily summary breakdown).

### Shared / Supporting Features
- **DraftTracker** — Tracks all tours with "draft" outcome for rent-agreement follow-up.

## File Structure

```
flowops-tcm-reference/
├── README.md                         ← You're here
├── IMPLEMENTATION_GUIDE.md           ← Step-by-step integration guide
│
├── pages/                            ← Feature pages (React components)
│   ├── FlowOpsDashboard.tsx          ← Flow Ops personal dashboard
│   ├── ScheduleTour.tsx              ← Tour scheduling form
│   ├── AllTours.tsx                  ← Master tour list
│   ├── TCMDashboard.tsx              ← TCM execution panel
│   ├── TCMActions.tsx                ← TCM action queue
│   ├── TCMPerformance.tsx            ← TCM personal stats
│   └── DraftTracker.tsx              ← Draft agreement tracker
│
├── components/                       ← Shared UI components
│   ├── MetricCard.tsx                ← Stat card with glow effect
│   ├── StatusBadge.tsx               ← Tour status & outcome badges
│   ├── DateRangeToggle.tsx           ← Today/Week/Month toggle
│   └── HourlyHeatmap.tsx            ← Recharts bar chart
│
├── lib/                              ← Types, context, data, utils
│   ├── types.ts                      ← All TypeScript interfaces & types
│   ├── app-context.tsx               ← React context (state management)
│   ├── mock-data.ts                  ← Mock zones, members, tours data
│   └── utils.ts                      ← cn() utility (clsx + tailwind-merge)
│
├── navigation/                       ← Sidebar nav config
│   └── sidebar-nav-config.ts         ← Flow Ops & TCM nav items
│
└── styles/                           ← Design system
    ├── css-variables.css             ← CSS custom properties (dark theme)
    ├── utility-classes.css           ← glass-card, metric-glow, role colors
    └── tailwind-extensions.ts        ← Tailwind config extensions (colors, fonts, animations)
```

## Dependencies Required

```json
{
  "lucide-react": "^0.400+",
  "recharts": "^2.x",
  "sonner": "^1.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x",
  "tailwindcss-animate": "^1.x",
  "react-router-dom": "^6.x",
  "@tanstack/react-query": "^5.x"
}
```

## Routes to Add

```tsx
<Route path="/flow-ops" element={<FlowOpsDashboard />} />
<Route path="/schedule" element={<ScheduleTour />} />
<Route path="/tours" element={<AllTours />} />
<Route path="/drafts" element={<DraftTracker />} />
<Route path="/tcm" element={<TCMDashboard />} />
<Route path="/tcm/actions" element={<TCMActions />} />
<Route path="/tcm/performance" element={<TCMPerformance />} />
```

## Design System

The UI uses a **dark theme** with these role colors:
- **Flow Ops** — Blue (`hsl(217 91% 60%)`)
- **TCM** — Green (`hsl(152 69% 45%)`)
- **HR** — Amber (`hsl(38 92% 50%)`)

Fonts: **Space Grotesk** (headings) + **DM Sans** (body)

Glass-card style: `bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg`
