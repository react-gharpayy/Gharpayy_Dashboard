# Implementation Guide — Flow Ops & TCM Features

## Step 1: Add Dependencies

```bash
npm install lucide-react recharts sonner clsx tailwind-merge tailwindcss-animate react-router-dom @tanstack/react-query
```

## Step 2: Add CSS Variables & Utility Classes

Copy the contents from `styles/css-variables.css` and `styles/utility-classes.css` into your main CSS file (e.g., `index.css` or `globals.css`).

Also add this Google Fonts import at the top of your CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Grotesk:wght@300..700&display=swap');
```

## Step 3: Extend Tailwind Config

Merge the extensions from `styles/tailwind-extensions.ts` into your `tailwind.config.ts`. Key things to add:
- Font families (heading, body)
- Role colors (flow-ops, tcm, hr, success, warning, danger)
- Surface colors
- Keyframe animations (pulse-glow, slide-up)

## Step 4: Add Types

Copy `lib/types.ts` — these are all the TypeScript interfaces used across both features:
- `Role`, `Zone`, `TeamMember`, `Tour`, `TourStatus`, `TourOutcome`, `BookingSource`, `LeadType`
- `MetricCard`, `HeatmapData`, `ZonePerformance`, `MemberPerformance`

## Step 5: Set Up State Management

Copy `lib/app-context.tsx` — this provides:
- `tours` state (array of Tour objects)
- `currentRole` state ('flow-ops' | 'tcm' | 'hr')
- `currentMemberId` state

Wrap your app with `<AppProvider>`.

**NOTE**: The mock data currently uses `lib/mock-data.ts`. In your real project, replace this with API calls to your backend.

## Step 6: Add Shared Components

Copy these from `components/`:
1. `MetricCard.tsx` — Reusable stat card with color-coded glow
2. `StatusBadge.tsx` — Tour status and outcome badge components
3. `DateRangeToggle.tsx` — Date range selector (today/week/month)
4. `HourlyHeatmap.tsx` — Recharts bar chart (used in HR Tower, can be used elsewhere)

## Step 7: Add Feature Pages

Copy all files from `pages/` into your pages directory:

### Flow Ops pages:
- `FlowOpsDashboard.tsx`
- `ScheduleTour.tsx`

### TCM pages:
- `TCMDashboard.tsx`
- `TCMActions.tsx`
- `TCMPerformance.tsx`

### Shared pages:
- `AllTours.tsx`
- `DraftTracker.tsx`

## Step 8: Add Routes

Add routes to your router configuration (see `README.md` for route paths).

## Step 9: Add Navigation

Use the nav config from `navigation/sidebar-nav-config.ts` to add nav items to your sidebar.

## Step 10: Replace Mock Data with API

The mock data in `lib/mock-data.ts` generates:
- 7 zones (Bangalore areas)
- 42 team members (70% flow-ops, 30% tcm)
- 80 tours with various statuses

In your real app, replace `initialTours` in `app-context.tsx` with data fetched from your API. The `Tour` interface in `types.ts` defines the shape of tour data your API should return.

## Key Patterns to Note

### Tour Status Flow
```
scheduled → confirmed → completed (show-up) → outcome (draft/follow-up/rejected)
                      → no-show
                      → cancelled
```

### Role-Based Views
- **Flow Ops** sees: tours they scheduled, scheduling form
- **TCM** sees: tours assigned to them, confirmation queue, outcome updates
- **Both** share: AllTours list, DraftTracker

### State Updates
Tours are updated in-place using `setTours(prev => prev.map(...))`. The `updateTour` helper is defined locally in each component — in your real app, these should trigger API calls.
