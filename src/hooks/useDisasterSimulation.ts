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
        addLog,
        setIsSimulationComplete
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

                // Check if this incident touches Protocol Zero
                if (incident.requires_human_auth) {
                    addLog(`[${time}s] [PROTOCOL ZERO] 🛑 PAUSED ${incident.id} for Authorization.`);
                    incident.auth_status = "PENDING";
                    // Set 30s timeout target (simulation time)
                    incident.auth_timeout_at = time + 30;
                }

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
                        // Don't log "Analysis complete" if it's paused for auth, let UI show that
                        if (!processed.requires_human_auth || processed.auth_status === "APPROVED") {
                            addLog(`[${time}s] [COORDINATOR] Analysis complete for ${incident.id}.`);
                        }
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

    // PROTOCOL ZERO: Timeout Monitor
    useEffect(() => {
        if (!isPlaying) return;

        const checkTimeouts = async () => {
            const pendingAuthIncidents = useSimulationStore.getState().incidents.filter(
                i => i.requires_human_auth && i.auth_status === "PENDING" && i.auth_timeout_at
            );

            for (const inc of pendingAuthIncidents) {
                if (inc.auth_timeout_at && time >= inc.auth_timeout_at) {
                    // TIMEOUT REACHED -> FAIL OPEN (AUTO-APPROVE) as requested
                    addLog(`[${time}s] [PROTOCOL ZERO] ⚠️ TIMEOUT on ${inc.id}. AUTO-APPROVING action...`);

                    // Update Local State
                    updateIncident(inc.id, {
                        auth_status: "APPROVED",
                        reasoning_trace: inc.reasoning_trace + " [AUTO-APPROVED BY SYSTEM TIMEOUT]"
                    });

                    // Re-run Logistics to "Unpause" it
                    // We just call coordinate again, which calls logistics. 
                    // Since auth_status is now APPROVED, logistics will proceed.
                    try {
                        const processed = await coordinateIncident({ ...inc, auth_status: "APPROVED" });
                        updateIncident(inc.id, processed);
                        addLog(`[${time}s] [LOGISTICS] Action Execution Resumed.`);
                    } catch (e) {
                        console.error("Error resuming auto-approved incident", e);
                    }
                }
            }
        };

        checkTimeouts();

    }, [time, isPlaying, updateIncident, addLog]);

    // Auto-Stop Logic
    useEffect(() => {
        if (!isPlaying) return;

        // Find the last scheduled event time
        const lastEventTime = Math.max(...simulationData.map(e => e.trigger_time_offset));
        // Add a buffer to allow for processing/reasoning visualization
        const END_BUFFER = 8;

        // Check if any Protocol Zero incidents are still pending - don't stop until they're resolved
        const pendingAuthIncidents = useSimulationStore.getState().incidents.filter(
            i => i.requires_human_auth && i.auth_status === "PENDING"
        );

        // If there are pending auth incidents, don't stop the simulation yet
        if (pendingAuthIncidents.length > 0) {
            return; // Keep running until all auth decisions are made
        }

        if (time > lastEventTime + END_BUFFER) {
            setIsPlaying(false);
            setIsSimulationComplete(true);
            addLog(`[${time}s] Simulation Complete. Report Generation Available.`);
        }
    }, [time, isPlaying, setIsPlaying, addLog, setIsSimulationComplete]);

    return { time, isPlaying };
}
