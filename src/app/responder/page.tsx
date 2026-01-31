"use client";

import React, { useState, useEffect } from "react";
import { useSimulationStore } from "@/lib/store";
import {
    CheckCircle2,
    ShieldAlert,
    Waves,
    Plane,
    Truck,
    MapPin,
    AlertTriangle,
    Info,
    Crosshair,
    Navigation,
    Clock,
    UserPlus,
    Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type AssetRole = "AIR" | "MARINE" | "GROUND";

export default function ResponderPage() {
    const { incidents } = useSimulationStore();
    const [activeRole, setActiveRole] = useState<AssetRole>("MARINE");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [hasMounted, setHasMounted] = useState(false);

    // Initial mount check to prevent hydration mismatch
    useEffect(() => {
        setHasMounted(true);
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Intelligent Filtering: Only show TRIAGED incidents that match the active role
    const filteredIncidents = incidents.filter(incident => {
        // Critical: Voice of God / Command Overrides must ALWAYS act as a global broadcast
        if (incident.type === "COMMAND" || incident.is_override || incident.category === "COMMAND_OVERRIDE") {
            return incident.status !== "PENDING";
        }

        if (incident.status === "PENDING") return false;
        return incident.required_asset === activeRole;
    });

    const pendingCount = filteredIncidents.filter(i => i.status !== "RESOLVED").length;
    const totalProcessed = incidents.filter(i => i.status !== "PENDING").length;

    // Return null or placeholder during hydration to prevent mismatch
    if (!hasMounted) return <div className="min-h-screen bg-zinc-950" />;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* Tactical Overlays */}
            <div className="fixed inset-0 pointer-events-none z-50">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />
                <div className="absolute inset-0 bg-zinc-950 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] opacity-60" />
            </div>

            {/* Top Bar / Status */}
            <div className="bg-zinc-950 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-[10px] font-mono tracking-widest text-emerald-500/60 uppercase">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                        SYSTEM: OPERATIONAL
                    </span>
                    <span className="hidden sm:inline">OS: AEGIS-TACTICAL-V2.1</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>{currentTime.toLocaleTimeString()}</span>
                    <span className="text-zinc-600">INCIDENTS: {incidents.length}</span>
                </div>
            </div>

            {/* Main Cockpit Header */}
            <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 p-4 shadow-2xl">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <ShieldAlert className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tighter text-white flex items-center gap-2">
                                AEGIS <span className="text-emerald-500">RESPONDER</span>
                            </h1>
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Autonomous Triage Network</p>
                        </div>
                    </div>

                    {/* Role Selector Dashboard Style */}
                    <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 backdrop-blur-sm self-start">
                        <RoleTab
                            role="AIR"
                            icon={Plane}
                            isActive={activeRole === "AIR"}
                            onClick={() => setActiveRole("AIR")}
                            color="cyan"
                        />
                        <RoleTab
                            role="MARINE"
                            icon={Waves}
                            isActive={activeRole === "MARINE"}
                            onClick={() => setActiveRole("MARINE")}
                            color="blue"
                        />
                        <RoleTab
                            role="GROUND"
                            icon={Truck}
                            isActive={activeRole === "GROUND"}
                            onClick={() => setActiveRole("GROUND")}
                            color="emerald"
                        />
                    </div>
                </div>
            </header>

            {/* Tactical Grid Body */}
            <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 relative z-10">
                <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
                    <div className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-2">
                        <Activity className="w-3 h-3 text-emerald-500" />
                        Unit Identification: {activeRole}-DELTA-01
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
                    <div className="text-xs font-mono font-bold text-white bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                        PENDING: {pendingCount}
                    </div>
                </div>

                {filteredIncidents.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-zinc-900 rounded-3xl"
                    >
                        <CheckCircle2 className="w-16 h-16 text-zinc-800 mb-4" />
                        <h2 className="text-zinc-600 font-mono uppercase tracking-[0.2em] text-sm">Standby Area Clear</h2>
                        <p className="text-zinc-700 text-[10px] mt-2 italic px-8 text-center">Monitoring high-priority distress signals across decentralized nodes...</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredIncidents.map((incident) => (
                                <IncidentTacticalCard key={incident.id} incident={incident} activeRole={activeRole} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* Bottom System Info */}
            <footer className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-900 p-2 text-center pointer-events-none">
                <p className="text-[8px] font-mono text-zinc-700 uppercase tracking-[0.3em]">
                    End-to-End Encryption Enabled | Protocol Zero Active | Gemini Logic Core
                </p>
            </footer>
        </div>
    );
}

function RoleTab({ role, icon: Icon, isActive, onClick, color }: any) {
    const colorMap: any = {
        cyan: "active:bg-cyan-500/20 text-cyan-400 border-cyan-500/20",
        blue: "active:bg-blue-500/20 text-blue-400 border-blue-500/20",
        emerald: "active:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300",
                isActive
                    ? `bg-zinc-800 border ${colorMap[color]} shadow-[0_0_20px_rgba(0,0,0,0.5)]`
                    : "text-zinc-500 hover:text-zinc-300"
            )}
        >
            <Icon className={cn("w-4 h-4", isActive ? "" : "opacity-40")} />
            <span className="hidden sm:inline uppercase tracking-widest">{role}</span>
        </button>
    );
}

function IncidentTacticalCard({ incident, activeRole }: { incident: any; activeRole: string }) {
    const { updateIncident, addLog, showNotification, time } = useSimulationStore();

    const isAcknowledged = incident.responder_status === "ACKNOWLEDGED" || incident.responder_status === "EN_ROUTE" || incident.responder_status === "ON_SCENE";
    const isBackupRequested = incident.backup_requested === true;

    const handleAcknowledge = (e: React.MouseEvent) => {
        e.stopPropagation();
        const unitId = `${activeRole}-DELTA-01`;

        updateIncident(incident.id, {
            responder_status: "ACKNOWLEDGED",
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: unitId,
        });

        addLog(`[${time}s] [RESPONDER] ✓ Unit ${unitId} acknowledged ${incident.id}`);
        showNotification(`Incident ${incident.id} acknowledged. You are now en-route.`, "success");
    };

    const handleBackup = (e: React.MouseEvent) => {
        e.stopPropagation();
        const unitId = `${activeRole}-DELTA-01`;

        updateIncident(incident.id, {
            backup_requested: true,
            backup_requested_at: new Date().toISOString(),
        });

        addLog(`[${time}s] [RESPONDER] 🚨 Backup requested for ${incident.id} by ${unitId}`);
        showNotification(`Backup request sent for ${incident.id}`, "info");
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -20 }}
            className={cn(
                "group relative bg-[#0a0a0b] border rounded-2xl overflow-hidden transition-all duration-500 shadow-xl",
                isAcknowledged
                    ? "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                    : "border-zinc-800 hover:border-emerald-500/40"
            )}
        >
            {/* Tactical Accents */}
            <div className="absolute top-0 right-0 p-1">
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                    <div className="w-1 h-3 bg-zinc-800 rounded-full" />
                </div>
            </div>

            {/* Header: Priority & GPS */}
            <div className="p-4 border-b border-zinc-800/50 bg-gradient-to-r from-zinc-900/50 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        incident.priority === "CRITICAL" ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" :
                            incident.priority === "HIGH" ? "bg-orange-500" : "bg-emerald-500"
                    )} />
                    <div className="flex flex-col">
                        <span className={cn(
                            "text-[10px] font-black tracking-[0.2em] uppercase font-mono",
                            incident.priority === "CRITICAL" ? "text-red-500" : "text-zinc-400"
                        )}>
                            {incident.priority || "NORMAL"} UNIT REQ
                        </span>
                        {isBackupRequested && (
                            <span className="text-[8px] font-bold text-amber-500 flex items-center gap-1 animate-pulse mt-0.5">
                                <span className="w-1 h-1 rounded-full bg-amber-500" />
                                BACKUP PENDING
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-600 font-mono text-[9px] uppercase">
                    <Crosshair className="w-3 h-3" />
                    ID: {incident.id.split('-').pop()}
                </div>
            </div>

            <div className="p-5 space-y-5">
                {/* Visual Target Info */}
                <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                        <h3 className="text-lg font-bold text-white tracking-tight leading-none group-hover:text-emerald-400 transition-colors">
                            {incident.category || "General Incident"}
                        </h3>
                        <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                            <MapPin className="w-3 h-3 text-red-500/50" />
                            <span className="truncate">{incident.extracted_address || incident.location.address || "Sector Unknown"}</span>
                        </div>
                    </div>
                    {/* GPS Coordinates Box - Now Interactive */}
                    <a
                        href={`https://www.google.com/maps?q=${incident.location.lat},${incident.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-zinc-900/80 border border-zinc-800 px-3 py-2 rounded-lg font-mono text-center flex flex-col justify-center hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all group/gps cursor-pointer"
                        title="OPEN TACTICAL OVERLAY (MAPS)"
                    >
                        <span className="text-[8px] text-zinc-600 uppercase block mb-0.5 tracking-tighter group-hover/gps:text-emerald-500 transition-colors flex items-center gap-1 justify-center">
                            <Navigation className="w-2 h-2" /> GPS Target
                        </span>
                        <span className="text-[10px] text-emerald-500 font-bold tabular-nums">
                            {incident.location.lat.toFixed(4)}N
                        </span>
                        <span className="text-[10px] text-emerald-500 font-bold tabular-nums">
                            {incident.location.lng.toFixed(4)}E
                        </span>
                    </a>
                </div>

                {/* Intelligence Matrix Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <IntelItem
                        icon={AlertTriangle}
                        label="Structural"
                        value={incident.structural_damage || "Unknown"}
                        status={incident.structural_damage?.includes("SEVERE") ? "danger" : "normal"}
                    />
                    <IntelItem
                        icon={Waves}
                        label="Flood Level"
                        value={incident.flood_level || "No Data"}
                        status={incident.flood_level?.includes("ft") ? "warning" : "normal"}
                    />
                    <IntelItem
                        icon={Activity}
                        label="Safety"
                        value={incident.people_safety || "Scanning..."}
                        status={incident.people_safety?.includes("TRAPPED") ? "danger" : "normal"}
                    />
                    <IntelItem
                        icon={Clock}
                        label="Responder"
                        value={isAcknowledged ? "EN-ROUTE" : "AWAITING"}
                        status={isAcknowledged ? "success" : "normal"}
                    />
                </div>

                {/* Grounding Source Info */}
                {incident.grounding_queries && incident.grounding_queries.length > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rotate-45 translate-x-10 -translate-y-10" />
                        <div className="flex items-center gap-2 mb-2">
                            <Navigation className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Verified Intelligence</span>
                        </div>
                        <ul className="space-y-1.5">
                            {incident.grounding_queries.slice(0, 2).map((q: string, i: number) => (
                                <li key={i} className="text-[10px] text-zinc-500 flex items-start gap-2">
                                    <span className="mt-1 w-1 h-1 bg-emerald-500/40 rounded-full" />
                                    <span className="italic leading-normal">"{q}"</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Acknowledged Info */}
                {isAcknowledged && incident.acknowledged_at && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Acknowledged</span>
                        </div>
                        <div className="mt-1 text-[9px] text-zinc-500 font-mono">
                            By: {incident.acknowledged_by} | {new Date(incident.acknowledged_at).toLocaleTimeString()}
                        </div>
                    </div>
                )}

                {/* Tactical Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                        onClick={handleBackup}
                        disabled={isBackupRequested}
                        className={cn(
                            "flex-1 py-3 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all border flex items-center justify-center gap-2",
                            isBackupRequested
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30 cursor-not-allowed"
                                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800"
                        )}
                    >
                        <UserPlus className="w-3 h-3" />
                        {isBackupRequested ? "Requested" : "Backup"}
                    </button>
                    <button
                        onClick={handleAcknowledge}
                        disabled={isAcknowledged}
                        className={cn(
                            "flex-1 py-3 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                            isAcknowledged
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_5px_15px_rgba(16,185,129,0.2)]"
                        )}
                    >
                        <CheckCircle2 className="w-3 h-3" />
                        {isAcknowledged ? "En-Route" : "Acknowledge"}
                    </button>
                </div>
            </div>

            {/* Progress Bar Detail */}
            <div className={cn(
                "h-0.5 w-full transition-colors",
                isAcknowledged ? "bg-emerald-500/30" : "bg-zinc-900 group-hover:bg-emerald-500/20"
            )}>
                <div className={cn(
                    "h-full w-full",
                    isAcknowledged ? "bg-emerald-500" : "bg-emerald-500 w-[60%] animate-pulse"
                )} />
            </div>
        </motion.div>
    );
}

function IntelItem({ icon: Icon, label, value, status }: any) {
    const statusColor = status === "danger" ? "text-red-400 border-red-500/20" :
        status === "warning" ? "text-orange-400 border-orange-500/20" :
            status === "success" ? "text-emerald-400 border-emerald-500/20" :
                "text-zinc-300 border-zinc-800";

    return (
        <div className={cn("bg-zinc-900/30 border p-2 rounded-lg", statusColor)}>
            <div className="flex items-center gap-1.5 opacity-50 mb-0.5">
                <Icon className="w-2.5 h-2.5" />
                <span className="text-[8px] uppercase font-mono">{label}</span>
            </div>
            <div className="text-[10px] font-bold truncate tracking-tight">{value}</div>
        </div>
    );
}
