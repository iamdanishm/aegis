"use client";

import { useState } from "react";
import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { type Incident } from "@/lib/types";
import {
    Mic, Video, FileText, Radio,
    MapPin, Play, ExternalLink,
    ChevronDown, ChevronUp, AlertCircle,
    Activity
} from "lucide-react";

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
    const { incidents, time, setFocusedIncidentId } = useSimulationStore();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<"video" | "audio" | "image" | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handleNavigate = (e: React.MouseEvent, incident: Incident) => {
        e.stopPropagation();
        if (incident.location && incident.location.lat && incident.location.lng) {
            // We need to add setFocusedIncidentId to store.ts first, assume it exists for now
            // If not, we can implement it in the next step.
            if (setFocusedIncidentId) {
                setFocusedIncidentId(incident.id);
            }
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

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden", className)}>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-900/50 to-zinc-950">
                <h3 className="text-zinc-100 font-bold uppercase tracking-wider text-sm flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                        Inbound Signals
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                            {incidents.length} ACTIVE
                        </span>
                        <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                            T+{time}s
                        </span>
                    </div>
                </h3>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-20 scrollbar-thin scrollbar-thumb-zinc-800">
                {incidents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center mb-4">
                            <Radio className="w-8 h-8 text-zinc-700 animate-pulse" />
                        </div>
                        <span className="text-zinc-600 text-xs font-mono">MONITORING FREQUENCIES...</span>
                        <span className="text-zinc-700 text-[10px] mt-1">Awaiting distress signals</span>
                    </div>
                )}
                {[...incidents].reverse().map((incident, index) => {
                    const isExpanded = expandedId === incident.id;
                    const hasLocation = incident.location && incident.location.lat;
                    const cleanRawInput = incident.raw_input.split('/').pop() || incident.raw_input;

                    return (
                        <div
                            key={incident.id}
                            onClick={() => toggleExpand(incident.id)}
                            className={cn(
                                "rounded-lg border text-xs relative group transition-all duration-300 cursor-pointer overflow-hidden",
                                getPriorityColor(incident.priority),
                                isExpanded ? "bg-opacity-20 ring-1 ring-white/10" : "hover:scale-[1.01]",
                                index === 0 && incident.status === "PENDING" && "ring-1 ring-cyan-500/50 animate-pulse"
                            )}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="p-3">
                                {/* Status indicator */}
                                <div className="absolute top-3 right-3">
                                    {incident.status === "PENDING" ? (
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                                            <span className="text-[9px] text-cyan-400 font-mono">ANALYZING</span>
                                        </div>
                                    ) : (
                                        <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                                            ✓ TRIAGED
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
                                        </span>
                                    )}
                                </div>

                                {/* Header */}
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded bg-black/20">
                                        {getTypeIcon(incident.type)}
                                    </div>
                                    <div>
                                        <span className="font-bold text-sm block">{incident.id}</span>
                                        <span className="text-zinc-500 text-[10px] font-mono">
                                            {new Date(incident.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Content Preview */}
                                {!isExpanded && (
                                    <div className="opacity-80 font-mono text-[11px] leading-relaxed mb-2 pr-16 text-zinc-400">
                                        <span className="font-bold text-zinc-300">DATA:</span> {cleanRawInput.length > 30 ? cleanRawInput.substring(0, 30) + "..." : cleanRawInput}
                                    </div>
                                )}

                                {/* Footer Tags */}
                                <div className="flex items-center gap-2 mt-2">
                                    {incident.priority && (
                                        <span className={cn(
                                            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/20",
                                            incident.priority === "CRITICAL" ? "text-red-400" :
                                                incident.priority === "HIGH" ? "text-orange-400" : "text-zinc-400"
                                        )}>
                                            {incident.priority}
                                        </span>
                                    )}
                                    {(incident.category || incident.people_safety === "SAFE") && (
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded border leading-none",
                                            incident.people_safety === "SAFE"
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : "opacity-60 bg-black/10 border-transparent text-zinc-400"
                                        )}>
                                            {incident.people_safety === "SAFE" ? "SAFE" : incident.category}
                                        </span>
                                    )}
                                    {incident.assigned_assets && incident.assigned_assets.length > 0 && (
                                        <div className="flex gap-1 ml-auto">
                                            {incident.assigned_assets.map((asset, i) => (
                                                <span key={i} className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded font-bold uppercase whitespace-nowrap">
                                                    {asset}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* EXPANDED CONTENT */}
                            {isExpanded && (
                                <div className="border-t border-black/10 bg-black/10 p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">

                                    {/* Actions Row */}
                                    <div className="flex gap-2">
                                        {hasLocation && (
                                            <button
                                                onClick={(e) => handleNavigate(e, incident)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-1.5 rounded text-[10px] font-bold transition-colors"
                                            >
                                                <MapPin className="w-3 h-3" />
                                                LOCATE ON MAP
                                            </button>
                                        )}

                                        {(incident.type === "AUDIO" || incident.type === "VIDEO") && (
                                            <button
                                                onClick={(e) => handleOpenMedia(e, incident)}
                                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-1.5 rounded text-[10px] font-bold transition-colors"
                                            >
                                                <Play className="w-3 h-3" />
                                                PLAY MEDIA
                                            </button>
                                        )}
                                    </div>

                                    {/* Full Details */}
                                    <div className="space-y-2">
                                        <div className="bg-black/20 p-2 rounded text-[10px] font-mono whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                                            <span className="text-zinc-500 block mb-1">RAW CONTENT:</span>
                                            {incident.raw_input}
                                        </div>

                                        {incident.reasoning_trace && (
                                            <div className="bg-black/20 p-2 rounded text-[10px] font-mono">
                                                <span className="text-zinc-500 block mb-1">ANALYSIS:</span>
                                                <div className="opacity-80 leading-relaxed">
                                                    {incident.reasoning_trace}
                                                </div>
                                            </div>
                                        )}

                                        {incident.assigned_assets && incident.assigned_assets.length > 0 && (
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded text-[10px] font-mono">
                                                <span className="text-emerald-500 font-bold block mb-1 flex items-center gap-1 uppercase tracking-tighter">
                                                    <Activity className="w-3 h-3" />
                                                    Logistics: Assets Deployed
                                                </span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {incident.assigned_assets.map((asset, i) => (
                                                        <span key={i} className="bg-emerald-500 text-black px-1.5 py-0.5 rounded font-bold uppercase text-[8px]">
                                                            {asset}
                                                        </span>
                                                    ))}
                                                </div>
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
