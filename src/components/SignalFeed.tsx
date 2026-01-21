"use client";

import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { type Incident } from "@/lib/types";

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
        case "AUDIO": return "🎙️";
        case "VIDEO": return "📹";
        case "TEXT": return "📝";
        default: return "📡";
    }
};

export function SignalFeed({ className }: { className?: string }) {
    const { incidents, time } = useSimulationStore();

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden", className)}>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-900/50 to-zinc-950">
                <h3 className="text-zinc-100 font-bold uppercase tracking-wider text-sm flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
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
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {incidents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center mb-4">
                            <span className="text-2xl animate-pulse">📡</span>
                        </div>
                        <span className="text-zinc-600 text-xs font-mono">MONITORING FREQUENCIES...</span>
                        <span className="text-zinc-700 text-[10px] mt-1">Awaiting distress signals</span>
                    </div>
                )}
                {[...incidents].reverse().map((incident, index) => (
                    <div
                        key={incident.id}
                        className={cn(
                            "p-3 rounded-lg border text-xs relative group transition-all duration-300 hover:scale-[1.02]",
                            getPriorityColor(incident.priority),
                            index === 0 && incident.status === "PENDING" && "ring-1 ring-cyan-500/50 animate-pulse"
                        )}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {/* Status indicator */}
                        <div className="absolute top-3 right-3">
                            {incident.status === "PENDING" ? (
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                                    <span className="text-[9px] text-cyan-400 font-mono">ANALYZING</span>
                                </div>
                            ) : (
                                <span className="text-[9px] text-emerald-400 font-mono">✓ TRIAGED</span>
                            )}
                        </div>

                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{getTypeIcon(incident.type)}</span>
                            <div>
                                <span className="font-bold text-sm">{incident.id}</span>
                                <span className="text-zinc-500 text-[10px] ml-2 font-mono">
                                    {new Date(incident.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <p className="opacity-80 line-clamp-2 font-mono text-[11px] leading-relaxed mb-2 pr-16">
                            {incident.type === "VIDEO"
                                ? "[VIDEO DATA STREAM]"
                                : incident.raw_input.length > 80
                                    ? incident.raw_input.substring(0, 80) + "..."
                                    : incident.raw_input}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center gap-3 pt-2 border-t border-current/10">
                            {incident.priority && (
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {incident.priority}
                                </span>
                            )}
                            {incident.category && (
                                <span className="text-[10px] opacity-60">
                                    {incident.category}
                                </span>
                            )}
                            {incident.assigned_assets && (
                                <span className="text-[10px] text-cyan-400 ml-auto">
                                    🚁 {incident.assigned_assets.join(", ")}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
