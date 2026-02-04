"use client";

import { useState } from "react";
import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { type Incident } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mic, Video, FileText, Radio,
    MapPin, Play,
    ChevronDown, ChevronUp, AlertCircle,
    Activity, Shield,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Users,
    Cpu,
    Target
} from "lucide-react";
import { CommanderControls } from "./CommanderControls";

const getPriorityStyles = (p?: string) => {
    switch (p) {
        case "CRITICAL": return {
            border: "border-red-500/50",
            bg: "bg-red-950/20",
            text: "text-red-400",
            indicator: "bg-red-500",
            shadow: "shadow-red-900/20"
        };
        case "HIGH": return {
            border: "border-orange-500/50",
            bg: "bg-orange-950/20",
            text: "text-orange-400",
            indicator: "bg-orange-500",
            shadow: "shadow-orange-900/20"
        };
        case "MEDIUM": return {
            border: "border-yellow-500/50",
            bg: "bg-yellow-950/20",
            text: "text-yellow-400",
            indicator: "bg-yellow-500",
            shadow: "shadow-yellow-900/20"
        };
        case "LOW": return {
            border: "border-emerald-500/50",
            bg: "bg-emerald-950/20",
            text: "text-emerald-400",
            indicator: "bg-emerald-500",
            shadow: "shadow-emerald-900/20"
        };
        default: return {
            border: "border-zinc-800",
            bg: "bg-zinc-900/50",
            text: "text-zinc-400",
            indicator: "bg-zinc-500",
            shadow: "shadow-zinc-900/10"
        };
    }
};

const getTypeIcon = (type: string | undefined) => {
    switch (type) {
        case "AUDIO": return <Mic className="w-3.5 h-3.5" />;
        case "VIDEO": return <Video className="w-3.5 h-3.5" />;
        case "TEXT": return <FileText className="w-3.5 h-3.5" />;
        default: return <Radio className="w-3.5 h-3.5" />;
    }
};

// Helper to format data packet display based on incident type
const getDataPacketDisplay = (incident: Incident): { label: string; content: string; isFile: boolean } => {
    const rawInput = incident.raw_input || "";

    // Check if it's a file path (contains common file extensions or starts with /)
    const isFilePath = rawInput.startsWith('/') ||
        /\.(mp3|mp4|mov|wav|avi|mkv|webm|ogg|m4a|flac)$/i.test(rawInput);

    if (isFilePath) {
        const filename = rawInput.split('/').pop() || rawInput;
        const extension = filename.split('.').pop()?.toLowerCase() || "";

        // Determine type based on extension if incident.type isn't set
        const isAudio = ["mp3", "wav", "ogg", "m4a", "flac"].includes(extension);
        const isVideo = ["mp4", "mov", "avi", "mkv", "webm"].includes(extension);

        if (isAudio || incident.type === "AUDIO") {
            return { label: "AUDIO FILE", content: filename, isFile: true };
        } else if (isVideo || incident.type === "VIDEO") {
            return { label: "VIDEO FILE", content: filename, isFile: true };
        }
        return { label: "MEDIA FILE", content: filename, isFile: true };
    }

    // It's a text transcript - truncate for display
    const maxLength = 10;
    const truncated = rawInput.length > maxLength
        ? rawInput.substring(0, maxLength).trim() + "..."
        : rawInput;

    return { label: "TRANSCRIPT", content: `"${truncated}"`, isFile: false };
};

export function SignalFeed({ className }: { className?: string }) {
    const incidents = useSimulationStore(state => state.incidents);
    const time = useSimulationStore(state => state.time);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<"video" | "audio" | "image" | null>(null);
    const [transcriptText, setTranscriptText] = useState<string | null>(null);

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
        if ((incident.location && typeof incident.location.lat === 'number') || incident.manual_trace_required) {
            if (useSimulationStore.getState().setFocusedIncidentId) {
                useSimulationStore.getState().setFocusedIncidentId(incident.id);
            }
        }
    };

    const handleOpenMedia = (e: React.MouseEvent, incident: Incident) => {
        e.stopPropagation();
        const url = incident.raw_input;
        if (incident.type === "VIDEO") setMediaType("video");
        else if (incident.type === "AUDIO") setMediaType("audio");
        else setMediaType("image");
        setMediaUrl(url);
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl", className)}>
            {/* Header */}
            <div className="shrink-0 p-4 border-b border-white/5 bg-gradient-to-r from-zinc-900 to-black flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Activity className="w-4 h-4 text-emerald-500 relative z-10" />
                        <div className="absolute inset-0 bg-emerald-500/20 blur-md animate-pulse" />
                    </div>
                    <span className="font-bold text-sm tracking-widest text-zinc-100 uppercase">Signal Intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500">LIVE FEED</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {incidents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-40">
                        <Radio className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                        <span className="text-zinc-500 text-xs font-mono tracking-widest uppercase">Scanning Frequencies...</span>
                    </div>
                )}

                {/* Group incidents by status */}
                {(() => {
                    // Group incidents by status
                    // Auth Pending incidents are technically "Analysis Paused" but should be shown as active/attention needed
                    const analyzing = incidents.filter(i => i.status === "ANALYZING" || i.auth_status === "PENDING");
                    const pending = incidents.filter(i => i.status === "PENDING" && i.auth_status !== "PENDING");
                    const processed = incidents.filter(i => i.status !== "ANALYZING" && i.status !== "PENDING" && i.auth_status !== "PENDING");

                    // Render a single incident card
                    const renderCard = (incident: Incident) => {
                        const isExpanded = expandedId === incident.id;
                        const styles = getPriorityStyles(incident.priority);
                        const hasLocation = !!(incident.location && typeof incident.location.lat === 'number' && incident.location.lat !== 0);
                        const dataPacket = getDataPacketDisplay(incident);

                        return (
                            <div
                                key={incident.id}
                                onClick={() => incident.status !== "PENDING" && toggleExpand(incident.id)}
                                className={cn(
                                    "group relative rounded-lg border transition-all duration-300 overflow-hidden",
                                    isExpanded ? "border-white/10 bg-zinc-900/90 shadow-2xl my-2 scale-[1.01]" : `hover:border-white/10 hover:bg-white/[0.02] cursor-pointer ${styles.border} bg-zinc-900/30`,
                                    incident.status === "PENDING" && "opacity-70 cursor-wait",
                                    incident.status === "ANALYZING" && "ring-1 ring-cyan-500/30"
                                )}
                            >
                                {/* Priority Indicator Line */}
                                <div className={cn("absolute left-0 top-0 bottom-0 w-1", styles.indicator)} />

                                {/* Card Content */}
                                <div className={cn("pl-4 pr-3 transition-all", isExpanded ? "py-4" : "py-3")}>
                                    {/* CARD HEADER: COMPACT OVERVIEW */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            {/* Icon Box */}
                                            <div className={cn(
                                                "w-8 h-8 rounded-md flex shrink-0 items-center justify-center border bg-gradient-to-br from-zinc-800 to-black",
                                                isExpanded ? "border-white/20 text-white" : "border-white/5 text-zinc-500"
                                            )}>
                                                {getTypeIcon(incident.type)}
                                            </div>

                                            {/* Main Info */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={cn(
                                                        "font-mono text-xs font-bold leading-none truncate",
                                                        isExpanded ? "text-white" : "text-zinc-300"
                                                    )}>
                                                        {incident.category || incident.id}
                                                    </span>
                                                    {incident.priority && (
                                                        <span className={cn(
                                                            "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border",
                                                            styles.bg, styles.text, styles.border
                                                        )}>
                                                            {incident.priority}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Preview Text (Closed) or Full ID (Open) */}
                                                {!isExpanded ? (
                                                    <div className="flex items-center gap-1.5 opacity-60">
                                                        <div className="w-1 h-1 rounded-full bg-zinc-500" />
                                                        <p className="text-[10px] text-zinc-400 truncate font-mono max-w-[200px]">
                                                            {dataPacket.content}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className={cn(
                                                            "border rounded px-2 py-0.5 flex items-center gap-1.5 text-[9px] font-mono",
                                                            dataPacket.isFile
                                                                ? "bg-cyan-950/30 border-cyan-500/20 text-cyan-400/80"
                                                                : "bg-zinc-800/50 border-white/5 text-zinc-400"
                                                        )}>
                                                            {dataPacket.isFile ? (
                                                                incident.type === "AUDIO" ? <Mic className="w-2.5 h-2.5" /> : <Video className="w-2.5 h-2.5" />
                                                            ) : (
                                                                <FileText className="w-2.5 h-2.5 opacity-50" />
                                                            )}
                                                            <span className="opacity-70">{dataPacket.label}:</span>
                                                            <span className={dataPacket.isFile ? "text-cyan-300" : "text-zinc-300 italic"}>
                                                                {dataPacket.content}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side Meta */}
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(incident.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {incident.status === "ANALYZING" ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                                    </span>
                                                    <span className="text-[9px] font-bold text-cyan-500 tracking-wider">ANALYZING</span>
                                                </div>
                                            ) : incident.status === "PENDING" ? (
                                                <span className="text-[9px] font-bold text-zinc-600 tracking-wider">QUEUED</span>
                                            ) : (
                                                <ChevronDown className={cn("w-4 h-4 text-zinc-600 transition-transform duration-200", isExpanded && "rotate-180")} />
                                            )}
                                        </div>
                                    </div>

                                    {/* CARD BODY: EXPANDED DOSSIER */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-4 space-y-4">
                                                    {/* 1. COMMANDER OVERRIDES - VOICE OF GOD */}
                                                    <div className="bg-gradient-to-r from-red-950/30 to-black border border-red-500/20 rounded-lg p-3 relative overflow-hidden group/voice hover:border-red-500/40 transition-colors">
                                                        <div className="absolute top-0 right-0 p-1 opacity-20 group-hover/voice:opacity-100 transition-opacity">
                                                            <Activity className="w-12 h-12 text-red-500 -mt-2 -mr-2" />
                                                        </div>

                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Shield className="w-3.5 h-3.5 text-red-400" />
                                                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                                                                High Priority Intervention
                                                            </span>
                                                        </div>

                                                        <div className="relative z-10 flex gap-3 items-center">
                                                            <CommanderControls incidentContext={incident} className="flex-1" />
                                                            <div className="text-[9px] text-zinc-500 font-mono w-24 leading-tight opacity-70">
                                                                Hold to inject Voice Command directly to Agent
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 2. PRIMARY ACTIONS GRID */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {hasLocation && !incident.manual_trace_required && (
                                                            <button
                                                                onClick={(e) => handleNavigate(e, incident)}
                                                                className="flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-emerald-900/20 text-zinc-300 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/30 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                                                            >
                                                                <MapPin className="w-3.5 h-3.5" />
                                                                Locate
                                                            </button>
                                                        )}
                                                        {(dataPacket.isFile || incident.type === "AUDIO" || incident.type === "VIDEO") && (
                                                            <button
                                                                onClick={(e) => handleOpenMedia(e, incident)}
                                                                className="flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-cyan-900/20 text-zinc-300 hover:text-cyan-400 border border-white/5 hover:border-cyan-500/30 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                                                            >
                                                                <Play className="w-3.5 h-3.5" />
                                                                Play Media
                                                            </button>
                                                        )}
                                                        {!dataPacket.isFile && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setTranscriptText(incident.raw_input);
                                                                }}
                                                                className="flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-amber-900/20 text-zinc-300 hover:text-amber-400 border border-white/5 hover:border-amber-500/30 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                                View Transcript
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* 3. LOCATION INTELLIGENCE */}
                                                    {incident.location && (
                                                        <div className="bg-black/40 border border-white/5 rounded p-3 relative overflow-hidden">
                                                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <Target className="w-3 h-3" />
                                                                Target Profile
                                                            </h4>
                                                            <div className="space-y-1">
                                                                <div className="text-xs text-zinc-200 font-medium">
                                                                    {incident.location_ambiguity ? (
                                                                        <span className="text-orange-400 flex items-center gap-1">
                                                                            <AlertTriangle className="w-3 h-3" />
                                                                            Ambiguous Location Data
                                                                        </span>
                                                                    ) : incident.location.address || "Unknown Address"}
                                                                </div>
                                                                <div className="text-[10px] font-mono text-zinc-500">
                                                                    GRID: {incident.location.lat.toFixed(5)}, {incident.location.lng.toFixed(5)}
                                                                </div>
                                                            </div>
                                                            {incident.manual_trace_required && (
                                                                <div className="mt-2 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1.5 rounded flex items-center gap-2 w-fit">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    MANUAL TRACE REQUIRED
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* TACTICAL ANALYSIS: Prioritize clean display_reasoning bullets */}
                                                    {(incident.display_reasoning && incident.display_reasoning.length > 0) ? (
                                                        <div className="bg-gradient-to-b from-zinc-900 to-black border border-white/5 rounded p-3">
                                                            <h4 className="text-[10px] font-bold text-cyan-600/80 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <Cpu className="w-3 h-3" />
                                                                Tactical Analysis
                                                            </h4>
                                                            <ul className="space-y-1.5 pl-1 border-l-2 border-cyan-900/30">
                                                                {incident.display_reasoning.map((bullet, idx) => (
                                                                    <li key={idx} className="text-[11px] text-zinc-300 font-mono flex items-start gap-2">
                                                                        <span className="text-cyan-500 mt-0.5">•</span>
                                                                        <span>{bullet}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>

                                                            {/* Collapsible Full Analysis (the verbose reasoning_trace) */}
                                                            {incident.reasoning_trace && incident.reasoning_trace.length > 50 && (
                                                                <div className="mt-3 pt-2 border-t border-white/5">
                                                                    <button
                                                                        onClick={(e) => toggleAnalysis(incident.id, e)}
                                                                        className="w-full py-1 flex items-center justify-center gap-2 text-[9px] font-bold text-zinc-500 hover:text-cyan-400 transition-colors uppercase tracking-wider bg-black/20 hover:bg-black/40 rounded"
                                                                    >
                                                                        {analysisExpandedMap[incident.id] ? (
                                                                            <>Hide Full Analysis <ChevronUp className="w-3 h-3" /></>
                                                                        ) : (
                                                                            <>View Full Analysis <ChevronDown className="w-3 h-3" /></>
                                                                        )}
                                                                    </button>
                                                                    <AnimatePresence>
                                                                        {analysisExpandedMap[incident.id] && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: "auto", opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                transition={{ duration: 0.3 }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                <div className="mt-2 text-[10px] leading-relaxed text-zinc-500 font-mono whitespace-pre-wrap bg-black/30 rounded p-2 max-h-40 overflow-y-auto">
                                                                                    {incident.reasoning_trace.split('[COMMAND OVERRIDE]:')[0].trim()}
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : incident.reasoning_trace && (() => {
                                                        // Fallback: If no display_reasoning, use the old verbose trace
                                                        const technicalTrace = (incident.reasoning_trace || "").split('[COMMAND OVERRIDE]:')[0].trim();
                                                        const hasTechnicalContent = technicalTrace.length > 0;

                                                        return hasTechnicalContent ? (
                                                            <div className="bg-gradient-to-b from-zinc-900 to-black border border-white/5 rounded p-3">
                                                                <h4 className="text-[10px] font-bold text-cyan-600/80 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                    <Cpu className="w-3 h-3" />
                                                                    Tactical Analysis
                                                                </h4>
                                                                <div className="relative">
                                                                    <motion.div
                                                                        initial={false}
                                                                        animate={{
                                                                            height: analysisExpandedMap[incident.id] ? "auto" : "4.5rem",
                                                                            maskImage: analysisExpandedMap[incident.id]
                                                                                ? "linear-gradient(to bottom, black 100%, black 100%)"
                                                                                : "linear-gradient(to bottom, black 60%, transparent 100%)",
                                                                        }}
                                                                        transition={{ duration: 0.4, ease: "easeInOut" }}
                                                                        className="text-[11px] leading-relaxed text-zinc-400 font-mono whitespace-pre-wrap pl-1 border-l-2 border-cyan-900/30 overflow-hidden relative"
                                                                    >
                                                                        {technicalTrace}
                                                                    </motion.div>

                                                                    {technicalTrace.length > 200 && (
                                                                        <button
                                                                            onClick={(e) => toggleAnalysis(incident.id, e)}
                                                                            className="w-full mt-2 py-1 flex items-center justify-center gap-2 text-[10px] font-bold text-cyan-500/70 hover:text-cyan-400 transition-colors uppercase tracking-wider bg-black/20 hover:bg-black/40 rounded"
                                                                        >
                                                                            {analysisExpandedMap[incident.id] ? (
                                                                                <>Show Less <ChevronUp className="w-3 h-3" /></>
                                                                            ) : (
                                                                                <>Read Analysis <ChevronDown className="w-3 h-3" /></>
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : null;
                                                    })()}

                                                    {/* Voice Override Section - separate from main analysis */}
                                                    {incident.reasoning_trace?.includes('[COMMAND OVERRIDE]:') && (
                                                        <div className="bg-gradient-to-r from-amber-950/20 to-black border border-amber-500/30 rounded p-3 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
                                                            <div className="absolute top-0 right-0 p-1 opacity-10">
                                                                <Activity className="w-8 h-8 text-amber-500" />
                                                            </div>
                                                            <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <Mic className="w-3 h-3" />
                                                                Override Analysis
                                                            </h4>
                                                            <div className="text-[11px] leading-relaxed text-zinc-300 font-mono pl-1 border-l-2 border-amber-500/50">
                                                                {incident.reasoning_trace.split('[COMMAND OVERRIDE]:')[1].trim()}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 5. ASSET ALLOCATION */}
                                                    {incident.assigned_assets && incident.assigned_assets.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Deployed Assets</h4>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {incident.assigned_assets.map(asset => (
                                                                    <span key={asset} className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-400/90 text-[9px] px-2 py-1 rounded font-mono uppercase">
                                                                        {asset}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 6. PROTOCOL ZERO (Auth) */}
                                                    {incident.requires_human_auth && incident.auth_status === "PENDING" && (
                                                        <div className="mt-2 bg-amber-950/10 border border-amber-500/30 rounded p-3 animate-pulse-slow">
                                                            <div className="flex items-center gap-2 text-amber-500 mb-2">
                                                                <Shield className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] font-bold uppercase tracking-widest">Authorization Required</span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        useSimulationStore.getState().updateIncident(incident.id, {
                                                                            auth_status: "DENIED",
                                                                            status: "RESOLVED",
                                                                            reasoning_trace: (incident.reasoning_trace || "") + " [DENIED BY HUMAN OPERATOR]"
                                                                        });
                                                                    }}
                                                                    className="flex-1 bg-black hover:bg-red-950/30 border border-amber-500/20 hover:border-red-500/50 text-amber-500 hover:text-red-400 py-1.5 rounded text-[10px] uppercase font-bold transition-colors"
                                                                >
                                                                    Deny
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        useSimulationStore.getState().updateIncident(incident.id, {
                                                                            auth_status: "APPROVED",
                                                                            reasoning_trace: (incident.reasoning_trace || "") + " [AUTHORIZED BY HUMAN OPERATOR]"
                                                                        });
                                                                    }}
                                                                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-500 py-1.5 rounded text-[10px] uppercase font-bold transition-colors"
                                                                >
                                                                    Authorize
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    };

                    return (
                        <>
                            {/* ACTIVE ANALYSIS Section */}
                            {analyzing.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="relative">
                                            <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                            <div className="absolute inset-0 w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                                        </div>
                                        <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Active Analysis</span>
                                        <span className="text-[9px] font-mono text-cyan-500/60">({analyzing.length})</span>
                                    </div>
                                    <div className="space-y-2 bg-cyan-950/10 border border-cyan-500/10 rounded-lg p-2">
                                        {analyzing.map(renderCard)}
                                    </div>
                                </div>
                            )}

                            {/* INCOMING QUEUE Section */}
                            {pending.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <Clock className="w-3 h-3 text-zinc-500" />
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Incoming Queue</span>
                                        <span className="text-[9px] font-mono text-zinc-600">({pending.length})</span>
                                    </div>
                                    <div className="space-y-2 opacity-70">
                                        {pending.map(renderCard)}
                                    </div>
                                </div>
                            )}

                            {/* PROCESSED Section */}
                            {processed.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Processed</span>
                                        <span className="text-[9px] font-mono text-zinc-700">({processed.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                        {[...processed].reverse().map(renderCard)}
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Media Overlay */}
            {mediaUrl && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-full max-w-2xl shadow-2xl">
                        <div className="flex justify-between items-center px-3 py-2 border-b border-white/5 mb-2 bg-black/20">
                            <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                                {mediaType === 'video' ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                MEDIA PLAYBACK
                            </span>
                            <button onClick={() => setMediaUrl(null)} className="text-zinc-500 hover:text-white">&times;</button>
                        </div>
                        <div className="p-2">
                            {mediaType === "video" ? (
                                <video controls autoPlay className="w-full rounded bg-black aspect-video">
                                    <source src={mediaUrl} />
                                </video>
                            ) : (
                                <div className="p-8 bg-zinc-950 rounded flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center">
                                        <Mic className="w-8 h-8 text-emerald-500 animate-pulse" />
                                    </div>
                                    <audio controls autoPlay className="w-full" src={mediaUrl} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Transcript Overlay */}
            {transcriptText && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-full max-w-2xl shadow-2xl">
                        <div className="flex justify-between items-center px-3 py-2 border-b border-white/5 mb-2 bg-black/20">
                            <span className="text-xs font-mono text-amber-400 flex items-center gap-2">
                                <FileText className="w-3 h-3" />
                                RAW TRANSCRIPT
                            </span>
                            <button onClick={() => setTranscriptText(null)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
                        </div>
                        <div className="p-4">
                            <div className="bg-black/50 border border-white/5 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                                <p className="text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
                                    {transcriptText}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
