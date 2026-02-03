import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type Incident, type MissionReport, type AgentAuditLog } from "./types";

interface SimulationState {
    time: number;
    isPlaying: boolean;
    incidents: Incident[];
    logs: string[];
    agentAuditLogs: AgentAuditLog[]; // New: Detailed Audit Trail

    setTime: (time: number) => void;
    incrementTime: () => void;
    setIsPlaying: (isPlaying: boolean) => void;
    addIncident: (incident: Incident) => void;
    updateIncident: (id: string, updates: Partial<Incident>) => void;
    addLog: (log: string) => void;
    addAgentAuditLog: (log: AgentAuditLog) => void;
    isMockMode: boolean;
    setIsMockMode: (isMockMode: boolean) => void;
    focusedIncidentId: string | null;
    setFocusedIncidentId: (id: string | null) => void;
    notification: { message: string, type: "error" | "success" | "info" } | null;
    showNotification: (message: string, type?: "error" | "success" | "info") => void;
    isMicAuthorized: boolean;
    setIsMicAuthorized: (authorized: boolean) => void;
    report: MissionReport | null;
    setReport: (report: MissionReport | null) => void;
    isMissionComplete: boolean;
    setIsMissionComplete: (complete: boolean) => void;

    isReportOpen: boolean;
    setIsReportOpen: (isOpen: boolean) => void;

    isGeneratingReport: boolean;
    setIsGeneratingReport: (isGenerating: boolean) => void;

    rawThinkingProcess: string | null;
    setRawThinkingProcess: (content: string | null) => void;

    activeAgent: string | null;
    setActiveAgent: (agent: string | null) => void;
    activeModel: string | null;
    setActiveModel: (model: string | null) => void;

    // Voice Processing State
    isVoiceProcessing: boolean;
    setIsVoiceProcessing: (isProcessing: boolean) => void;

    activeAbortController: AbortController | null;
    setActiveAbortController: (controller: AbortController | null) => void;

    // Spotlight Protocol: Parallel processing state
    spotlightId: string | null;
    setSpotlightId: (id: string | null) => void;
    processingBatch: string[];
    setProcessingBatch: (ids: string[]) => void;

    // Reset function to clear state
    resetSimulation: () => void;
}

// Initial State for resets
const initialState = {
    time: 0,
    isPlaying: false,
    incidents: [] as Incident[],
    logs: [] as string[],
    isMockMode: false,
    focusedIncidentId: null,
    notification: null,
    isMicAuthorized: false,
    report: null,
    isMissionComplete: false,
    isReportOpen: false,
    isGeneratingReport: false,
    rawThinkingProcess: null,
    agentAuditLogs: [] as AgentAuditLog[],
    activeAgent: null,
    activeModel: null,
    isVoiceProcessing: false,
    activeAbortController: null,
    spotlightId: null,
    processingBatch: [] as string[],
};

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set) => ({
            ...initialState,
            agentAuditLogs: initialState.agentAuditLogs,

            setTime: (time) => set({ time }),
            incrementTime: () => set((state) => ({ time: state.time + 1 })),
            setIsPlaying: (isPlaying) => set((state) => {
                // When STOPPING the simulation, abort all active processing
                if (!isPlaying && state.isPlaying) {
                    // Abort the active hero fetch if running
                    if (state.activeAbortController) {
                        state.activeAbortController.abort();
                    }
                    // Reset all transient processing state
                    return {
                        isPlaying: false,
                        activeAbortController: null,
                        rawThinkingProcess: null,
                        activeAgent: null,
                        activeModel: null,
                        spotlightId: null,
                        processingBatch: [],
                        isVoiceProcessing: false,
                    };
                }
                return { isPlaying };
            }),

            addIncident: (incident) => set((state) => ({
                incidents: [...state.incidents, incident],
                logs: [...state.logs, `[${state.time}s] New Signal: ${incident.id}`]
            })),

            updateIncident: (id, updates) => set((state) => ({
                incidents: state.incidents.map((inc) =>
                    inc.id === id ? { ...inc, ...updates } : inc
                )
            })),

            addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),

            addAgentAuditLog: (log) => set((state) => {
                // Also persist to the Mission Report if it exists, or prepare for it
                return { agentAuditLogs: [...state.agentAuditLogs, log] };
            }),

            setIsMockMode: (isMockMode) => set({ isMockMode }),

            setFocusedIncidentId: (focusedIncidentId) => set({ focusedIncidentId }),

            showNotification: (message, type = "info") => {
                set({ notification: { message, type } });
                setTimeout(() => set({ notification: null }), 5000);
            },

            setIsMicAuthorized: (isMicAuthorized) => set({ isMicAuthorized }),

            setReport: (report) => set({ report }),

            setIsMissionComplete: (isMissionComplete) => set({ isMissionComplete }),

            setIsReportOpen: (isReportOpen) => set({ isReportOpen }),

            setIsGeneratingReport: (isGeneratingReport) => set({ isGeneratingReport }),

            setRawThinkingProcess: (rawThinkingProcess) => set({ rawThinkingProcess }),

            setActiveAgent: (activeAgent) => set({ activeAgent }),
            setActiveModel: (activeModel) => set({ activeModel }),
            setIsVoiceProcessing: (isVoiceProcessing) => set({ isVoiceProcessing }),

            activeAbortController: null,
            setActiveAbortController: (controller) => set({ activeAbortController: controller }),

            spotlightId: null,
            setSpotlightId: (spotlightId) => set({ spotlightId }),
            processingBatch: [],
            setProcessingBatch: (processingBatch) => set({ processingBatch }),

            resetSimulation: () => set(initialState),
        }),
        {
            name: "aegis-simulation-store", // Storage key
            storage: createJSONStorage(() => localStorage),
            // Persist only essential data, not transient UI states
            partialize: (state) => ({
                time: state.time,
                isPlaying: state.isPlaying,
                incidents: state.incidents,
                logs: state.logs,
                agentAuditLogs: state.agentAuditLogs,
                isMockMode: state.isMockMode,
                isMissionComplete: state.isMissionComplete,
                report: state.report,
            }),
        }
    )
);

// Cross-Tab Synchronization: Listen for storage events from other tabs
if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key === "aegis-simulation-store" && event.newValue) {
            try {
                const newState = JSON.parse(event.newValue);
                const currentState = useSimulationStore.getState();

                // Only update if data has actually changed to prevent infinite loops
                const hasChanges =
                    newState.state?.time !== currentState.time ||
                    JSON.stringify(newState.state?.incidents) !== JSON.stringify(currentState.incidents) ||
                    newState.state?.isMissionComplete !== currentState.isMissionComplete;

                if (hasChanges) {
                    // We use setTimeout to avoid race conditions with Zustand's internal handling
                    setTimeout(() => {
                        useSimulationStore.setState({
                            time: newState.state?.time ?? currentState.time,
                            isPlaying: newState.state?.isPlaying ?? currentState.isPlaying,
                            incidents: newState.state?.incidents ?? currentState.incidents,
                            logs: newState.state?.logs ?? currentState.logs,
                            isMockMode: newState.state?.isMockMode ?? currentState.isMockMode,
                            isMissionComplete: newState.state?.isMissionComplete ?? currentState.isMissionComplete,
                            report: newState.state?.report ?? currentState.report,
                        });
                    }, 0);
                }
            } catch (e) {
                console.warn("[STORE] Failed to parse cross-tab sync data", e);
            }
        }
    });
}
