import { useEffect } from "react";
import { useSimulationStore } from "@/lib/store";
import simulationData from "@/simulation/simulation_data.json";
import { coordinateIncident } from "@/agents/coordinator";
import { type Incident } from "@/lib/types";

export function useDisasterSimulation() {
    const {
        time,
        isPlaying,
        incrementTime,
        addIncident,
        updateIncident,
        addLog
    } = useSimulationStore();

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                incrementTime();
            }, 1000); // 1 real second = 1 simulation second
        }
        return () => clearInterval(interval);
    }, [isPlaying, incrementTime]);

    // Event Trigger Effect
    useEffect(() => {
        const checkForEvents = async () => {
            // Find events that match the current time
            const events = simulationData.filter((e) => e.trigger_time_offset === time);

            for (const event of events) {
                // Add initial pending incident to UI
                // We need to cast event to Incident or generic type because JSON import might be strict
                const incident: Incident = {
                    ...event,
                    type: event.type as any,
                    status: "PENDING",
                    timestamp: new Date().toISOString()
                } as unknown as Incident; // Safe cast for this demo

                addLog(`[${time}s] Triggering Event ${incident.id}...`);
                addIncident(incident);

                // Call Coordinator (Server Action)
                try {
                    const processed = await coordinateIncident(incident);
                    updateIncident(incident.id, processed);
                    addLog(`[${time}s] Processed ${incident.id}: Priority ${processed.priority}`);
                } catch (e) {
                    console.error(e);
                    addLog(`[${time}s] Error processing ${incident.id}`);
                }
            }
        };

        if (isPlaying) {
            checkForEvents();
        }
    }, [time, isPlaying, addIncident, updateIncident, addLog]);

    return { time, isPlaying };
}
