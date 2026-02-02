import { useEffect, useRef } from "react";
import { useSimulationStore } from "@/lib/store";
import simulationData from "@/simulation/simulation_data.json";
import { coordinateIncident } from "@/agents/coordinator";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";

// Worker Pool Configuration
const MAX_CONCURRENT_WORKERS = 3;

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

    // Worker Pool State - tracks how many workers are currently active
    const activeWorkerCountRef = useRef(0);
    // Track which incident IDs are currently being processed to avoid duplicates
    const processingIdsRef = useRef<Set<string>>(new Set());

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
    // 3. Queue Processor (SPOTLIGHT PROTOCOL: Parallel Batch Processing)
    // ------------------------------------------------------------------
    useEffect(() => {
        const processQueue = async () => {
            // Check if we should process: must be playing, not at max capacity
            // CRITICAL: Block standard queue if Voice Command is running high-priority work
            const isVoiceProcessing = useSimulationStore.getState().isVoiceProcessing;
            if (!isPlaying || isVoiceProcessing) return;

            // Check if we have available worker slots
            const availableSlots = MAX_CONCURRENT_WORKERS - activeWorkerCountRef.current;
            if (availableSlots <= 0) return;

            // Get the latest state to find pending incidents (exclude already processing)
            const currentIncidents = useSimulationStore.getState().incidents;
            const pendingIncidents = currentIncidents.filter(
                i => i.status === "PENDING" && !processingIdsRef.current.has(i.id)
            );

            if (pendingIncidents.length === 0) return;

            // Take only as many as we have slots for
            const batch = pendingIncidents.slice(0, availableSlots);

            // Priority heuristics for Hero selection (highest expected risk)
            const getPriorityScore = (incident: typeof batch[0]): number => {
                let score = 0;
                const desc = (incident.description_for_simulation || incident.raw_input || "").toLowerCase();
                const input = (incident.raw_input || "").toLowerCase();

                // Infer type if missing (for scoring purposes only)
                const isVideo = incident.type === "VIDEO" || input.endsWith(".mp4") || input.endsWith(".mov") || input.endsWith(".avi");
                const isAudio = incident.type === "AUDIO" || input.endsWith(".mp3") || input.endsWith(".wav");
                const isCommand = incident.type === "COMMAND";

                // Type-based priority
                if (isCommand) score += 100; // Voice of God Override (Instant Hero)
                if (isVideo) score += 20; // Visual confirmation = higher priority
                if (isAudio) score += 10;

                // Keyword-based priority
                if (desc.includes("trapped")) score += 30;
                if (desc.includes("collapse")) score += 25;
                if (desc.includes("fire")) score += 25;
                if (desc.includes("drowning")) score += 25;
                if (desc.includes("electr")) score += 20;
                if (desc.includes("elderly")) score += 15;
                if (desc.includes("children") || desc.includes("child")) score += 15;
                if (desc.includes("critical")) score += 20;
                if (desc.includes("emergency")) score += 10;

                return score;
            };

            // Sort batch by priority score (descending) and select Hero
            const sortedBatch = [...batch].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
            const heroIncident = sortedBatch[0];
            const heroId = heroIncident.id;
            const batchIds = batch.map(i => i.id);

            // Set spotlight (Hero) state
            useSimulationStore.getState().setSpotlightId(heroId);

            addLog(`[${time}s] [WORKER POOL] Processing ${batch.length} signal(s). Hero: ${heroId}. Active: ${activeWorkerCountRef.current + batch.length}/${MAX_CONCURRENT_WORKERS}`);

            // Claim worker slots and track processing IDs BEFORE async work
            activeWorkerCountRef.current += batch.length;
            for (const incident of batch) {
                processingIdsRef.current.add(incident.id);
            }

            // Update processingBatch with ALL currently processing IDs (not just this batch)
            useSimulationStore.getState().setProcessingBatch(Array.from(processingIdsRef.current));

            try {
                // Mark ALL batch incidents as ANALYZING immediately
                for (const incident of batch) {
                    updateIncident(incident.id, { status: "ANALYZING" });
                }

                // Give the UI a tiny bit of time to reflect the ANALYZING state before heavy AI work
                await new Promise(resolve => setTimeout(resolve, 50));

                if (isMockMode) {
                    // ============================================================
                    // MOCK MODE: Parallel processing simulation
                    // ============================================================
                    const processMockIncident = async (incident: typeof batch[0], isHero: boolean) => {
                        const input = (incident.raw_input || "").toLowerCase();
                        const isVideo = incident.type === "VIDEO" || input.endsWith(".mp4") || input.endsWith(".mov") || input.endsWith(".avi");

                        const targetAgent = isVideo ? "Surveillance Agent" : "Triage Agent";
                        const targetModel = isVideo ? MODELS.SURVEILLANCE : MODELS.TRIAGE;

                        if (isHero) {
                            useSimulationStore.getState().setActiveAgent(targetAgent);
                            useSimulationStore.getState().setActiveModel(targetModel);
                        }

                        // Staggered delays for visual effect
                        await new Promise(resolve => setTimeout(resolve, isHero ? 2000 : 1500 + Math.random() * 1000));

                        const { MOCK_RESPONSES } = await import("@/simulation/mock_responses");
                        const mockData = MOCK_RESPONSES[incident.id] || {
                            status: "TRIAGED",
                            priority: "MEDIUM",
                            reasoning_trace: "Standard mock analysis complete.",
                            display_reasoning: ["Signal analyzed", "No critical issues", "Standard protocol"]
                        };

                        updateIncident(incident.id, { ...mockData, status: "TRIAGED" });
                        addLog(`[${time}s] [COORDINATOR] ${isHero ? "🎯 Hero" : "📋"} Analysis complete: ${incident.id}`);
                    };

                    // Process all in parallel
                    await Promise.all(batch.map(inc => processMockIncident(inc, inc.id === heroId)));
                } else {
                    // ============================================================
                    // REAL-TIME STREAMING AI: Parallel processing with Hero focus
                    // ============================================================
                    // Hero gets full streaming treatment, background incidents process in parallel

                    const backgroundIncidents = batch.filter(inc => inc.id !== heroId);

                    // Process background incidents (non-streaming, parallel)
                    const processBackgroundIncident = async (incident: typeof batch[0]) => {
                        try {
                            const response = await fetch("/api/coordinate/stream", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ...incident, status: "ANALYZING" }),
                            });

                            if (!response.body) throw new Error("No response body");

                            const reader = response.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = "";
                            let result: any = { ...incident };

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
                                        if (event.type === "result") {
                                            result = { ...result, ...event.data };
                                        } else if (event.type === "audit_log") {
                                            useSimulationStore.getState().addAgentAuditLog(event.entry);
                                        }
                                    } catch (e) { /* ignore */ }
                                }
                            }

                            updateIncident(incident.id, { ...result, status: "TRIAGED" });
                            addLog(`[${time}s] [COORDINATOR] 📋 Background complete: ${incident.id}`);
                        } catch (error: any) {
                            console.error(`Background incident ${incident.id} error:`, error);
                            updateIncident(incident.id, {
                                status: "TRIAGED",
                                priority: "MEDIUM",
                                reasoning_trace: `Background processing error: ${error.message}`
                            });
                        }
                    };

                    // Start background processing (don't await - run in parallel)
                    const backgroundPromises = backgroundIncidents.map(inc => processBackgroundIncident(inc));

                    // Process Hero with full streaming and UI updates
                    setRawThinkingProcess("");

                    // 1. Setup AbortController for Interruption
                    const controller = new AbortController();
                    useSimulationStore.getState().setActiveAbortController(controller);

                    const readerRef = { current: null as ReadableStreamDefaultReader<Uint8Array> | null };

                    // Declare outside try block so it's accessible in catch for abort handling
                    let latestResult = { ...heroIncident, status: "ANALYZING" };

                    try {
                        const response = await fetch("/api/coordinate/stream", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ...heroIncident, status: "ANALYZING" }),
                            signal: controller.signal // <--- Bind Signal
                        });

                        if (!response.body) throw new Error("No response body");

                        const reader = response.body.getReader();
                        readerRef.current = reader;
                        const decoder = new TextDecoder();
                        let fullThinking = "";
                        let buffer = "";

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
                        updateIncident(heroIncident.id, {
                            ...latestResult,
                            status: "TRIAGED"
                        });
                        addLog(`[${time}s] [COORDINATOR] 🎯 Hero finalized: ${heroIncident.id}`);

                    } catch (error: any) {
                        if (error.name === "AbortError" || error.message?.includes("aborted")) {
                            // Preserve partial analysis before proceeding (for Issue 2 fix)
                            partialResultRef.current = latestResult;

                            // Check if this was a Context Injection (Same Incident) or Preemption (Different Incident)
                            const freshState = useSimulationStore.getState().incidents.find(i => i.id === heroIncident.id);

                            if (freshState?.transcript_context) {
                                // SAME INCIDENT OVERRIDE -> Proceed to "Deferred Context Injection" block below
                                addLog(`[${time}s] [COORDINATOR] ⚠️ Analysis Interrupted for Context Injection...`);

                                // Show "VOICE INTERPRETER ACTIVE" in ReasoningLog
                                useSimulationStore.getState().setIsVoiceProcessing(true);
                            } else {
                                // PREEMPTION -> Different incident took priority
                                addLog(`[${time}s] [COORDINATOR] ⏸️ Analysis SUSPENDED for Higher Priority Event.`);

                                // Reset this event to PENDING so it gets picked up again later
                                updateIncident(heroIncident.id, { status: "PENDING" });

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
                    const freshIncident = useSimulationStore.getState().incidents.find(i => i.id === heroIncident.id);
                    if (freshIncident?.transcript_context) {
                        addLog(`[${time}s] [COORDINATOR] 🗣️ User context detected. Running Override Pass...`);
                        setRawThinkingProcess(""); // Reset for new pass

                        try {
                            // Run a SECOND analysis pass with the user's context
                            const overrideResponse = await fetch("/api/coordinate/stream", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    ...freshIncident,
                                    // FORCE ORIGINAL TYPE to ensure Coordinator routes correctly
                                    type: heroIncident.type,
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
                                const preservedAnalysis = partialResultRef.current;
                                const cleanOriginalTrace = (preservedAnalysis?.reasoning_trace || freshIncident.reasoning_trace || "").trim();

                                // Merge Assets - use preserved data if available
                                const mergedAssets = Array.from(new Set([
                                    ...(preservedAnalysis?.assigned_assets || freshIncident.assigned_assets || []),
                                    ...(overrideResult.assigned_assets || []).filter((a: string) => a !== "SYSTEM_UPDATE")
                                ]));

                                updateIncident(heroIncident.id, {
                                    ...preservedAnalysis,
                                    ...freshIncident,
                                    ...overrideResult,
                                    reasoning_trace: `${cleanOriginalTrace}\n\n[COMMAND OVERRIDE]: ${overrideResult.command_intent || "Executed"}\n${overrideResult.reasoning_trace || ""}`.trim(),
                                    assigned_assets: mergedAssets,
                                    status: overrideResult.status || "TRIAGED",
                                    transcript_context: undefined
                                });
                                addLog(`[${time}s] [COORDINATOR] ✓ Override merged for ${heroIncident.id}`);
                            }
                        } catch (overrideError: any) {
                            console.error("Override pass failed:", overrideError);
                            addLog(`[${time}s] [COORDINATOR] ⚠️ Override pass failed: ${overrideError.message}`);
                            updateIncident(heroIncident.id, { status: "TRIAGED" });
                        } finally {
                            setRawThinkingProcess(null);
                            useSimulationStore.getState().setIsVoiceProcessing(false);
                            partialResultRef.current = null;
                        }
                    }

                    // Wait for all background incidents to complete
                    await Promise.all(backgroundPromises);
                }
            } catch (error: any) {
                console.error("[QUEUE] Critical error:", error);
                // Mark all batch incidents as errored
                for (const incident of batch) {
                    updateIncident(incident.id, {
                        status: "TRIAGED",
                        priority: "HIGH",
                        reasoning_trace: `Error: ${error.message || "Unknown processing error"}. Signal flagged for manual review.`
                    });
                }
            } finally {
                // Release worker slots and clear processing IDs
                activeWorkerCountRef.current -= batch.length;
                for (const incident of batch) {
                    processingIdsRef.current.delete(incident.id);
                }

                // Update UI batch to reflect remaining processing
                const remainingBatch = Array.from(processingIdsRef.current);
                useSimulationStore.getState().setProcessingBatch(remainingBatch);

                // Only clear spotlight/agent if no more workers are active
                if (activeWorkerCountRef.current === 0) {
                    setRawThinkingProcess(null);
                    useSimulationStore.getState().setActiveAgent(null);
                    useSimulationStore.getState().setActiveModel(null);
                    useSimulationStore.getState().setSpotlightId(null);
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
