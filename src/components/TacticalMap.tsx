"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, MapMouseEvent } from "@vis.gl/react-google-maps";
import { useSimulationStore } from "@/lib/store";
import { type Incident } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";

// Priority color mapping (Hex values)
const PRIORITY_COLORS = {
    CRITICAL: "#ef4444", // Red 500
    HIGH: "#f97316",    // Orange 500
    MEDIUM: "#eab308",  // Yellow 500
    LOW: "#22c55e",     // Green 500
    DEFAULT: "#06b6d4"  // Cyan 500
};

// Map Controller component for auto-flying to incidents
function MapController({ incidents }: { incidents: Incident[] }) {
    const { focusedIncidentId, spotlightId } = useSimulationStore();
    const map = useMap();
    const lastAutoFlyId = { current: null as string | null };
    const animationFrameRef = useRef<number | null>(null);

    // Cinematic 3D Fly-To Animation
    const cinematicFlyTo = useCallback((targetLat: number, targetLng: number, targetZoom: number) => {
        if (!map) return;

        // Cancel existing
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const startCenter = map.getCenter();
        const startZoom = map.getZoom() || 13;
        const startTilt = map.getTilt() || 0;
        const startHeading = map.getHeading() || 0;

        if (!startCenter || !Number.isFinite(targetLat) || !Number.isFinite(targetLng)) {
            map.moveCamera({ center: { lat: targetLat, lng: targetLng }, zoom: targetZoom });
            return;
        }

        const startLat = startCenter.lat();
        const startLng = startCenter.lng();

        // Animation Configuration
        const duration = 4000; // Slow, majestic flight
        const startTime = performance.now();

        // Target 3D Orientation
        const targetTilt = 45; // 45 degree tilt for 3D effect at destination
        const targetHeading = 0; // Reset heading North

        // Flight Arc Configuration
        const dist = Math.sqrt(Math.pow(startLat - targetLat, 2) + Math.pow(startLng - targetLng, 2));
        const isLongHaul = dist > 1.0;
        const minFlightZoom = isLongHaul ? 4.5 : Math.min(startZoom, targetZoom) - 2;

        const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeInOutCubic(progress);

            // Interpolate Position
            const currentLat = startLat + (targetLat - startLat) * eased;
            const currentLng = startLng + (targetLng - startLng) * eased;

            // Interpolate Zoom with Parabolic Arc
            let currentZoom;
            if (progress < 0.5) {
                // Outward phase: Start -> Min
                const outProgress = easeInOutCubic(progress * 2);
                currentZoom = startZoom + (minFlightZoom - startZoom) * outProgress;
            } else {
                // Inward phase: Min -> Target
                const inProgress = easeInOutCubic((progress - 0.5) * 2);
                currentZoom = minFlightZoom + (targetZoom - minFlightZoom) * inProgress;
            }

            // Interpolate Tilt: Top-down (0) -> Angled (45)
            let currentTilt;
            if (progress < 0.7) {
                // Flatten to look straight down during travel
                currentTilt = startTilt * (1 - (progress / 0.7));
            } else {
                // Tilt up as we arrive
                const tiltProgress = (progress - 0.7) / 0.3;
                currentTilt = targetTilt * tiltProgress;
            }

            // Execute Move
            map.moveCamera({
                center: { lat: currentLat, lng: currentLng },
                zoom: currentZoom,
                tilt: currentTilt,
                heading: targetHeading
            });

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                animationFrameRef.current = null;
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
    }, [map]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    // 1. Auto-fly to new COMPLETED incidents (Legacy behavior) -> DISABLED per user request
    // The map should ONLY move if:
    // A) The system is actively analyzing something (Spotlight)
    // B) The user manually clicked something (Focus)
    // We do NOT want it jumping around just because a new pin dropped.


    // 2. Fly to SPOTLIGHT (Analyzing) incident - ONLY when spotlightId CHANGES
    const lastSpotlightFlyId = useRef<string | null>(null);
    useEffect(() => {
        if (!map || !spotlightId) {
            lastSpotlightFlyId.current = null; // Reset when spotlight clears
            return;
        }

        // Only fly if this is a NEW spotlight (not a re-render from incidents changing)
        if (lastSpotlightFlyId.current === spotlightId) return;

        const incident = incidents.find(i => i.id === spotlightId);
        if (incident?.location?.lat && incident?.location?.lng) {
            cinematicFlyTo(incident.location.lat, incident.location.lng, 18);
            lastSpotlightFlyId.current = spotlightId;
        }
    }, [spotlightId, map, cinematicFlyTo, incidents]);

    // 3. Fly to Manual FOCUSED incident - Highest Priority (User Override)
    // IMPORTANT: Track the last focused ID to prevent re-animation when incidents array updates
    const lastFocusedFlyId = useRef<string | null>(null);
    useEffect(() => {
        if (!map || !focusedIncidentId) {
            lastFocusedFlyId.current = null; // Reset when focus clears
            return;
        }

        // Only fly if this is a NEW focus (not a re-render from incidents changing)
        if (lastFocusedFlyId.current === focusedIncidentId) return;

        const incident = incidents.find(i => i.id === focusedIncidentId);
        if (incident?.location?.lat && incident?.location?.lng) {
            cinematicFlyTo(incident.location.lat, incident.location.lng, 18);
            lastFocusedFlyId.current = focusedIncidentId;
        }
    }, [focusedIncidentId, incidents, map, cinematicFlyTo]);

    return null;
}


// Marker content component
function MarkerContent({ incident }: { incident: Incident }) {
    const isAnalyzing = incident.status === "PENDING";
    const isSignalLost = incident.manual_trace_required;
    const color = PRIORITY_COLORS[incident.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.DEFAULT;

    // We enhance brightness here to counteract the parent map filter
    const markerStyle = {
        filter: "brightness(1.5) contrast(1.2)"
    };

    if (isSignalLost) {
        return (
            <div className="relative flex items-center justify-center w-10 h-10" style={markerStyle}>
                {/* Warning Ripple */}
                <div className="absolute inset-[-12px] border border-amber-500/30 rounded-full animate-ping-slow"></div>
                <div className="absolute inset-[-6px] border border-amber-500/50 rounded-full animate-pulse border-dashed"></div>

                {/* Unconfirmed/Question Mark Icon */}
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-950/90 border border-amber-500 text-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)] z-20 backdrop-blur-sm">
                    <span className="font-mono font-bold text-lg">?</span>
                </div>

                {/* Label */}
                <span className="absolute -bottom-6 text-[9px] font-mono font-bold text-amber-500 bg-black/90 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap z-20 uppercase tracking-wider">
                    UNCONFIRMED
                </span>
            </div>
        );
    }

    return (
        <div className="relative flex items-center justify-center w-10 h-10 group" style={markerStyle}>
            {/* Outer Ring / Ripple */}
            {isAnalyzing ? (
                <>
                    <div className="absolute inset-0 border border-cyan-500/50 rounded-full animate-radar-spin border-dashed"></div>
                    <div className="absolute inset-0 bg-cyan-500/10 rounded-full animate-pulse"></div>
                </>
            ) : incident.priority === "CRITICAL" ? (
                <>
                    <div className="absolute inset-[-12px] bg-red-500/20 rounded-full animate-ping-slow"></div>
                    <div className="absolute inset-[-6px] border border-red-500/50 rounded-full animate-pulse-fast"></div>
                </>
            ) : null}

            {/* Core Dot */}
            <div
                className="w-3 h-3 rounded-full border border-white/20 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 transition-transform duration-300 hover:scale-125"
                style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
            />

            {/* Label (Optional - small ID) */}
            <span className="absolute -bottom-5 text-[8px] font-mono font-bold text-white/70 bg-black/60 px-1 rounded backdrop-blur-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {incident.id}
            </span>
        </div>
    );
}

function TacticalMarker({ incident, onSelect, isSelected }: {
    incident: Incident;
    onSelect: (id: string | null) => void;
    isSelected: boolean;
}) {
    const handleClick = useCallback((e: google.maps.MapMouseEvent | any) => {
        onSelect(isSelected ? null : incident.id);
    }, [incident.id, isSelected, onSelect]);

    return (
        <>
            <AdvancedMarker
                position={{ lat: incident.location.lat || 0, lng: incident.location.lng || 0 }}
                onClick={handleClick}
            >
                <MarkerContent incident={incident} />
            </AdvancedMarker>

            {isSelected && (
                <InfoWindow
                    position={{ lat: incident.location.lat || 0, lng: incident.location.lng || 0 }}
                    onCloseClick={() => onSelect(null)}
                    pixelOffset={[0, -25]}
                >
                    <div className="p-1 min-w-[200px] bg-zinc-950 text-white">
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

                        {/* Address / Location Target */}
                        <div className="mb-2 pb-2 border-b border-zinc-700/50">
                            <div className="flex items-start gap-1.5 text-zinc-300">
                                <div className="mt-0.5 text-emerald-500">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                </div>
                                <span className="text-[10px] font-mono leading-tight">
                                    {incident.location?.address || `${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}`}
                                </span>
                            </div>
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
                </InfoWindow>
            )}
        </>
    );
}

export function TacticalMap({ className }: { className?: string }) {
    const { incidents } = useSimulationStore();
    const [isMounted, setIsMounted] = useState(false);
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    const handleMapClick = (ev: MapMouseEvent) => {
        setSelectedIncidentId(null);
    };

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
    const center = firstWithLocation
        ? { lat: firstWithLocation.location.lat, lng: firstWithLocation.location.lng }
        : { lat: 40.7128, lng: -74.0060 };

    const visibleIncidents = incidents.filter(incident =>
        incident.location &&
        incident.location.lat !== 0 &&
        incident.location.lng !== 0 &&
        !incident.manual_trace_required &&
        incident.status !== "PENDING"
    );

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
            {/* Added style filter to force darkness regardless of map tiles */}
            <div className="h-full w-full" style={{ filter: "brightness(0.7) contrast(1.2) grayscale(0.3)" }}>
                <APIProvider apiKey={apiKey}>
                    <Map
                        defaultCenter={center}
                        defaultZoom={13}
                        minZoom={4}
                        mapId="5bb7b00777bfa38ac4774120"
                        disableDefaultUI={true}
                        clickableIcons={false}
                        className="h-full w-full"
                        gestureHandling="greedy"
                        colorScheme="DARK"
                        renderingType="VECTOR"
                        reuseMaps={true}
                        defaultTilt={45}
                        defaultHeading={0}
                        onClick={handleMapClick}
                    >
                        <MapController incidents={incidents} />

                        {visibleIncidents.map((incident) => (
                            <TacticalMarker
                                key={incident.id}
                                incident={incident}
                                onSelect={setSelectedIncidentId}
                                isSelected={selectedIncidentId === incident.id}
                            />
                        ))}
                    </Map>
                </APIProvider>
            </div>

            {/* REMOVED pure black overlay - rely on CSS filter for darkness to avoid layering issues */}

            {/* 4. Radar Sweep Effect (The "Cool" Factor) */}
            <div className="absolute inset-0 pointer-events-none z-[300] overflow-hidden opacity-30">
                <div className="absolute inset-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_340deg,rgba(16,185,129,0.1)_360deg)] animate-radar-spin origin-center"></div>
            </div>

            {/* 5. CRT/Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none z-[350] bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20"></div>

            {/* 6. Vignette */}
            <div className="absolute inset-0 pointer-events-none z-[350] bg-[radial-gradient(circle,transparent_60%,rgba(9,9,11,0.8)_100%)]"></div>

            {/* 7. Corner HUD Elements */}
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
