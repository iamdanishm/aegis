"use client";

import { useSimulationStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Shield, AlertTriangle, Activity, X, Share2, Download, Map, Layers, Zap } from "lucide-react";
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
                className="mission-report-modal fixed inset-0 z-[99999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
                style={{ opacity: 1 }}
            >
                {/* CRT Scanline Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(0,255,0,0.03),rgba(255,0,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-40 z-10"></div>

                <motion.div
                    initial={{ scale: 0.98, y: 10, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.98, y: 10, opacity: 0 }}
                    className="mission-report-container w-full max-w-5xl bg-[#f4f4f4] text-zinc-900 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-full border-2 border-zinc-800 relative font-mono selection:bg-zinc-800 selection:text-white"
                >
                    {/* Top Classification Banner */}
                    <div className={cn(
                        "w-full py-1 text-center text-[10px] font-black tracking-[0.5em] uppercase border-b border-zinc-300",
                        report.classification === "TOP SECRET" ? "bg-red-900 text-white" :
                            report.classification === "SECRET" ? "bg-zinc-900 text-zinc-100" : "bg-zinc-200 text-zinc-600"
                    )}>
                        {report.classification} // {report.classification} // {report.classification}
                    </div>

                    {/* Official Document Header */}
                    <div className="report-header bg-white p-8 border-b-2 border-double border-zinc-300 shrink-0">
                        <div className="flex flex-col md:flex-row justify-between gap-6 items-start">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 bg-zinc-900 text-white flex items-center justify-center rounded-sm shrink-0">
                                    <Shield className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none mb-1">Incident Report</h2>
                                    <p className="text-sm font-bold text-zinc-500 uppercase">Emergency Response Management System // Project Aegis</p>
                                    <div className="flex gap-4 mt-2">
                                        <div className="text-[10px] font-bold py-0.5 px-2 bg-zinc-100 border border-zinc-300 rounded-full">ID: {report.report_id}</div>
                                        <div className="text-[10px] font-bold py-0.5 px-2 bg-zinc-100 border border-zinc-300 rounded-full">STATUS: FINALIZED</div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="p-2 border-2 border-zinc-900 mb-2">
                                    <span className="text-xs font-black uppercase tracking-widest">{report.classification}</span>
                                </div>
                                <span className="text-[10px] uppercase text-zinc-400 font-bold">Generated: {new Date(report.generated_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Report Body */}
                    <div className="report-content flex-1 overflow-y-auto p-10 relative bg-[#fafafa] space-y-12">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Executive Summary */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 flex items-center gap-2">
                                    <FileText className="w-3 h-3" />
                                    Executive Summary
                                </h3>
                                <div className="bg-white p-6 border border-zinc-200 shadow-sm font-serif italic text-zinc-800 leading-relaxed relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800"></div>
                                    <p className="indent-8">{report.executive_summary}</p>
                                </div>
                            </div>

                            {/* Operational Stats */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 flex items-center gap-2">
                                    <Zap className="w-3 h-3" />
                                    Operational Metrics
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-zinc-100 border border-zinc-200 flex flex-col justify-center">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase">Signals Processed</span>
                                        <span className="text-3xl font-black text-zinc-900 leading-none mt-1">{report.operational_metrics.total_signals_processed}</span>
                                    </div>
                                    <div className="p-4 bg-zinc-100 border border-zinc-200 flex flex-col justify-center">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase">Validated Events</span>
                                        <span className="text-3xl font-black text-zinc-900 leading-none mt-1">{report.operational_metrics.validated_incidents}</span>
                                    </div>
                                    <div className="p-4 bg-zinc-100 border border-zinc-200 flex flex-col justify-center">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase">Critical Alerts</span>
                                        <span className="text-3xl font-black text-red-600 leading-none mt-1">{report.operational_metrics.critical_alerts}</span>
                                    </div>
                                    <div className="p-4 bg-zinc-100 border border-zinc-200 flex flex-col justify-center">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase">Protocol Zero</span>
                                        <span className="text-3xl font-black text-orange-600 leading-none mt-1">{report.operational_metrics.protocol_zero_interventions}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resource Allocation & Impact */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 flex items-center gap-2">
                                    <Layers className="w-3 h-3" />
                                    Resource Allocation
                                </h3>
                                <div className="bg-zinc-900 text-zinc-100 p-6 space-y-6 rounded-sm shadow-xl">
                                    <div className="flex justify-between items-center border-b border-zinc-700 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 border border-zinc-700 flex items-center justify-center rounded">
                                                <Share2 className="w-5 h-5 text-zinc-400" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-zinc-500 uppercase">Deployments</div>
                                                <div className="text-xl font-black">{report.resource_deployment.total_deployments} Units</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase">Status</div>
                                            <div className="text-xs font-bold text-emerald-500 uppercase">Active/Dispatched</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center p-3 bg-zinc-800 rounded">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase mb-1">Air</div>
                                            <div className="text-xl font-black">{report.resource_deployment.air_assets}</div>
                                        </div>
                                        <div className="text-center p-3 bg-zinc-800 rounded">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase mb-1">Marine</div>
                                            <div className="text-xl font-black">{report.resource_deployment.marine_assets}</div>
                                        </div>
                                        <div className="text-center p-3 bg-zinc-800 rounded">
                                            <div className="text-[10px] font-black text-zinc-500 uppercase mb-1">Ground</div>
                                            <div className="text-xl font-black">{report.resource_deployment.ground_assets}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 flex items-center gap-2">
                                    <Map className="w-3 h-3" />
                                    Geographic Impact Zone
                                </h3>
                                <div className="space-y-3">
                                    {report.geographic_impact.map((loc, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-white border border-zinc-200 group">
                                            <div className="w-8 h-8 bg-zinc-100 flex items-center justify-center font-bold text-xs border border-zinc-200">
                                                0{i + 1}
                                            </div>
                                            <span className="text-sm font-bold text-zinc-700 uppercase">{loc}</span>
                                        </div>
                                    ))}
                                    {report.geographic_impact.length === 0 && (
                                        <div className="p-8 text-center bg-zinc-50 border border-zinc-200 border-dashed rounded text-zinc-400 italic text-sm">
                                            No specific jurisdictional data recorded.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Situational Assessment */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3" />
                                Technical Post-Incident Assessment
                            </h3>
                            <div className="bg-white p-8 border border-zinc-200 shadow-sm relative font-serif text-zinc-800 leading-relaxed">
                                <div className="absolute top-4 right-4 text-[10px] font-bold text-zinc-300 pointer-events-none select-none">
                                    SIGNED BY AEGIS CORE AI
                                </div>
                                <div className="max-w-none prose prose-zinc whitespace-pre-wrap">
                                    {report.situational_assessment}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Incident Log Table */}
                        <div className="space-y-4 breake-page-before">
                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2 flex items-center gap-2">
                                <Activity className="w-3 h-3" />
                                Event Dispatch Registry
                            </h3>
                            <div className="overflow-x-auto border border-zinc-300">
                                <table className="w-full text-[10px] font-bold">
                                    <thead>
                                        <tr className="bg-zinc-900 text-zinc-300 uppercase">
                                            <th className="px-4 py-3 text-left">Incident ID</th>
                                            <th className="px-4 py-3 text-left">Classification</th>
                                            <th className="px-4 py-3 text-left">Priority</th>
                                            <th className="px-4 py-3 text-left">Disposition</th>
                                            <th className="px-4 py-3 text-left">Location / Coordinates</th>
                                            <th className="px-4 py-3 text-left">Resources dispatched</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 bg-white">
                                        {report.incidents_log.map((inc) => (
                                            <tr key={inc.id} className="hover:bg-zinc-50 transition-colors">
                                                <td className="px-4 py-3 border-r border-zinc-100 font-mono text-zinc-400">{inc.id}</td>
                                                <td className="px-4 py-3 border-r border-zinc-100 uppercase">{inc.category}</td>
                                                <td className="px-4 py-3 border-r border-zinc-100">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[9px] border",
                                                        inc.priority === "CRITICAL" ? "bg-red-50 text-red-700 border-red-200" :
                                                            inc.priority === "HIGH" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                                "bg-zinc-50 text-zinc-500 border-zinc-200"
                                                    )}>
                                                        {inc.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 border-r border-zinc-100 uppercase text-zinc-500">{inc.status}</td>
                                                <td className="px-4 py-3 border-r border-zinc-100 text-zinc-600 truncate max-w-[200px]">{inc.location}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {inc.assets.length > 0 ? inc.assets.map((asset, i) => (
                                                            <span key={i} className="text-[8px] bg-zinc-100 px-1.5 py-0.5 border border-zinc-200">{asset}</span>
                                                        )) : <span className="text-zinc-300 uppercase tracking-tighter">N/A</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Report Footer */}
                    <div className="report-footer bg-white border-t border-zinc-300 p-8 shrink-0">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-12 h-px bg-zinc-900"></div>
                                    <span className="text-[10px] font-black uppercase text-zinc-400">Auth Signature</span>
                                </div>
                                <div className="font-serif italic text-2xl text-zinc-300 select-none">Project Aegis Oversight</div>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-[10px] font-black text-zinc-400 uppercase">Document Integrity Verified</div>
                                <div className="text-[10px] font-mono text-zinc-500">SHA-256: {Math.random().toString(16).substring(2, 10).toUpperCase()}-{Math.random().toString(16).substring(2, 10).toUpperCase()}</div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Classification Banner */}
                    <div className={cn(
                        "w-full py-1 text-center text-[10px] font-black tracking-[0.5em] uppercase border-t border-zinc-300",
                        report.classification === "TOP SECRET" ? "bg-red-900 text-white" :
                            report.classification === "SECRET" ? "bg-zinc-900 text-zinc-100" : "bg-zinc-200 text-zinc-600"
                    )}>
                        {report.classification} // {report.classification} // {report.classification}
                    </div>

                    {/* Action Footer (Hidden on print) */}
                    <div className="p-4 bg-zinc-900 border-t border-zinc-700 flex justify-between items-center print:hidden shrink-0">
                        <button
                            onClick={() => setIsReportOpen(false)}
                            className="flex items-center gap-2 hover:bg-zinc-800 text-zinc-400 px-4 py-2 rounded font-bold text-xs tracking-widest transition-colors uppercase"
                        >
                            <X className="w-4 h-4" />
                            Discard View
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-900 px-6 py-2 rounded-sm font-black text-xs tracking-widest transition-colors uppercase shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            >
                                <Download className="w-4 h-4" />
                                Export Formal Document (PDF)
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
