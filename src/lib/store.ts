import { create } from "zustand";
import { type Incident } from "./types";

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
}));
