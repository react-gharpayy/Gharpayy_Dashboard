"use client";

import AppLayout from '@/components/AppLayout';
import { CreatorLeaderboardPanel } from '@/components/CreatorLeaderboardPanel';
import { motion } from 'framer-motion';

export default function LeaderboardPage() {
  return (
    <AppLayout title="Leaderboard" subtitle="Agent performance rankings">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        <CreatorLeaderboardPanel />
      </motion.div>
    </AppLayout>
  );
}
