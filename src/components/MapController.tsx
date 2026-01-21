"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { type Incident } from "@/lib/types";

// Component to handle map flying to new incidents
export function MapController({ incidents }: { incidents: Incident[] }) {
    const map = useMap();
    const prevIncidentCount = useRef(incidents.length);

    useEffect(() => {
        if (incidents.length > prevIncidentCount.current) {
            // New incident added - fly to it
            const latestIncident = incidents[incidents.length - 1];
            if (latestIncident && map) {
                map.flyTo(
                    [latestIncident.location.lat, latestIncident.location.lng],
                    15,
                    { duration: 1.5 }
                );
            }
        }
        prevIncidentCount.current = incidents.length;
    }, [incidents, map]);

    return null;
}
