import { useEffect } from "react";
import { useSimulationStore } from "@/lib/store";
import simulationData from "@/simulation/simulation_data.json";
import { coordinateIncident } from "@/agents/coordinator";
import { type Incident } from "@/lib/types";

export function useDisasterSimulation() {
    const {
        time,
        isPlaying,
        setIsPlaying,
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

                addLog(`[${time}s] [COORDINATOR] Intercepted new signal: ${incident.id}. Routing...`);
                addIncident(incident);

                // Check Mock Mode
                if (useSimulationStore.getState().isMockMode) {
                    const { MOCK_RESPONSES } = await import("@/simulation/mock_responses");
                    const mockData = MOCK_RESPONSES[incident.id];

                    if (mockData) {
                        setTimeout(() => {
                            const processed = { ...incident, ...mockData };
                            updateIncident(incident.id, processed);
                            addLog(`[${time}s] [COORDINATOR] Flow complete for ${incident.id}.`);
                        }, 1000); // Simulate processing delay
                    } else {
                        addLog(`[${time}s] [COORDINATOR] No mock data for ${incident.id}`);
                    }
                } else {
                    // Call Coordinator (Server Action)
                    try {
                        const processed = await coordinateIncident(incident);
                        updateIncident(incident.id, processed);
                        addLog(`[${time}s] [COORDINATOR] Analysis complete for ${incident.id}.`);
                    } catch (e: any) {
                        console.error(e);
                        addLog(`[${time}s] [COORDINATOR] Error processing ${incident.id}: ${e.message || "Unknown error"}`);
                    }
                }
            }
        };

        if (isPlaying) {
            checkForEvents();
        }
    }, [time, isPlaying, addIncident, updateIncident, addLog]);

    // Auto-Stop Logic
    useEffect(() => {
        if (!isPlaying) return;

        // Find the last scheduled event time
        const lastEventTime = Math.max(...simulationData.map(e => e.trigger_time_offset));
        // Add a buffer to allow for processing/reasoning visualization
        const END_BUFFER = 8;

        if (time > lastEventTime + END_BUFFER) {
            setIsPlaying(false);
            addLog(`[${time}s] Simulation Complete. Stopping timer.`);
        }
    }, [time, isPlaying, setIsPlaying, addLog]);

    return { time, isPlaying };
}
