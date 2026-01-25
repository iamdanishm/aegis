"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { type Incident } from "@/lib/types";
import { useSimulationStore } from "@/lib/store";

// Component to handle map flying to new incidents
export function MapController({ incidents }: { incidents: Incident[] }) {
    const { focusedIncidentId } = useSimulationStore();
    const map = useMap();
    // Auto-fly to new incidents (or when they get coordinates)
    const lastAutoFlyId = useRef<string | null>(null);

    useEffect(() => {
        // Find the latest incident that has a valid location
        const latestWithLoc = [...incidents].reverse().find(i => i.location?.lat && i.location?.lng);

        if (latestWithLoc && latestWithLoc.location.lat && latestWithLoc.location.lng) {
            // Only fly if we haven't already flown to this specific incident ID automatically
            if (lastAutoFlyId.current !== latestWithLoc.id && map) {
                map.flyTo(
                    [latestWithLoc.location.lat, latestWithLoc.location.lng],
                    15,
                    { duration: 1.5 }
                );
                lastAutoFlyId.current = latestWithLoc.id;
            }
        }
    }, [incidents, map]);

    // Fly to focused incident (from click)
    useEffect(() => {
        if (focusedIncidentId && map) {
            const incident = incidents.find(i => i.id === focusedIncidentId);
            if (incident?.location?.lat && incident?.location?.lng) {
                map.flyTo(
                    [incident.location.lat, incident.location.lng],
                    17, // Closer zoom for focus
                    { duration: 1.0 }
                );
                // Open popup? Maybe. Leaflet makes checking for markers hard here without ref refs. 
                // We'll stick to flyTo for now.
            }
        }
    }, [focusedIncidentId, incidents, map]);

    return null;
}
