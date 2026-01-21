"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Typewriter effect component
function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
    const [displayText, setDisplayText] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        setDisplayText("");
        setIsComplete(false);
        let index = 0;

        const interval = setInterval(() => {
            if (index < text.length) {
                setDisplayText(text.substring(0, index + 1));
                index++;
            } else {
                setIsComplete(true);
                clearInterval(interval);
            }
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed]);

    return (
        <span>
            {displayText}
            {!isComplete && <span className="animate-pulse">▌</span>}
        </span>
    );
}

export function ReasoningLog({ className }: { className?: string }) {
    const { logs, incidents } = useSimulationStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [displayLogs, setDisplayLogs] = useState<string[]>([]);

    useEffect(() => {
        setDisplayLogs(logs.slice(-15));
        // Auto-scroll to bottom
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Find the latest active incident with a reasoning trace
    const latestTriaged = incidents
        .slice()
        .reverse()
        .find(i => i.reasoning_trace && i.status === "TRIAGED");

    return (
        <div className={cn("flex flex-col gap-2 p-4 bg-zinc-950 border border-zinc-800 rounded-lg h-full font-mono text-xs", className)}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-2">
                <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <h3 className="text-zinc-300 font-bold uppercase tracking-wider text-[11px]">System Activity</h3>
                <span className="ml-auto text-[9px] text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded">
                    {logs.length} entries
                </span>
            </div>

            {/* Activity Log */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 max-h-[150px]">
                {displayLogs.length === 0 ? (
                    <div className="text-zinc-600 text-center py-4 animate-pulse">
                        Initializing system...
                    </div>
                ) : (
                    displayLogs.map((log, i) => (
                        <div
                            key={i}
                            className="text-zinc-500 flex items-start gap-2 py-0.5 hover:bg-zinc-900/30 px-1 rounded transition-colors"
                        >
                            <span className="text-emerald-500/40 shrink-0">›</span>
                            <span className="break-all">{log}</span>
                        </div>
                    ))
                )}
            </div>

            {/* AI Reasoning Trace - "Glass Box" Visualization */}
            {latestTriaged && (
                <div className="mt-auto border-t border-zinc-800 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
                            <span className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                            <span className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                        </div>
                        <h4 className="text-zinc-300 font-bold uppercase text-[10px] tracking-widest">
                            AI Reasoning Trace
                        </h4>
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {latestTriaged.id}
                        </span>
                    </div>

                    <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-3 rounded-lg border border-zinc-800 relative overflow-hidden">
                        {/* Decorative corner */}
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-cyan-500/10 to-transparent" />

                        <div className="text-cyan-400/90 text-[11px] leading-relaxed max-h-[120px] overflow-y-auto">
                            <TypewriterText text={latestTriaged.reasoning_trace || ""} speed={15} />
                        </div>
                    </div>

                    {/* Signature Footer */}
                    <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-600">Priority:</span>
                            <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                latestTriaged.priority === "CRITICAL" && "bg-red-500/20 text-red-400",
                                latestTriaged.priority === "HIGH" && "bg-orange-500/20 text-orange-400",
                                latestTriaged.priority === "MEDIUM" && "bg-yellow-500/20 text-yellow-400",
                                latestTriaged.priority === "LOW" && "bg-emerald-500/20 text-emerald-400",
                            )}>
                                {latestTriaged.priority}
                            </span>
                        </div>
                        <div className="text-[8px] text-zinc-700 font-mono flex items-center gap-1">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                            {latestTriaged.thought_signature || "SIG-VERIFIED"}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
