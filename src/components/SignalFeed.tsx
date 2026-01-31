"use client";

import { useState } from "react";
import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { type Incident } from "@/lib/types"; // Restored
import { motion, AnimatePresence } from "framer-motion";
import {
    Mic, Video, FileText, Radio, // Restored Mic, FileText, Video
    MapPin, Play, ExternalLink, // Restored ExternalLink
    ChevronDown, ChevronUp, AlertCircle, // Restored Chevrons
    Activity, Send, Loader2, // Restored Send, Loader2
    CheckCircle2,
    Volume2,
    Shield,
    Clock,
    Users,
    Maximize2,
    Pause,
    AlertTriangle // Kept new import
} from "lucide-react";
import { CommanderControls } from "./CommanderControls";

const getPriorityColor = (p?: string) => {
    switch (p) {
        case "CRITICAL": return "border-red-500/50 bg-red-500/10 text-red-400";
        case "HIGH": return "border-orange-500/50 bg-orange-500/10 text-orange-400";
        case "MEDIUM": return "border-yellow-500/50 bg-yellow-500/10 text-yellow-400";
        case "LOW": return "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
        default: return "border-cyan-500/50 bg-cyan-500/10 text-cyan-400";
    }
};

const getTypeIcon = (type: string) => {
    switch (type) {
        case "AUDIO": return <Mic className="w-4 h-4" />;
        case "VIDEO": return <Video className="w-4 h-4" />;
        case "TEXT": return <FileText className="w-4 h-4" />;
        default: return <Radio className="w-4 h-4" />;
    }
};

export function SignalFeed({ className }: { className?: string }) {
    // Subscribe to specific slices for better reactivity
    const incidents = useSimulationStore(state => state.incidents);
    const time = useSimulationStore(state => state.time);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<"video" | "audio" | "image" | null>(null);
    const [analysisExpandedMap, setAnalysisExpandedMap] = useState<Record<string, boolean>>({});

    // Live injection state
    const [liveInput, setLiveInput] = useState("");
    const [isInjecting, setIsInjecting] = useState(false);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const toggleAnalysis = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAnalysisExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleNavigate = (e: React.MouseEvent, incident: Incident) => {
        e.stopPropagation();
        // Allow navigation if location exists OR if it's a manual trace (which falls back to metadata/0)
        if ((incident.location && typeof incident.location.lat === 'number') || incident.manual_trace_required) {
            // Navigation logic connected to map via store
            if (useSimulationStore.getState().setFocusedIncidentId) {
                useSimulationStore.getState().setFocusedIncidentId(incident.id);
            }
            console.log("Navigating to", incident.location);
        }
    };

    const handleOpenMedia = (e: React.MouseEvent, incident: Incident) => {
        e.stopPropagation();
        const url = incident.raw_input;
        // Basic detection
        if (incident.type === "VIDEO") setMediaType("video");
        else if (incident.type === "AUDIO") setMediaType("audio");
        else setMediaType("image");

        setMediaUrl(url);
    };

    /**
     * Inject a live signal into the system for real-time AI processing.
     * This proves the system works with live input, not just simulation JSON.
     */
    const handleInjectSignal = async () => {
        if (!liveInput.trim() || isInjecting) return;

        setIsInjecting(true);
        const timestamp = Date.now();

        // Create new incident with live input
        const newIncident: Incident = {
            id: `LIVE-${timestamp}`,
            type: "TEXT",
            raw_input: liveInput.trim(),
            timestamp: new Date().toISOString(),
            location: {
                lat: 40.7128 + (Math.random() - 0.5) * 0.1, // Random NYC area
                lng: -74.0060 + (Math.random() - 0.5) * 0.1,
                address: "Live Injection - Location TBD"
            },
            status: "PENDING",
            description_for_simulation: "User-injected live signal for testing"
        };

        // Add to store immediately as PENDING
        useSimulationStore.getState().addIncident(newIncident);
        useSimulationStore.getState().addLog(`[${time}s] [LIVE] 📡 Live signal injected: ${newIncident.id}`);

        try {
            // Call the coordinator agent for real AI processing
            const { coordinateIncident } = await import("@/agents/coordinator");
            const processedIncident = await coordinateIncident(newIncident);

            // Update the incident with AI analysis
            useSimulationStore.getState().updateIncident(newIncident.id, processedIncident);
            useSimulationStore.getState().addLog(`[${time}s] [LIVE] ✅ AI Analysis complete for ${newIncident.id}`);

            // Clear input on success
            setLiveInput("");
        } catch (error: any) {
            console.error("[LIVE INJECTION] Error:", error);
            useSimulationStore.getState().updateIncident(newIncident.id, {
                status: "TRIAGED",
                priority: "HIGH",
                reasoning_trace: `Error during AI processing: ${error.message}. Flagged for manual review.`
            });
            useSimulationStore.getState().addLog(`[${time}s] [LIVE] ⚠️ Error processing ${newIncident.id}: ${error.message}`);
        } finally {
            setIsInjecting(false);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden", className)}>
            {/* Header */}
            <div className="p-5 border-b border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-900 to-black">
                <h3 className="text-zinc-100 font-bold uppercase tracking-widest text-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Activity className="w-5 h-5 text-red-500 relative z-10" />
                            <div className="absolute inset-0 bg-red-500/20 blur-lg animate-pulse" />
                        </div>
                        <span className="text-shadow-sm">Inbound Signals</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] font-mono text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                            {incidents.length} ACTIVE
                        </span>
                    </div>
                </h3>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20 scrollbar-thin scrollbar-thumb-zinc-800 min-h-0">
                {incidents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-50">
                        <div className="w-20 h-20 rounded-full border border-zinc-800 bg-zinc-900/50 flex items-center justify-center mb-6">
                            <Radio className="w-8 h-8 text-zinc-600 animate-pulse" />
                        </div>
                        <span className="text-zinc-500 text-sm font-mono tracking-widest">MONITORING FREQUENCIES...</span>
                        <span className="text-zinc-600 text-xs mt-2">Awaiting distress signals</span>
                    </div>
                )}
                {[...incidents].reverse().map((incident, index) => {
                    const isExpanded = expandedId === incident.id;
                    const cleanRawInput = incident.raw_input.split('/').pop() || incident.raw_input;
                    const hasLocation = !!(incident.location && typeof incident.location.lat === 'number' && incident.location.lat !== 0);

                    return (
                        <div
                            key={incident.id}
                            onClick={() => incident.status !== "PENDING" && toggleExpand(incident.id)}
                            className={cn(
                                "rounded-xl border relative group transition-all duration-300 overflow-hidden",
                                incident.status === "PENDING" ? "cursor-default opacity-80" : "cursor-pointer",
                                getPriorityColor(incident.priority),
                                isExpanded
                                    ? "bg-opacity-20 ring-1 ring-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] my-2"
                                    : "hover:scale-[1.01] hover:bg-white/[0.02]",
                                index === 0 && incident.status === "PENDING" && "ring-1 ring-cyan-500/50 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                            )}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className={cn("p-4 transition-all duration-300", isExpanded ? "pb-2" : "")}>
                                {/* Header - Flex Row for Better Spacing */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                                            isExpanded ? "bg-white/10 border-white/20" : "bg-black/20 border-white/5"
                                        )}>
                                            {getTypeIcon(incident.type)}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm text-zinc-200 block tracking-wide">{incident.id}</span>
                                            <span className="text-zinc-500 text-[11px] font-mono mt-0.5 block flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {new Date(incident.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex items-center">
                                        <div className="flex items-center">
                                            {incident.status === "PENDING" ? (
                                                <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                                    <span className="text-[10px] text-zinc-400 font-mono font-bold tracking-wider">QUEUED</span>
                                                </div>
                                            ) : incident.status === "ANALYZING" ? (
                                                <div className="flex items-center gap-2 bg-cyan-500/5 border border-cyan-500/20 px-2 py-1 rounded-full">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                                                    <span className="text-[10px] text-cyan-400 font-mono font-bold tracking-wider">ANALYZING</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 pl-2">
                                                    <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        TRIAGED
                                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 opacity-50" />}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Content Preview */}
                                {!isExpanded && (
                                    <div className="pl-[3.25rem] mb-3">
                                        <div className={cn(
                                            "font-mono text-xs leading-relaxed text-zinc-400/90 line-clamp-2",
                                            incident.priority === "CRITICAL" && "text-red-200/80"
                                        )}>
                                            <span className="font-bold text-zinc-500 mr-2 uppercase text-[10px] tracking-wider">Payload:</span>
                                            {cleanRawInput}
                                        </div>
                                    </div>
                                )}

                                {/* Footer Tags - Improved Spacing & Layout */}
                                <div className={cn("flex items-center gap-2 flex-wrap", !isExpanded && "pl-[3.25rem]")}>
                                    {/* Priority Badge - Always Visible */}
                                    {incident.priority && (
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border",
                                            incident.priority === "CRITICAL" ? "bg-red-500/20 text-red-200 border-red-500/30 shadow-[0_0_10px_rgba(220,38,38,0.2)]" :
                                                incident.priority === "HIGH" ? "bg-orange-500/20 text-orange-200 border-orange-500/30" :
                                                    incident.priority === "MEDIUM" ? "bg-yellow-500/10 text-yellow-200 border-yellow-500/20" :
                                                        "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                        )}>
                                            {incident.priority}
                                        </span>
                                    )}

                                    {/* Detailed Tags - Only show critical ones collapsed, all expanded */}
                                    {incident.manual_trace_required && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-red-600/10 text-red-400 border border-red-500/30 animate-pulse flex items-center gap-1.5 whitespace-nowrap">
                                            <AlertCircle className="w-3 h-3" />
                                            UNKNOWN LOCATION
                                        </span>
                                    )}

                                    {incident.location_ambiguity && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 animate-pulse">
                                            <AlertTriangle className="w-3 h-3" />
                                            Conflict
                                        </span>
                                    )}

                                    {/* Action Required Badge */}
                                    {incident.requires_human_auth && incident.auth_status === "PENDING" && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-amber-500 text-black animate-pulse flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                                            AUTH REQ
                                        </span>
                                    )}

                                    {/* Compact Asset Count */}
                                    {incident.assigned_assets && incident.assigned_assets.length > 0 && (
                                        <div className="flex gap-1 ml-auto">
                                            <div className="flex -space-x-1">
                                                {incident.assigned_assets.slice(0, 3).map((asset, i) => (
                                                    <div key={i} className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center relative z-10" title={asset}>
                                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full opacity-70" />
                                                    </div>
                                                ))}
                                                {incident.assigned_assets.length > 3 && (
                                                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px] text-zinc-400 relative z-0">
                                                        +{incident.assigned_assets.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* EXPANDED CONTENT DRAWER */}
                            {isExpanded && (
                                <div className="border-t border-white/5 bg-black/20 p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">

                                    {/* Actions Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {(hasLocation && !incident.manual_trace_required) && incident.status !== "PENDING" && (
                                            <button
                                                onClick={(e) => handleNavigate(e, incident)}
                                                className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 py-2.5 rounded-lg text-xs font-bold transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                            >
                                                <MapPin className="w-3.5 h-3.5" />
                                                LOCATE ON MAP
                                            </button>
                                        )}

                                        {(incident.type === "AUDIO" || incident.type === "VIDEO") && (
                                            <button
                                                onClick={(e) => handleOpenMedia(e, incident)}
                                                className="flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/50 py-2.5 rounded-lg text-xs font-bold transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                                PLAY MEDIA
                                            </button>
                                        )}
                                    </div>

                                    {/* Incident-Specific Voice Override (Moved Up) */}
                                    <div className="pt-1">
                                        <CommanderControls incidentContext={incident} className="w-full justify-center" />
                                    </div>

                                    {/* Location Info Card */}
                                    {hasLocation && (
                                        <div className={cn(
                                            "p-3 rounded-lg border text-xs font-mono flex items-start gap-3 relative overflow-hidden",
                                            incident.location_ambiguity ? "bg-orange-500/5 border-orange-500/20 text-orange-300" : "bg-zinc-900/40 border-white/5 text-zinc-300"
                                        )}>
                                            <div className={cn(
                                                "w-8 h-8 rounded-md flex items-center justify-center shrink-0 border",
                                                incident.location_ambiguity ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-white/5 border-white/10 text-zinc-400"
                                            )}>
                                                <MapPin className={cn("w-4 h-4", incident.location_ambiguity && "animate-pulse")} />
                                            </div>
                                            <div>
                                                <span className="block font-bold text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                                                    {incident.location_ambiguity ? "CONFIRMED TARGET (GPS OVERRIDE)" : "INCIDENT LOCATION"}
                                                </span>
                                                <span className="text-white/90 font-sans tracking-wide">
                                                    {incident.location?.address}
                                                </span>
                                                <div className="text-[10px] opacity-50 mt-0.5 font-mono">
                                                    {(incident.location?.lat === 0 && incident.location?.lng === 0)
                                                        ? "GPS: SIGNAL LOST / UNRESOLVED"
                                                        : `GPS: ${incident.location?.lat.toFixed(6)}, ${incident.location?.lng.toFixed(6)}`
                                                    }
                                                </div>
                                            </div>
                                            {/* Decorative grid pattern */}
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-white/5 pointer-events-none" />
                                        </div>
                                    )}

                                    {/* Data/Analysis Sections */}
                                    <div className="space-y-3">
                                        <div className="bg-black/30 p-3 rounded-lg text-[11px] font-mono border border-white/5">
                                            <span className="text-zinc-500 block mb-1.5 text-[10px] uppercase tracking-widest font-bold">RAW PAYLOAD</span>
                                            <div className="text-zinc-300 whitespace-pre-wrap max-h-[100px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                                                {incident.raw_input}
                                            </div>
                                        </div>

                                        {incident.reasoning_trace && (
                                            <div className="bg-gradient-to-br from-cyan-900/10 to-black/30 p-3 rounded-lg text-[11px] font-mono border border-cyan-500/10 shadow-inner">
                                                <span className="text-cyan-500/70 block mb-1.5 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
                                                    <Activity className="w-3 h-3" />
                                                    AI Analysis Trace
                                                </span>
                                                <div className={cn(
                                                    "opacity-90 leading-relaxed text-cyan-100/80 transition-all duration-300",
                                                    !analysisExpandedMap[incident.id] ? "line-clamp-4" : ""
                                                )}>
                                                    {incident.reasoning_trace}
                                                </div>
                                                {incident.reasoning_trace.length > 150 && (
                                                    <button
                                                        onClick={(e) => toggleAnalysis(incident.id, e)}
                                                        className="mt-2 text-[10px] font-bold text-cyan-500/60 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                                                    >
                                                        {analysisExpandedMap[incident.id] ? (
                                                            <>Show Less <ChevronUp className="w-3 h-3" /></>
                                                        ) : (
                                                            <>Read More <ChevronDown className="w-3 h-3" /></>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {incident.assigned_assets && incident.assigned_assets.length > 0 && (
                                            <div className="bg-emerald-900/10 border border-emerald-500/10 p-3 rounded-lg text-[11px] font-mono">
                                                <span className="text-emerald-500/70 font-bold block mb-2 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                                    <Shield className="w-3 h-3" />
                                                    Deployed Assets
                                                </span>
                                                <div className="flex flex-wrap gap-2">
                                                    {incident.assigned_assets.map((asset, i) => (
                                                        <span key={i} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded font-bold uppercase text-[9px] shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                                            {asset}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* PROTOCOL ZERO: Human Authorization Gate */}
                                        {incident.requires_human_auth && incident.auth_status === "PENDING" && (
                                            <div className="border border-amber-500/50 bg-amber-500/5 rounded-xl p-4 animate-pulse-slow mt-4 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-amber-500/5 rotate-45 scale-150 animate-[pulse-fast_3s_infinite]" />

                                                <div className="relative z-10">
                                                    <div className="flex items-center gap-3 mb-3 text-amber-500">
                                                        <div className="relative flex shrink-0 w-4 h-4">
                                                            <div className="w-full h-full rounded-full bg-amber-500 animate-ping absolute opacity-75" />
                                                            <div className="w-full h-full rounded-full bg-amber-500 relative shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                                                        </div>
                                                        <span className="text-xs font-black uppercase tracking-widest font-mono">Protocol Zero: Authorization Required</span>
                                                    </div>

                                                    <p className="text-xs text-amber-100/90 mb-4 font-mono leading-relaxed pl-7">
                                                        High-stakes decision flag. System holding for human consensus.
                                                        Auto-approval sequence initiated...
                                                    </p>

                                                    {/* Countdown Bar with Timer */}
                                                    {incident.auth_timeout_at && (
                                                        <div className="pl-7 mb-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-[10px] font-mono text-amber-400">AUTO-APPROVE IN:</span>
                                                                <span className="text-lg font-mono font-bold text-amber-500 tabular-nums">
                                                                    {Math.max(0, incident.auth_timeout_at - time)}s
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-amber-500/30">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                                                    style={{
                                                                        width: `${Math.max(0, Math.min(100, ((incident.auth_timeout_at - time) / 30) * 100))}%`,
                                                                        transition: 'none'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-3 pl-7">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                useSimulationStore.getState().updateIncident(incident.id, {
                                                                    auth_status: "DENIED",
                                                                    status: "RESOLVED",
                                                                    reasoning_trace: (incident.reasoning_trace || "") + " [DENIED BY HUMAN OPERATOR]"
                                                                });
                                                                useSimulationStore.getState().addLog(`[${time}s] [PROTOCOL ZERO] 🛑 Action DENIED by Commander for ${incident.id}`);
                                                            }}
                                                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                                        >
                                                            Deny Action
                                                        </button>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                useSimulationStore.getState().updateIncident(incident.id, {
                                                                    auth_status: "APPROVED",
                                                                    reasoning_trace: (incident.reasoning_trace || "") + " [AUTHORIZED BY HUMAN OPERATOR]"
                                                                });
                                                                useSimulationStore.getState().addLog(`[${time}s] [PROTOCOL ZERO] ✅ Action APPROVED by Commander for ${incident.id}`);

                                                                const isMockMode = useSimulationStore.getState().isMockMode;
                                                                if (isMockMode) {
                                                                    const { MOCK_RESPONSES } = await import("@/simulation/mock_responses");
                                                                    const mock = MOCK_RESPONSES[incident.id];
                                                                    setTimeout(() => {
                                                                        useSimulationStore.getState().updateIncident(incident.id, {
                                                                            ...mock,
                                                                            auth_status: "APPROVED",
                                                                            status: "TRIAGED"
                                                                        });
                                                                    }, 1000);
                                                                } else {
                                                                    const { coordinateIncident } = await import("@/agents/coordinator");
                                                                    coordinateIncident({ ...incident, auth_status: "APPROVED" })
                                                                        .then(processed => useSimulationStore.getState().updateIncident(incident.id, processed));
                                                                }
                                                            }}
                                                            className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                                        >
                                                            Authorize
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Status Stamps for Auth */}
                                        {incident.auth_status === "APPROVED" && (
                                            <div className="text-center py-2 mt-4 border-t border-emerald-500/20 bg-emerald-500/5 rounded-lg">
                                                <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    AUTHORIZED EXECUTION
                                                </span>
                                            </div>
                                        )}
                                        {incident.auth_status === "DENIED" && (
                                            <div className="text-center py-2 mt-4 border-t border-red-500/20 bg-red-500/5 rounded-lg">
                                                <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    EXECUTION HALTED
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Media Modal Overlay */}
            {
                mediaUrl && (
                    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 w-full max-w-3xl shadow-2xl relative">
                            <button
                                onClick={() => setMediaUrl(null)}
                                className="absolute top-2 right-2 p-2 bg-zinc-900 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="mt-6 flex flex-col items-center">
                                {mediaType === "video" && (
                                    <video controls autoPlay className="w-full h-auto max-h-[70vh] rounded-lg border border-zinc-800">
                                        <source src={mediaUrl || undefined} />
                                        Your browser does not support the video tag.
                                    </video>
                                )}
                                {mediaType === "audio" && (
                                    <div className="w-full p-10 bg-zinc-900/50 rounded-lg flex flex-col items-center gap-4">
                                        <Mic className="w-16 h-16 text-zinc-700 animate-pulse" />
                                        <audio controls autoPlay className="w-full">
                                            <source src={mediaUrl || undefined} />
                                            Your browser does not support the audio element.
                                        </audio>
                                    </div>
                                )}
                                <p className="mt-4 text-xs font-mono text-zinc-500 break-all">{mediaUrl}</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
