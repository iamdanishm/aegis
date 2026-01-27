"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSimulationStore } from "@/lib/store";
import { type Incident } from "@/lib/types";
import { divIcon } from "leaflet";
import { AnimatePresence, motion } from "framer-motion";

// Dynamic import for Leaflet (SSR bypass)
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

// Map Controller component - dynamically imported
const MapControllerInner = dynamic(
    () => import("./MapController").then(mod => mod.MapController),
    { ssr: false }
);

const MapFocusHandler = dynamic(
    () => import("./MapFocusHandler").then(mod => mod.MapFocusHandler),
    { ssr: false }
);

// Priority color mapping (Hex values)
const PRIORITY_COLORS = {
    CRITICAL: "#ef4444", // Red 500
    HIGH: "#f97316",    // Orange 500
    MEDIUM: "#eab308",  // Yellow 500
    LOW: "#22c55e",     // Green 500
    DEFAULT: "#06b6d4"  // Cyan 500
};

// --- Custom HTML Marker Generator ---
const createPulseIcon = (incident: Incident) => {
    const isAnalyzing = incident.status === "PENDING";
    const color = PRIORITY_COLORS[incident.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.DEFAULT;

    // Using Tailwind arbitrary values in the HTML string for the icon
    const html = `
        <div class="relative flex items-center justify-center w-full h-full">
            ${/* Outer Ring / Ripple */ ""}
            ${isAnalyzing ? `
                <div class="absolute inset-0 border border-cyan-500/50 rounded-full animate-radar-spin" style="border-style: dashed;"></div>
                <div class="absolute inset-0 bg-cyan-500/10 rounded-full animate-pulse"></div>
            ` : incident.priority === "CRITICAL" ? `
                 <div class="absolute inset-[-12px] bg-red-500/20 rounded-full animate-ping-slow"></div>
                 <div class="absolute inset-[-6px] border border-red-500/50 rounded-full animate-pulse-fast"></div>
            ` : ""}
            
            ${/* Core Dot */ ""}
            <div class="w-3 h-3 rounded-full border border-white/20 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 transition-transform duration-300 hover:scale-125"
                 style="background-color: ${color}; box-shadow: 0 0 12px ${color};">
            </div>
            
            ${/* Label (Optional - small ID) */ ""}
            <span class="absolute -bottom-5 text-[8px] font-mono font-bold text-white/70 bg-black/60 px-1 rounded backdrop-blur-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                ${incident.id}
            </span>
        </div>
    `;

    return divIcon({
        className: "custom-marker-group group", // 'group' allows hover targeting
        html: html,
        iconSize: [40, 40], // Larger container to fit ripples
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
    });
};

function TacticalMarker({ incident }: { incident: Incident }) {
    const icon = useMemo(() => createPulseIcon(incident), [incident.status, incident.priority, incident.id]);

    return (
        <Marker position={[incident.location.lat || 0, incident.location.lng || 0]} icon={icon}>
            <Popup>
                <div className="p-1 min-w-[200px]">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2 mb-2">
                        <span className="font-mono text-xs text-zinc-400">{incident.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${incident.priority === "CRITICAL" ? "bg-red-500/10 border-red-500/30 text-red-500" :
                            incident.priority === "HIGH" ? "bg-orange-500/10 border-orange-500/30 text-orange-500" :
                                "bg-zinc-800 border-zinc-700 text-zinc-400"
                            }`}>
                            {incident.priority || "UNCATEGORIZED"}
                        </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">TYPE</span>
                            <span className="text-zinc-200 font-medium text-right">{incident.type}</span>
                        </div>
                        {incident.category && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">CAT</span>
                                <span className="text-zinc-200 font-medium text-right">{incident.category}</span>
                            </div>
                        )}
                        {incident.people_safety && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">SAFETY</span>
                                <span className={`font-medium text-right ${incident.people_safety.includes("DANGER") ? "text-red-500 font-bold" : "text-zinc-200"}`}>
                                    {incident.people_safety}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500">STATUS</span>
                            <div className="flex items-center gap-1.5">
                                {incident.status === 'PENDING' && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                )}
                                <span className={`font-mono font-medium ${incident.status === "PENDING" ? "text-cyan-400" : "text-emerald-400"
                                    }`}>
                                    {incident.status === "PENDING" ? "ANALYZING" : "TRIAGED"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Popup>
        </Marker>
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
            <div className={`flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 rounded-lg ${className}`}>
                <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <span className="text-xs font-mono text-emerald-500 tracking-[0.2em] animate-pulse">
                    INITIALIZING SATELLITE UPLINK...
                </span>
            </div>
        );
    }

    const firstWithLocation = incidents.find(i => i.location && i.location.lat !== null && i.location.lng !== null);
    const center: [number, number] = firstWithLocation
        ? [firstWithLocation.location.lat, firstWithLocation.location.lng]
        : [40.7128, -74.0060];

    return (
        <div className={`relative h-full w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl ${className}`}>

            {/* --- TACTICAL OVERLAYS --- */}

            {/* 1. Header Bar */}
            <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between items-start pointer-events-none">
                <div className="glass-panel px-3 py-1.5 rounded-md flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">LIVE FEED</span>
                    </div>
                </div>

                <div className="glass-panel px-3 py-1.5 rounded-md">
                    <span className="text-[10px] font-mono text-zinc-400 tracking-widest">
                        SIGNALS: <span className="text-white font-bold">{incidents.length}</span>
                    </span>
                </div>
            </div>

            {/* 2. Map Component */}
            <MapContainer
                center={center}
                zoom={13}
                zoomControl={false} // Custom zoom control could be added
                scrollWheelZoom={true}
                minZoom={3}
                maxZoom={18}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
                className="h-full w-full z-0 bg-[#09090b]"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <MapControllerInner incidents={incidents} />

                {/* Auto-focus Effect */}
                <MapFocusHandler />

                {incidents
                    .filter(incident => incident.location && incident.location.lat !== null && incident.location.lng !== null)
                    .map((incident) => (
                        <TacticalMarker key={incident.id} incident={incident} />
                    ))}
            </MapContainer>

            {/* 3. Radar Sweep Effect (The "Cool" Factor) */}
            <div className="absolute inset-0 pointer-events-none z-[300] overflow-hidden opacity-30">
                <div className="absolute inset-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_340deg,rgba(16,185,129,0.1)_360deg)] animate-radar-spin origin-center"></div>
            </div>

            {/* 4. CRT/Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none z-[350] bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20"></div>

            {/* 5. Vignette */}
            <div className="absolute inset-0 pointer-events-none z-[350] bg-[radial-gradient(circle,transparent_60%,rgba(9,9,11,0.8)_100%)]"></div>

            {/* 6. Corner HUD Elements */}
            <svg className="absolute top-2 left-2 w-16 h-16 z-[360] opacity-50 pointer-events-none text-emerald-500/40" viewBox="0 0 100 100">
                <path d="M 2 30 L 2 2 L 30 2" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg className="absolute top-2 right-2 w-16 h-16 z-[360] opacity-50 pointer-events-none text-emerald-500/40" viewBox="0 0 100 100">
                <path d="M 70 2 L 98 2 L 98 30" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg className="absolute bottom-2 left-2 w-16 h-16 z-[360] opacity-50 pointer-events-none text-emerald-500/40" viewBox="0 0 100 100">
                <path d="M 2 70 L 2 98 L 30 98" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg className="absolute bottom-2 right-2 w-16 h-16 z-[360] opacity-50 pointer-events-none text-emerald-500/40" viewBox="0 0 100 100">
                <path d="M 70 98 L 98 98 L 98 70" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>

        </div>
    );
}
