"use client";

import { useDisasterSimulation } from "@/hooks/useDisasterSimulation";
import { SignalFeed } from "@/components/SignalFeed";
import { ReasoningLog } from "@/components/ReasoningLog";
import { TacticalMap } from "@/components/TacticalMap";
import { useSimulationStore } from "@/lib/store";

export default function ResponderView() {
  const { time, isPlaying } = useDisasterSimulation();
  const { setIsPlaying, incidents } = useSimulationStore();

  // Calculate stats
  const criticalCount = incidents.filter(i => i.priority === "CRITICAL").length;
  const highCount = incidents.filter(i => i.priority === "HIGH").length;
  const analyzingCount = incidents.filter(i => i.status === "PENDING").length;

  return (
    <main className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900/50 to-zinc-950 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-400 font-bold text-lg">A</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-950 animate-pulse" />
          </div>

          {/* Title */}
          <div>
            <h1 className="font-bold tracking-tight text-lg flex items-center gap-2">
              AEGIS
              <span className="text-[10px] font-normal text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">v1.0</span>
            </h1>
            <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
              CIVILIAN-TO-COMMAND INTERFACE
            </p>
          </div>
        </div>

        {/* Center - Stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-zinc-400">CRITICAL</span>
            <span className="text-sm font-bold text-red-400">{criticalCount}</span>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[11px] text-zinc-400">HIGH</span>
            <span className="text-sm font-bold text-orange-400">{highCount}</span>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[11px] text-zinc-400">ANALYZING</span>
            <span className="text-sm font-bold text-cyan-400">{analyzingCount}</span>
          </div>
        </div>

        {/* Right - Clock & Controls */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Mission Clock</div>
            <div className="font-mono text-2xl leading-none text-emerald-400 tabular-nums">
              T+{String(Math.floor(time / 60)).padStart(2, '0')}:{String(time % 60).padStart(2, '0')}
            </div>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-5 py-2 rounded-lg text-sm font-bold border transition-all duration-300 ${isPlaying
              ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
              : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500"
              }`}
          >
            {isPlaying ? "⏸ PAUSE" : "▶ START"}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 min-h-0">

        {/* Left Column: Feed */}
        <section className="md:col-span-3 h-[35vh] md:h-full min-h-0">
          <SignalFeed className="h-full" />
        </section>

        {/* Middle Column: Map + Metrics */}
        <section className="md:col-span-6 h-[40vh] md:h-full min-h-0 flex flex-col gap-3">
          <TacticalMap className="flex-1" />

          {/* Quick Metrics Row */}
          <div className="h-20 shrink-0 grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col justify-center items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent" />
              <div className="text-xl font-bold text-zinc-200">100%</div>
              <div className="text-[9px] uppercase text-zinc-500 tracking-wider">System Integrity</div>
            </div>
            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col justify-center items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500/50 to-transparent" />
              <div className="text-xl font-bold text-cyan-400">2.5-FL</div>
              <div className="text-[9px] uppercase text-zinc-500 tracking-wider">AI Model</div>
            </div>
            <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col justify-center items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent" />
              <div className="text-xl font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </div>
              <div className="text-[9px] uppercase text-zinc-500 tracking-wider">Connection</div>
            </div>
          </div>
        </section>

        {/* Right Column: Reasoning */}
        <section className="md:col-span-3 h-[35vh] md:h-full min-h-0">
          <ReasoningLog className="h-full" />
        </section>

      </div>
    </main>
  );
}
