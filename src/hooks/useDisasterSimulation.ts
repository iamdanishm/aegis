import { useEffect, useRef } from "react";
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
        setIsSimulationComplete,
        setRawThinkingProcess,
        rawThinkingProcess
    } = useSimulationStore();

    // Ref to track if a processing stream is currently active
    const isProcessingRef = useRef(false);

    // ------------------------------------------------------------------
    // 1. Simulation Timer (Always runs, decoupled from processing)
    // ------------------------------------------------------------------
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                // In Live Mode, we NEVER pause time for processing. Events spawn and queue up.
                // In Mock Mode, we might pause, but for now, let's keep it fluid.
                incrementTime();
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, incrementTime]);

    // ------------------------------------------------------------------
    // 2. Event Spawner (Adds to PENDING list based on time)
    // ------------------------------------------------------------------
    useEffect(() => {
        const spawnEvents = () => {
            // Find events that match the current time
            const events = simulationData.filter((e) => e.trigger_time_offset === time);

            for (const event of events) {
                // Check if already added to avoid duplicates
                const exists = useSimulationStore.getState().incidents.find(i => i.id === event.id);
                if (exists) continue;

                const incident: Incident = {
                    ...event,
                    type: event.type as any,
                    status: "PENDING", // Initial state
                    timestamp: new Date().toISOString(),
                    responder_status: "PENDING" // Default responder status
                } as unknown as Incident;

                // Safety Valve
                if (incident.requires_human_auth) {
                    addLog(`[${time}s] [PROTOCOL ZERO] 🛑 PAUSED ${incident.id} for Authorization.`);
                    incident.auth_status = "PENDING";
                    incident.auth_timeout_at = time + 30;
                }

                addLog(`[${time}s] [SYSTEM] Signal Detected: ${incident.id}`);
                addIncident(incident);
            }
        };

        if (isPlaying) spawnEvents();
    }, [time, isPlaying, addIncident, addLog]);


    // ------------------------------------------------------------------
    // 3. Queue Processor (Strict Sequential Processing)
    // ------------------------------------------------------------------
    useEffect(() => {
        const processQueue = async () => {
            if (!isPlaying || isProcessingRef.current) {
                return; // Don't process if not playing or already busy
            }

            const { incidents, isMockMode, updateIncident: storeUpdateIncident } = useSimulationStore.getState();

            // Find the first incident that is PENDING and not yet processed
            const incidentToProcess = incidents.find(i => i.status === "PENDING");

            if (!incidentToProcess) {
                return; // No incidents in the queue to process
            }

            isProcessingRef.current = true; // Set lock

            // Mark as ANALYZING to update UI and prevent re-selection (though lock handles re-selection)
            storeUpdateIncident(incidentToProcess.id, { status: "ANALYZING" } as any);

            try {
                // Check Mock Mode
                if (isMockMode) {
                    const { MOCK_RESPONSES } = await import("@/simulation/mock_responses");
                    const mockData = MOCK_RESPONSES[incidentToProcess.id];

                    if (mockData) {
                        // Simulate processing delay
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const processed = { ...incidentToProcess, ...mockData, status: "TRIAGED" }; // Ensure final status

                        // Release lock BEFORE update to allow effect re-trigger for next item
                        isProcessingRef.current = false;
                        storeUpdateIncident(incidentToProcess.id, processed as any);

                        addLog(`[${time}s] [COORDINATOR] Flow complete for ${incidentToProcess.id}.`);
                    } else {
                        addLog(`[${time}s] [COORDINATOR] No mock data for ${incidentToProcess.id}`);
                        // Release lock BEFORE update
                        isProcessingRef.current = false;
                        storeUpdateIncident(incidentToProcess.id, { status: "TRIAGED" } as any);
                    }
                } else {
                    // Call Streaming Coordinator (Real-time Glass Box)
                    setRawThinkingProcess(""); // Reset thinking buffer

                    const response = await fetch("/api/coordinate/stream", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...incidentToProcess, status: "ANALYZING" }), // Pass updated abstract
                    });

                    if (!response.body) throw new Error("No response body");

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let processed = incidentToProcess;
                    let fullThinking = "";
                    let buffer = "";

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const event = JSON.parse(line);
                                if (event.type === "thought") {
                                    fullThinking += event.content;
                                    setRawThinkingProcess(fullThinking);
                                } else if (event.type === "result") {
                                    processed = { ...incidentToProcess, ...event.data };
                                } else if (event.type === "error") {
                                    console.error("Stream Error:", event.message);
                                } else if (event.type === "audit_log") {
                                    addLog(`[${time}s] [${event.entry.agent}] ${event.entry.action}`);
                                    useSimulationStore.getState().addAgentAuditLog(event.entry);
                                }
                            } catch (e) {
                                console.warn("JSON Parse Error in stream chunk:", line);
                            }
                        }
                    }

                    // Finalize
                    setRawThinkingProcess(null); // Clear thinking state

                    if (!processed.requires_human_auth || processed.auth_status === "APPROVED") {
                        addLog(`[${time}s] [COORDINATOR] Analysis complete for ${incidentToProcess.id}.`);
                    }

                    // Release lock BEFORE update
                    isProcessingRef.current = false;

                    // Mark as TRIAGED/RESOLVED to clear from queue and trigger next
                    // Ensure status is not PENDING/ANALYZING if we are done
                    const finalStatus = processed.auth_status === "PENDING" ? "ANALYZING" : "TRIAGED";
                    // Wait, if auth is pending, we might want to keep it as ANALYZING or a new "WAITING_AUTH" status?
                    // Actually, if auth is pending, it shouldn't hold up the queue?
                    // "In Live Mode, we NEVER pause time for processing. Events spawn and queue up."
                    // If Protocol Zero holds up the generic queue, that's bad.
                    // But `processQueue` picks `status === "PENDING"`.
                    // If we leave it as `ANALYZING` waiting for auth, `processQueue` will pick the NEXT PENDING one.
                    // THIS IS GOOD. Parallel-ish handling of the auth wait, while processing new events.

                    storeUpdateIncident(incidentToProcess.id, { ...processed, status: finalStatus === "ANALYZING" && processed.requires_human_auth ? "TRIAGED" : "TRIAGED" } as any);
                    // Force TRIAGED so it doesn't get picked again, even if waiting for auth (Auth is a different state)
                }
            } catch (e: any) {
                console.error(e);
                addLog(`[${time}s] [COORDINATOR] Error processing ${incidentToProcess.id}: ${e.message || "Unknown error"}`);
                setRawThinkingProcess(null);

                isProcessingRef.current = false;
                storeUpdateIncident(incidentToProcess.id, { status: "TRIAGED" } as any);
            }
        };

        // Trigger processing whenever time changes, or INCIDENTS change.
        // We subscribe to the store's incidents to know when one finishes and next is ready.
        // We use a simplified dependency to avoid deep equality checks: just the count of pending items?
        // Actually, depending on `incidents` is fine if the store implementation is stable.
        // But better: use simulationStore.subscribe inside useEffect?
        // No, standard React reactivity:
        processQueue();
    }, [time, isPlaying, addLog, setRawThinkingProcess, useSimulationStore.getState().incidents]);


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
                    const isMockMode = useSimulationStore.getState().isMockMode;
                    if (isMockMode) {
                        const { MOCK_RESPONSES } = await import("@/simulation/mock_responses");
                        const mock = MOCK_RESPONSES[inc.id];
                        setTimeout(() => {
                            updateIncident(inc.id, {
                                ...mock,
                                auth_status: "APPROVED",
                                status: "TRIAGED"
                            });
                        }, 1000);
                        addLog(`[${time}s] [LOGISTICS] Action Execution Resumed (MOCK).`);
                    } else {
                        try {
                            const processed = await coordinateIncident({ ...inc, auth_status: "APPROVED" });
                            updateIncident(inc.id, processed);
                            addLog(`[${time}s] [LOGISTICS] Action Execution Resumed.`);
                        } catch (e) {
                            console.error("Error resuming auto-approved incident", e);
                        }
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

        const allIncidents = useSimulationStore.getState().incidents;

        // Check if any Protocol Zero incidents are still pending - don't stop until they're resolved
        const pendingAuthIncidents = allIncidents.filter(
            i => i.requires_human_auth && i.auth_status === "PENDING"
        );

        // Check if any incidents are still being processed (PENDING or ANALYZING)
        const pendingTriageIncidents = allIncidents.filter(
            i => i.status === "PENDING" || i.status === "ANALYZING"
        );

        // If there are pending auth incidents or pending triage/analysis, don't stop the simulation yet
        if (pendingAuthIncidents.length > 0 || pendingTriageIncidents.length > 0) {
            return; // Keep running until all decisions are made and all incidents triaged
        }

        if (time > lastEventTime + END_BUFFER) {
            setIsPlaying(false);
            setIsSimulationComplete(true);
            addLog(`[${time}s] Simulation Complete. Report Generation Available.`);
        }
    }, [time, isPlaying, setIsPlaying, addLog, setIsSimulationComplete]);

    return { time, isPlaying };
}
