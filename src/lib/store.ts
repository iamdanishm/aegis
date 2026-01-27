import { create } from "zustand";
import { type Incident, type MissionReport } from "./types";

interface SimulationState {
    time: number;
    isPlaying: boolean;
    incidents: Incident[];
    logs: string[];

    setTime: (time: number) => void;
    incrementTime: () => void;
    setIsPlaying: (isPlaying: boolean) => void;
    addIncident: (incident: Incident) => void;
    updateIncident: (id: string, updates: Partial<Incident>) => void;
    addLog: (log: string) => void;
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
    isSimulationComplete: boolean;
    setIsSimulationComplete: (complete: boolean) => void;

    isReportOpen: boolean;
    setIsReportOpen: (isOpen: boolean) => void;

    isGeneratingReport: boolean;
    setIsGeneratingReport: (isGenerating: boolean) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
    time: 0,
    isPlaying: false,
    incidents: [],
    logs: [],

    setTime: (time) => set({ time }),
    incrementTime: () => set((state) => ({ time: state.time + 1 })),
    setIsPlaying: (isPlaying) => set({ isPlaying }),

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

    isMockMode: false,
    setIsMockMode: (isMockMode) => set({ isMockMode }),

    focusedIncidentId: null,
    setFocusedIncidentId: (focusedIncidentId) => set({ focusedIncidentId }),

    notification: null,
    showNotification: (message, type = "info") => {
        set({ notification: { message, type } });
        setTimeout(() => set({ notification: null }), 5000);
    },

    isMicAuthorized: false,
    setIsMicAuthorized: (isMicAuthorized) => set({ isMicAuthorized }),

    report: null,
    setReport: (report) => set({ report }),

    isSimulationComplete: false,
    setIsSimulationComplete: (isSimulationComplete) => set({ isSimulationComplete }),

    isReportOpen: false,
    setIsReportOpen: (isReportOpen) => set({ isReportOpen }),

    isGeneratingReport: false,
    setIsGeneratingReport: (isGeneratingReport) => set({ isGeneratingReport }),
}));
