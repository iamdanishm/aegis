"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useSimulationStore } from "@/lib/store";
import { type Incident } from "@/lib/types";

// Dynamic import for Leaflet (SSR bypass)
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then(mod => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

// Priority color mapping
const getPriorityColor = (priority?: string) => {
    switch (priority) {
        case "CRITICAL": return "#ef4444";
        case "HIGH": return "#f97316";
        case "MEDIUM": return "#eab308";
        case "LOW": return "#22c55e";
        default: return "#06b6d4"; // Cyan for pending/analyzing
    }
};

// Map Controller component - dynamically imported
const MapControllerInner = dynamic(
    () => import("./MapController").then(mod => mod.MapController),
    { ssr: false }
);

// Animated marker component with pulse effect
function AnimatedMarker({ incident }: { incident: Incident }) {
    const [pulseRadius, setPulseRadius] = useState(12);
    const [pulseOpacity, setPulseOpacity] = useState(0.7);
    const isAnalyzing = incident.status === "PENDING";

    useEffect(() => {
        if (!isAnalyzing) return;

        const interval = setInterval(() => {
            setPulseRadius(prev => prev >= 30 ? 12 : prev + 2);
            setPulseOpacity(prev => prev <= 0.1 ? 0.7 : prev - 0.08);
        }, 80);

        return () => clearInterval(interval);
    }, [isAnalyzing]);

    const color = getPriorityColor(incident.priority);

    return (
        <>
            {/* Pulse ring for analyzing state */}
            {isAnalyzing && (
                <CircleMarker
                    center={[incident.location.lat, incident.location.lng]}
                    radius={pulseRadius}
                    pathOptions={{
                        color: "#06b6d4",
                        fillColor: "#06b6d4",
                        fillOpacity: pulseOpacity * 0.3,
                        weight: 2,
                        opacity: pulseOpacity,
                    }}
                />
            )}
            {/* Main marker */}
            <CircleMarker
                center={[incident.location.lat, incident.location.lng]}
                radius={isAnalyzing ? 8 : 12}
                pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: 3,
                }}
            >
                <Popup>
                    <div className="p-2 min-w-[180px]">
                        <div className="font-bold text-sm mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            {incident.id}
                        </div>
                        <div className="text-xs space-y-1.5">
                            <div className="flex justify-between">
                                <span className="opacity-60">Type:</span>
                                <span className="font-medium">{incident.type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="opacity-60">Status:</span>
                                <span className={isAnalyzing ? "text-cyan-500" : "text-emerald-500"}>
                                    {isAnalyzing ? "ANALYZING..." : "TRIAGED"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="opacity-60">Priority:</span>
                                <span style={{ color, fontWeight: "bold" }}>
                                    {incident.priority || "—"}
                                </span>
                            </div>
                            {incident.category && (
                                <div className="flex justify-between">
                                    <span className="opacity-60">Category:</span>
                                    <span>{incident.category}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Popup>
            </CircleMarker>
        </>
    );
}

export function TacticalMap({ className }: { className?: string }) {
    const { incidents } = useSimulationStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <div className={`flex items-center justify-center bg-zinc-950 text-zinc-600 ${className}`}>
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className="w-12 h-12 border-2 border-emerald-500/30 rounded-full" />
                        <div className="absolute inset-0 w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <span className="text-xs font-mono tracking-wider">ESTABLISHING SATELLITE UPLINK...</span>
                </div>
            </div>
        );
    }

    // Calculate center based on first incident or default to NYC
    const center: [number, number] = incidents.length > 0
        ? [incidents[0].location.lat, incidents[0].location.lng]
        : [40.7128, -74.0060];

    return (
        <div className={`relative h-full w-full rounded-lg overflow-hidden border border-zinc-800 ${className}`}>
            {/* Header overlay */}
            <div className="absolute top-0 left-0 right-0 z-[500] bg-gradient-to-b from-zinc-950/90 to-transparent p-3 pointer-events-none">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-zinc-400 tracking-widest">LIVE TACTICAL VIEW</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{incidents.length} SIGNALS</span>
                </div>
            </div>

            <MapContainer
                center={center}
                zoom={13}
                scrollWheelZoom={true}
                className="h-full w-full z-0"
                style={{ minHeight: "300px", background: "#09090b" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
                    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                />
                <MapControllerInner incidents={incidents} />
                {incidents.map((incident) => (
                    <AnimatedMarker key={incident.id} incident={incident} />
                ))}
            </MapContainer>

            {/* Overlay Grid */}
            <div className="absolute inset-0 pointer-events-none z-[400] bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />

            {/* Corner Decorations */}
            <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-emerald-500/40 pointer-events-none z-[401]" />
            <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-emerald-500/40 pointer-events-none z-[401]" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-emerald-500/40 pointer-events-none z-[401]" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-emerald-500/40 pointer-events-none z-[401]" />

            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none z-[402] opacity-[0.015] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0.1)_4px)]" />
        </div>
    );
}
