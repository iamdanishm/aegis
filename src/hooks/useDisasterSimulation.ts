import { useEffect, useRef } from "react";
import { useSimulationStore } from "@/lib/store";
import simulationData from "@/simulation/simulation_data.json";
import { coordinateIncident } from "@/agents/coordinator";
import { MODELS } from "@/lib/constants";
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

    // Ref to preserve partial analysis results before abort (for Issue 2 fix)
    const partialResultRef = useRef<any>(null);

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


    // Select only what we need for the queue processor to avoid unnecessary re-runs
    const allIncidents = useSimulationStore(state => state.incidents);
    const isMockMode = useSimulationStore(state => state.isMockMode);

    // ------------------------------------------------------------------
    // 3. Queue Processor (Strict Sequential Processing)
    // ------------------------------------------------------------------
    useEffect(() => {
        const processQueue = async () => {
            // Check if we should process: must be playing, not already processing
            // CRITICAL: Block standard queue if Voice Command is running high-priority work
            const isVoiceProcessing = useSimulationStore.getState().isVoiceProcessing;
            if (!isPlaying || isProcessingRef.current || isVoiceProcessing) return;

            // Get the latest state to find the next pending incident
            const currentIncidents = useSimulationStore.getState().incidents;
            const pendingIncident = currentIncidents.find(i => i.status === "PENDING");

            if (!pendingIncident) return;

            // Set lock immediately
            isProcessingRef.current = true;

            try {
                // 1. Mark as ANALYZING in the store IMMEDIATELY - this provides immediate UI feedback
                updateIncident(pendingIncident.id, { status: "ANALYZING" });
                addLog(`[${time}s] [COORDINATOR] Starting analysis for ${pendingIncident.id}...`);

                // Give the UI a tiny bit of time to reflect the ANALYZING state before heavy AI work
                await new Promise(resolve => setTimeout(resolve, 50));

                if (isMockMode) {
                    // Agent info for UI
                    const targetAgent = pendingIncident.type === "VIDEO" ? "Surveillance Agent" : "Triage Agent";
                    const targetModel = pendingIncident.type === "VIDEO" ? MODELS.SURVEILLANCE : MODELS.TRIAGE;

                    useSimulationStore.getState().setActiveAgent(targetAgent);
                    useSimulationStore.getState().setActiveModel(targetModel);

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const { MOCK_RESPONSES } = await import("@/simulation/mock_responses");
                    const mockData = MOCK_RESPONSES[pendingIncident.id] || {
                        status: "TRIAGED",
                        priority: "MEDIUM",
                        reasoning_trace: "Standard mock analysis complete."
                    };

                    updateIncident(pendingIncident.id, { ...mockData, status: "TRIAGED" });
                    addLog(`[${time}s] [COORDINATOR] Mock Analysis complete for ${pendingIncident.id}`);
                } else {
                    // Real-time Streaming AI
                    setRawThinkingProcess("");

                    // 1. Setup AbortController for Interruption
                    const controller = new AbortController();
                    useSimulationStore.getState().setActiveAbortController(controller);

                    const readerRef = { current: null as ReadableStreamDefaultReader<Uint8Array> | null };

                    // Declare outside try block so it's accessible in catch for abort handling
                    let latestResult = { ...pendingIncident, status: "ANALYZING" };

                    try {
                        const response = await fetch("/api/coordinate/stream", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ...pendingIncident, status: "ANALYZING" }),
                            signal: controller.signal // <--- Bind Signal
                        });

                        if (!response.body) throw new Error("No response body");

                        const reader = response.body.getReader();
                        readerRef.current = reader;
                        const decoder = new TextDecoder();
                        let fullThinking = "";
                        let buffer = "";
                        // latestResult is now declared above the try block

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || "";

                            for (const line of lines) {
                                if (!line.trim()) continue;
                                try {
                                    const event = JSON.parse(line);
                                    switch (event.type) {
                                        case "thought":
                                            fullThinking += event.content;
                                            setRawThinkingProcess(fullThinking);
                                            break;
                                        case "agent_info":
                                            useSimulationStore.getState().setActiveAgent(event.agent);
                                            useSimulationStore.getState().setActiveModel(event.model);
                                            break;
                                        case "result":
                                            // Merge the result data
                                            latestResult = { ...latestResult, ...event.data };
                                            break;
                                        case "audit_log":
                                            useSimulationStore.getState().addAgentAuditLog(event.entry);
                                            addLog(`[${time}s] [${event.entry.agent}] ${event.entry.action}`);
                                            break;
                                        case "error":
                                            console.error("Stream Error:", event.message);
                                            latestResult = {
                                                ...latestResult,
                                                reasoning_trace: `Analysis Error: ${event.message}. Falling back to manual triage protocol.`
                                            };
                                            break;
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }

                        // Normal Completion
                        // Preserve result for potential override merge
                        partialResultRef.current = latestResult;
                        updateIncident(pendingIncident.id, {
                            ...latestResult,
                            status: "TRIAGED"
                        });
                        addLog(`[${time}s] [COORDINATOR] Finalized analysis for ${pendingIncident.id}`);

                    } catch (error: any) {
                        if (error.name === "AbortError" || error.message?.includes("aborted")) {
                            // Preserve partial analysis before proceeding (for Issue 2 fix)
                            partialResultRef.current = latestResult;

                            // Check if this was a Context Injection (Same Incident) or Preemption (Different Incident)
                            const freshState = useSimulationStore.getState().incidents.find(i => i.id === pendingIncident.id);

                            if (freshState?.transcript_context) {
                                // SAME INCIDENT OVERRIDE -> Proceed to "Deferred Context Injection" block below
                                addLog(`[${time}s] [COORDINATOR] ⚠️ Analysis Interrupted for Context Injection...`);

                                // Show "VOICE INTERPRETER ACTIVE" in ReasoningLog
                                useSimulationStore.getState().setIsVoiceProcessing(true);
                            } else {
                                // PREEMPTION -> Different incident took priority
                                addLog(`[${time}s] [COORDINATOR] ⏸️ Analysis SUSPENDED for Higher Priority Event.`);

                                // Reset this event to PENDING so it gets picked up again later
                                updateIncident(pendingIncident.id, { status: "PENDING" });

                                // EXIT here so we don't run the deferred block
                                return;
                            }
                        } else {
                            throw error; // Re-throw real errors to be caught by outer catch
                        }
                    } finally {
                        useSimulationStore.getState().setActiveAbortController(null);
                    }

                    // ============================================================
                    // DEFERRED CONTEXT INJECTION (Runs even if Aborted!)
                    // ============================================================
                    const freshIncident = useSimulationStore.getState().incidents.find(i => i.id === pendingIncident.id);
                    if (freshIncident?.transcript_context) {
                        addLog(`[${time}s] [COORDINATOR] 🗣️ User context detected. Running Override Pass...`);
                        setRawThinkingProcess(""); // Reset for new pass

                        try {
                            // Run a SECOND analysis pass with the user's context
                            // CRITICAL FIX: Keep original TYPE so Coordinator routes correctly (e.g. VIDEO -> Surveillance)
                            // We just add the Command Context.
                            const overrideResponse = await fetch("/api/coordinate/stream", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    ...freshIncident,
                                    // FORCE ORIGINAL TYPE (e.g. VIDEO) to ensure Coordinator routes to Surveillance, not Logistics
                                    type: pendingIncident.type,
                                    command_intent: freshIncident.transcript_context,
                                    description_for_simulation: freshIncident.description_for_simulation + `\n[USER CONTEXT]: ${freshIncident.transcript_context}`,
                                    status: "ANALYZING"
                                }),
                            });

                            if (overrideResponse.body) {
                                const overrideReader = overrideResponse.body.getReader();
                                const overrideDecoder = new TextDecoder();
                                let overrideBuffer = "";
                                let overrideResult: any = {};
                                let overrideThinking = "";

                                while (true) {
                                    const { done, value } = await overrideReader.read();
                                    if (done) break;

                                    overrideBuffer += overrideDecoder.decode(value, { stream: true });
                                    const lines = overrideBuffer.split("\n");
                                    overrideBuffer = lines.pop() || "";

                                    for (const line of lines) {
                                        if (!line.trim()) continue;
                                        try {
                                            const event = JSON.parse(line);
                                            switch (event.type) {
                                                case "thought":
                                                    overrideThinking += event.content;
                                                    setRawThinkingProcess(overrideThinking);
                                                    break;
                                                case "agent_info":
                                                    useSimulationStore.getState().setActiveAgent(event.agent);
                                                    useSimulationStore.getState().setActiveModel(event.model);
                                                    break;
                                                case "result":
                                                    overrideResult = event.data;
                                                    break;
                                                case "audit_log":
                                                    useSimulationStore.getState().addAgentAuditLog(event.entry);
                                                    addLog(`[${time}s] [${event.entry.agent}] ${event.entry.action}`);
                                                    break;
                                            }
                                        } catch (e) { /* ignore */ }
                                    }
                                }

                                // MERGE override result with original analysis
                                // Use preserved partial result if available (for Issue 2 fix)
                                const preservedAnalysis = partialResultRef.current;
                                const cleanOriginalTrace = (preservedAnalysis?.reasoning_trace || freshIncident.reasoning_trace || "").trim();

                                // Merge Assets - use preserved data if available
                                const mergedAssets = Array.from(new Set([
                                    ...(preservedAnalysis?.assigned_assets || freshIncident.assigned_assets || []),
                                    ...(overrideResult.assigned_assets || []).filter((a: string) => a !== "SYSTEM_UPDATE")
                                ]));

                                updateIncident(pendingIncident.id, {
                                    ...preservedAnalysis, // Start with preserved analysis (may be partial)
                                    ...freshIncident, // Layer fresh state
                                    ...overrideResult, // Overwrite with NEW AI findings (Location, Priority, Title, etc.)
                                    // Append with separator for SignalFeed visibility, but ReasoningLog will hide it.
                                    reasoning_trace: `${cleanOriginalTrace}\n\n[COMMAND OVERRIDE]: ${overrideResult.command_intent || "Executed"}\n${overrideResult.reasoning_trace || ""}`.trim(),
                                    assigned_assets: mergedAssets,
                                    status: overrideResult.status || "TRIAGED", // Ensure we exit ANALYZING state
                                    transcript_context: undefined // Clear after use
                                });
                                addLog(`[${time}s] [COORDINATOR] ✓ Override merged & status updated for ${pendingIncident.id}`);
                            }
                        } catch (overrideError: any) {
                            console.error("Override pass failed:", overrideError);
                            addLog(`[${time}s] [COORDINATOR] ⚠️ Override pass failed: ${overrideError.message}`);
                            // Fallback to ensure we don't get stuck in ANALYZING
                            updateIncident(pendingIncident.id, { status: "TRIAGED" });
                        } finally {
                            setRawThinkingProcess(null);
                            useSimulationStore.getState().setIsVoiceProcessing(false);
                            partialResultRef.current = null; // Reset for next event
                        }
                    }
                }
            } catch (error: any) {
                console.error("[QUEUE] Critical error:", error);
                updateIncident(pendingIncident.id, {
                    status: "TRIAGED",
                    priority: "HIGH",
                    reasoning_trace: `Error: ${error.message || "Unknown processing error"}. Signal flagged for manual review.`
                });
            } finally {
                // reset transient UI states and release lock
                isProcessingRef.current = false;
                setRawThinkingProcess(null);
                useSimulationStore.getState().setActiveAgent(null);
                useSimulationStore.getState().setActiveModel(null);

                // Immediately check for the next item in the queue instead of waiting for the next tick
                // This ensures snappy processing of the queue
                const nextIncidents = useSimulationStore.getState().incidents;
                const nextPending = nextIncidents.find(i => i.status === "PENDING");
                if (nextPending && isPlaying) {
                    // We don't call it recursively direct to avoid stack overflow, 
                    // the useEffect will re-trigger anyway because allIncidents changed.
                }
            }
        };

        processQueue();
    }, [time, isPlaying, allIncidents, isMockMode, updateIncident, addLog, setRawThinkingProcess]);


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
