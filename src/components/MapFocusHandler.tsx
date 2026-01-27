"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useSimulationStore } from "@/lib/store";

export function MapFocusHandler() {
    const map = useMap();
    const { focusedIncidentId, incidents } = useSimulationStore();

    useEffect(() => {
        if (focusedIncidentId) {
            const incident = incidents.find(i => i.id === focusedIncidentId);
            if (incident && incident.location && incident.location.lat && incident.location.lng) {
                map.flyTo([incident.location.lat, incident.location.lng], 16, {
                    animate: true,
                    duration: 1.5
                });
            }
        }
    }, [focusedIncidentId, incidents, map]);

    return null;
}
