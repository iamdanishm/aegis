"use client";

import { useDisasterSimulation } from "@/hooks/useDisasterSimulation";
import { SignalFeed } from "@/components/SignalFeed";
import { ReasoningLog } from "@/components/ReasoningLog";
import { CommanderControls } from "@/components/CommanderControls";
import { useSimulationStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MissionReportModal } from "@/components/MissionReportModal";

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
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/50 animate-[pulse_2s_ease-in-out_infinite]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50 animate-[pulse_2s_ease-in-out_infinite_0.5s]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-[pulse_2s_ease-in-out_infinite_1s]"></div>
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
  const {
    setIsPlaying,
    incidents,
    notification,
    setIsMicAuthorized,
    showNotification,
    isSimulationComplete,
    logs,
    setReport,
    report,
    setIsReportOpen,
    isGeneratingReport,
    setIsGeneratingReport
  } = useSimulationStore();

  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    showNotification("Initializing Gemini 3 Auditor...", "info");

    try {
      // Dynamic import of server action if needed, or direct call
      const { generateMissionReport } = await import("@/agents/reporter");
      const generatedReport = await generateMissionReport(incidents, logs);
      setReport(generatedReport);
      setIsReportOpen(true);
      showNotification("Report Generated Successfully", "success");
    } catch (e) {
      console.error("[PAGE] Report Generation Error:", e);
      showNotification("Failed to generate report. Check console.", "error");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // One-time mic check on mount
  useEffect(() => {
    const checkMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicAuthorized(true);
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn("[COMMANDER] Mic permission denied:", err);
        setIsMicAuthorized(false);
        showNotification("Microphone access denied. Voice commands disabled.", "error");
      }
    };
    checkMic();
  }, [setIsMicAuthorized, showNotification]);

  // Calculate stats
  const criticalCount = incidents.filter(i => i.priority === "CRITICAL").length;
  const highCount = incidents.filter(i => i.priority === "HIGH").length;

  return (
    <>
      <main className="dashboard-content h-screen w-screen bg-[#050505] text-zinc-100 flex flex-col overflow-hidden font-sans selection:bg-emerald-500/30">
        {/* ... background and header ... */}
        <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none z-0" />

        <header className="h-16 shrink-0 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
          {/* ... branding and controls ... */}
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
              <p className="text-[10px] text-zinc-500 font-mono tracking-[0.2em] uppercase">Autonomous Civilian-to-Command Response System</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">

            {/* REPORT GENERATION BUTTON - Only visible when complete */}
            <AnimatePresence>
              {isSimulationComplete && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={report ? () => setIsReportOpen(true) : handleGenerateReport}
                  disabled={isGeneratingReport}
                  className={cn(
                    "relative px-6 py-2 rounded-full font-mono text-xs font-bold tracking-widest overflow-hidden border transition-all",
                    report
                      ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      : "border-amber-500/30 text-amber-500 hover:bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  )}
                >
                  {isGeneratingReport ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      AUDITING...
                    </span>
                  ) : report ? (
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      VIEW MISSION REPORT
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      GENERATE MISSION REPORT
                    </span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            <button
              onClick={() => {
                if (!isPlaying) {
                  // Starting new simulation - reset report state
                  setReport(null);
                }
                setIsPlaying(!isPlaying);
              }}
              className={cn(
                "group relative px-6 py-2 rounded-full font-mono text-xs font-bold tracking-widest transition-all duration-500 overflow-hidden border",
                isPlaying ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              )}
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

            {/* MOCK MODE TOGGLE */}
            <button
              onClick={() => useSimulationStore.getState().setIsMockMode(!useSimulationStore.getState().isMockMode)}
              className={cn(
                "group relative px-6 py-2 rounded-full font-mono text-xs font-bold tracking-widest transition-all duration-500 overflow-hidden border",
                useSimulationStore.getState().isMockMode
                  ? "border-purple-500/30 hover:border-purple-500 text-purple-400 hover:bg-purple-500/10"
                  : "border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:bg-zinc-800"
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                {useSimulationStore.getState().isMockMode ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    MOCK SIMULATION
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-zinc-600" />
                    LIVE API MODE
                  </>
                )}
              </span>
            </button>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest leading-none mb-1">Status: OK</span>
              <span className="font-mono text-2xl text-zinc-200 tabular-nums leading-none">
                T+{String(Math.floor(time / 60)).padStart(2, '0')}:{String(time % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        </header>

        {/* Main Layout - FIXED height grid, no page scroll */}
        <div className="flex-1 p-4 md:p-6 min-h-0 overflow-hidden relative z-10">
          <div className="h-full w-full max-w-[1920px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
            <section className="md:col-span-3 flex flex-col gap-4 order-2 md:order-1 min-h-0 overflow-hidden">
              <div className="grid grid-cols-2 gap-2 shrink-0"><StatCard label="CRITICAL" value={criticalCount} colorClass="text-red-400" iconColorClass="bg-red-500" /></div>
              <DashboardCard title="INCOMING SIGNALS" className="flex-1 min-h-0 overflow-hidden"><SignalFeed className="h-full" /></DashboardCard>
            </section>
            <section className="md:col-span-6 flex flex-col order-1 md:order-2 min-h-0 overflow-hidden">
              <DashboardCard className="flex-1 rounded-none border-emerald-500/20 min-h-0"><TacticalMap className="h-full" /></DashboardCard>
            </section>
            <section className="md:col-span-3 flex flex-col order-3 md:order-3 min-h-0 overflow-hidden">
              <DashboardCard title="SYSTEM REASONING" className="flex-1 min-h-0 overflow-hidden"><ReasoningLog className="h-full" /></DashboardCard>
            </section>
          </div>
        </div>

      </main >

      <MissionReportModal />

      {/* Global Toast with AnimatePresence */}
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification.message}
            initial={{ opacity: 0, x: "-50%" }}
            animate={{ opacity: 1, x: "-50%" }}
            exit={{ opacity: 0, x: "-50%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed top-20 left-1/2 z-[10000] px-6 py-3 rounded-lg shadow-2xl border flex items-center gap-3 backdrop-blur-xl bg-zinc-900/90",
              notification.type === "error" ? "border-red-500/50 text-red-200" :
                notification.type === "success" ? "border-emerald-500/50 text-emerald-200" :
                  "border-zinc-700 text-zinc-200"
            )}
          >
            <div className={cn(
              "w-1 h-1 rounded-full",
              notification.type === "error" ? "bg-red-500" : "bg-emerald-500"
            )} />
            {notification.type === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
              {notification.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
