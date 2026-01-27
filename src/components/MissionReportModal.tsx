"use client";

import { useSimulationStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Printer, CheckCircle, AlertTriangle, Activity, X, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function MissionReportModal() {
    const { report, setReport, isReportOpen, setIsReportOpen } = useSimulationStore();

    if (!report || !isReportOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mission-report-modal fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
                style={{ opacity: 1 }} // Force opacity 1 to override any potential lingering animation states during print
            >
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>

                <motion.div
                    initial={{ scale: 0.95, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 20, opacity: 0 }}
                    className="mission-report-container w-full max-w-4xl bg-[#f0f0f0] text-zinc-900 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-full border-4 border-zinc-300 relative font-mono"
                >
                    {/* Header - "Classified" Style */}
                    <div className="report-header bg-zinc-800 text-zinc-200 p-6 pr-12 border-b-4 border-zinc-400 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold uppercase tracking-widest">After Action Report</h2>
                                    <p className="text-xs text-zinc-400 tracking-[0.2em] uppercase">Project Aegis // Official Record</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase text-zinc-500 tracking-wider">Mission ID</span>
                            <span className="text-lg font-bold font-mono">{report.mission_id}</span>
                        </div>
                    </div>

                    {/* Paper Content */}
                    <div className="report-content flex-1 overflow-y-auto p-8 md:p-12 relative bg-[#fdfbf7] report-paper-bg">
                        {/* Watermark */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden report-watermark">
                            <h1 className="text-[150px] font-black -rotate-45 select-none whitespace-nowrap">CLASSIFIED</h1>
                        </div>

                        <div className="relative z-10 max-w-3xl mx-auto space-y-8">

                            {/* Executive Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="border border-zinc-300 p-4 bg-white shadow-sm">
                                    <span className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Performance Score</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn(
                                            "text-4xl font-black",
                                            report.performance_score >= 80 ? "text-emerald-700" :
                                                report.performance_score >= 50 ? "text-amber-600" : "text-red-700"
                                        )}>
                                            {report.performance_score}
                                        </span>
                                        <span className="text-zinc-400 text-sm">/ 100</span>
                                    </div>
                                </div>
                                <div className="border border-zinc-300 p-4 bg-white shadow-sm">
                                    <span className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Duration</span>
                                    <span className="text-2xl font-bold text-zinc-800">{report.duration}</span>
                                </div>
                                <div className="border border-zinc-300 p-4 bg-white shadow-sm">
                                    <span className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Lives Saved (Est.)</span>
                                    <div className="flex items-center gap-2 text-emerald-700">
                                        <Activity className="w-5 h-5" />
                                        <span className="text-2xl font-bold">{report.lives_saved_estimate}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Critical Events */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-zinc-300 pb-2 text-zinc-500">
                                    Critical Event Summary
                                </h3>
                                <ul className="space-y-3">
                                    {(report.critical_events_summary || []).map((event, idx) => (
                                        <li key={idx} className="flex gap-3 text-sm leading-relaxed text-zinc-800">
                                            <span className="text-zinc-400 shrink-0 font-mono">[{String(idx + 1).padStart(2, "0")}]</span>
                                            {event}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Officer Notes (LLM Output) */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest border-b border-zinc-300 pb-2 text-zinc-500">
                                    Commander's Notes
                                </h3>
                                <div className="prose prose-sm prose-zinc max-w-none font-serif leading-relaxed text-zinc-800 bg-white p-6 border border-zinc-200 shadow-sm whitespace-pre-wrap">
                                    {report.officer_notes}
                                </div>
                            </div>

                            {/* Incidents Log Table */}
                            {report.incidents_log && report.incidents_log.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold uppercase tracking-widest border-b border-zinc-300 pb-2 text-zinc-500">
                                        Incident Log ({report.incidents_log.length} Events)
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border border-zinc-300 bg-white">
                                            <thead>
                                                <tr className="bg-zinc-200 text-zinc-600 uppercase tracking-wider">
                                                    <th className="p-2 text-left border-b border-zinc-300">ID</th>
                                                    <th className="p-2 text-left border-b border-zinc-300">Type</th>
                                                    <th className="p-2 text-left border-b border-zinc-300">Priority</th>
                                                    <th className="p-2 text-left border-b border-zinc-300">Status</th>
                                                    <th className="p-2 text-left border-b border-zinc-300">Location</th>
                                                    <th className="p-2 text-left border-b border-zinc-300">Assets</th>
                                                    <th className="p-2 text-left border-b border-zinc-300">Auth</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.incidents_log.map((inc, idx) => (
                                                    <tr key={inc.id} className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
                                                        <td className="p-2 border-b border-zinc-200 font-mono font-bold">{inc.id}</td>
                                                        <td className="p-2 border-b border-zinc-200">
                                                            <span className={cn(
                                                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                                inc.type === "AUDIO" ? "bg-purple-100 text-purple-700" :
                                                                    inc.type === "VIDEO" ? "bg-blue-100 text-blue-700" :
                                                                        "bg-zinc-100 text-zinc-700"
                                                            )}>
                                                                {inc.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 border-b border-zinc-200">
                                                            <span className={cn(
                                                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                                inc.priority === "CRITICAL" ? "bg-red-100 text-red-700" :
                                                                    inc.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                                                                        inc.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                                                                            "bg-green-100 text-green-700"
                                                            )}>
                                                                {inc.priority}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 border-b border-zinc-200">
                                                            <span className={cn(
                                                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                                inc.status === "TRIAGED" || inc.status === "RESOLVED" ? "bg-emerald-100 text-emerald-700" :
                                                                    "bg-amber-100 text-amber-700"
                                                            )}>
                                                                {inc.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 border-b border-zinc-200 text-zinc-600" title={inc.location}>
                                                            {inc.location}
                                                        </td>
                                                        <td className="p-2 border-b border-zinc-200">
                                                            {inc.assets.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {inc.assets.map((asset, i) => (
                                                                        <span key={i} className="bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded text-[9px] font-bold">
                                                                            {asset}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-zinc-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="p-2 border-b border-zinc-200">
                                                            {inc.auth_status !== "N/A" ? (
                                                                <span className={cn(
                                                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                                    inc.auth_status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                                                                        inc.auth_status === "DENIED" ? "bg-red-100 text-red-700" :
                                                                            "bg-amber-100 text-amber-700"
                                                                )}>
                                                                    {inc.auth_status}
                                                                </span>
                                                            ) : (
                                                                <span className="text-zinc-400">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Footer Signoff */}
                            <div className="mt-12 pt-8 border-t-2 border-zinc-300 flex justify-between items-end">
                                <div>
                                    <div className="h-16 w-32 border-b border-zinc-400 mb-2 relative">
                                        <span className="absolute bottom-2 left-0 text-xl font-script text-blue-900 -rotate-6 opacity-80">
                                            Project Aegis AI
                                        </span>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">Authorized Signature</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase tracking-widest text-zinc-500">Generated At</span>
                                    <span className="text-xs font-mono text-zinc-700">{new Date(report.generated_at).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Performance Calculation & Disclaimers */}
                            <div className="mt-8 pt-6 border-t border-zinc-200 space-y-4">
                                <div className="bg-zinc-100 p-4 rounded border border-zinc-200">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Performance Score Calculation</h4>
                                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                                        The performance score is calculated using the following formula: <br />
                                        <code className="bg-zinc-200 px-1 py-0.5 rounded text-[10px] font-mono">
                                            Score = 60 + (Critical Resolved × 10) + (High Resolved × 5)
                                        </code><br />
                                        Maximum score is capped at 100. Lives saved estimate is calculated as: <br />
                                        <code className="bg-zinc-200 px-1 py-0.5 rounded text-[10px] font-mono">
                                            Lives = (Critical × 4) + (High × 2)
                                        </code>
                                    </p>
                                </div>

                                <div className="text-[9px] text-zinc-400 leading-relaxed space-y-2">
                                    <p><strong className="text-zinc-500">DISCLAIMER:</strong> This report was generated by Project Aegis, an AI-powered autonomous triage system developed for demonstration purposes during a hackathon event. All data, statistics, and recommendations are simulated and should not be used for actual emergency response operations.</p>
                                    <p><strong className="text-zinc-500">AI TRANSPARENCY:</strong> This system uses Google Gemini 3 models for real-time analysis. All AI reasoning traces and decision chains are logged for audit purposes. The "Chain of Custody" cryptographic signatures verify the integrity of AI decision-making.</p>
                                    <p><strong className="text-zinc-500">PROTOCOL ZERO:</strong> Critical decisions flagged for human authorization represent scenarios where AI confidence was below threshold or ethical/safety considerations required human oversight.</p>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-4 bg-zinc-100 border-t border-zinc-300 flex justify-between items-center print:hidden shrink-0">
                        <button
                            onClick={() => setIsReportOpen(false)}
                            className="flex items-center gap-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-4 py-2 rounded font-bold text-sm tracking-wide transition-colors"
                        >
                            <X className="w-4 h-4" />
                            CLOSE
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-900 text-white px-6 py-2 rounded font-bold text-sm tracking-wide transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                SAVE REPORT (PDF)
                            </button>
                        </div>
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
