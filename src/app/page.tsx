"use client";

import { useDisasterSimulation } from "@/hooks/useDisasterSimulation";
import { SignalFeed } from "@/components/SignalFeed";
import { ReasoningLog } from "@/components/ReasoningLog";
import { useSimulationStore } from "@/lib/store";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const TacticalMap = dynamic(() => import("@/components/TacticalMap").then(mod => mod.TacticalMap), { ssr: false });

// --- Components ---

function DashboardCard({ children, className, title, icon }: { children: React.ReactNode, className?: string, title?: string, icon?: React.ReactNode }) {
  return (
    <div className={`glass-panel rounded-xl flex flex-col overflow-hidden relative ${className}`}>
      {/* Card Header (Optional) */}
      {title && (
        <div className="h-10 border-b border-white/5 bg-white/5 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-zinc-400">
            {icon}
            <span className="text-[10px] font-mono tracking-widest uppercase font-bold">{title}</span>
          </div>
          {/* Decorative dots */}
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
            <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
            <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, colorClass, iconColorClass }: { label: string, value: number, colorClass: string, iconColorClass: string }) {
  return (
    <div className="glass-panel px-4 py-3 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${iconColorClass} animate-pulse`} />
        <span className="text-[10px] font-mono text-zinc-400 tracking-wider">{label}</span>
      </div>
      <span className={`text-xl font-bold font-mono ${colorClass}`}>{value}</span>
    </div>
  );
}

export default function ResponderView() {
  const { time, isPlaying } = useDisasterSimulation();
  const { setIsPlaying, incidents } = useSimulationStore();

  // Calculate stats
  const criticalCount = incidents.filter(i => i.priority === "CRITICAL").length;
  const highCount = incidents.filter(i => i.priority === "HIGH").length;
  const analyzingCount = incidents.filter(i => i.status === "PENDING").length;

  return (
    <main className="h-screen w-screen bg-[#050505] text-zinc-100 flex flex-col overflow-hidden font-sans selection:bg-emerald-500/30">
      {/* Background Ambient Glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* --- HEADER --- */}
      <header className="h-16 shrink-0 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
        {/* Branding */}
        <div className="flex items-center gap-4">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 rounded-lg border border-white/10 rotate-45"></div>
            <div className="absolute inset-0 border border-emerald-500/30 rounded-lg scale-75"></div>
            <span className="relative font-black text-xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">A</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
              PROJECT AEGIS
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-zinc-400 font-mono border border-white/5">V2.0-ALPHA</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-[0.2em] uppercase">Autonomous Emergency Grid Interface System</p>
          </div>
        </div>

        {/* Center Control */}
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`group relative px-6 py-2 rounded-full font-mono text-xs font-bold tracking-widest transition-all duration-500 overflow-hidden border ${isPlaying
              ? "border-red-500/30 hover:border-red-500 text-red-400 hover:bg-red-500/10"
              : "border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
              }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isPlaying ? (
                <>
                  <span className="w-2 h-2 rounded-[1px] bg-red-500 animate-[pulse_0.5s_infinite]" />
                  SYSTEM ACTIVE
                </>
              ) : (
                <>
                  <span className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-emerald-500 border-b-[4px] border-b-transparent ml-1" />
                  INITIALIZE
                </>
              )}
            </span>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">Mission Clock</span>
            <span className="font-mono text-2xl text-zinc-200 tabular-nums leading-none">
              T+{String(Math.floor(time / 60)).padStart(2, '0')}:{String(time % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Mobile Menu Button (Placeholder) */}
        <div className="md:hidden">
          <button className="p-2 text-zinc-400 hover:text-white">
            <div className="space-y-1.5 direction-rtl">
              <div className="w-6 h-0.5 bg-current"></div>
              <div className="w-4 h-0.5 bg-current ml-auto"></div>
              <div className="w-6 h-0.5 bg-current"></div>
            </div>
          </button>
        </div>
      </header>


      {/* --- GRID LAYOUT --- */}
      <div className="flex-1 p-4 md:p-6 min-h-0 overflow-y-auto md:overflow-hidden relative z-10">
        <div className="h-full w-full max-w-[1920px] mx-auto grid grid-cols-1 md:grid-cols-12 grid-rows-[auto_1fr] md:grid-rows-1 gap-4 md:gap-6">

          {/* COLUMN 1: FEED & METRICS (3 Cols) */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="md:col-span-3 flex flex-col gap-4 min-h-[400px] md:min-h-0 order-2 md:order-1"
          >
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <StatCard label="CRITICAL" value={criticalCount} colorClass="text-red-400" iconColorClass="bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              <StatCard label="ACTIVE" value={highCount} colorClass="text-orange-400" iconColorClass="bg-orange-500" />
            </div>

            {/* Feed */}
            <DashboardCard title="INCOMING SIGNALS" className="flex-1" icon={<div className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />}>
              <SignalFeed className="h-full" />
            </DashboardCard>
          </motion.section>


          {/* COLUMN 2: MAIN MAP (6 Cols) */}
          <motion.section
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="md:col-span-6 flex flex-col min-h-[400px] md:min-h-0 order-1 md:order-2"
          >
            <DashboardCard className="flex-1 border-emerald-500/20 shadow-[0_0_50px_-20px_rgba(16,185,129,0.1)]">
              <TacticalMap className="h-full" />
            </DashboardCard>
          </motion.section>


          {/* COLUMN 3: REASONING LOG (3 Cols) */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="md:col-span-3 flex flex-col min-h-[400px] md:min-h-0 order-3 md:order-3"
          >
            <DashboardCard title="SYSTEM REASONING" className="flex-1" icon={<div className="w-1.5 h-1.5 rounded-sm bg-cyan-500" />}>
              <ReasoningLog className="h-full" />
            </DashboardCard>
          </motion.section>

        </div>
      </div>
    </main>
  );
}
