# Gharpayy Dashboard

Operational CRM and property management dashboard built with Next.js App Router.

## Stack
- Next.js 16 + React 18 + TypeScript
- Tailwind CSS + Radix UI + shadcn/ui
- TanStack React Query
- MongoDB + Mongoose
- JWT cookie-based auth via Next.js API routes

## What It Covers
- Lead lifecycle and pipeline tracking
- Visits, bookings, inventory, zones, and owners
- Dashboard analytics and activity logs
- Internal auth and protected app flows

## Local Setup
1. Install dependencies:
```bash
npm install
```

2. Create `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/dashboard
JWT_SECRET=replace_with_a_strong_secret
```


3. Start development server:
```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Scripts
- `npm run dev` - start local dev server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run lint checks

