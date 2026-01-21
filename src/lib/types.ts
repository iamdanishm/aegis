export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Incident {
    id: string;
    type: "AUDIO" | "VIDEO" | "TEXT";
    raw_input: string; // URL or Base64 or Text
    timestamp: string;
    location: {
        lat: number;
        lng: number;
        address?: string;
    };
    status: "PENDING" | "TRIAGED" | "RESOLVED";
    // Enriched Fields from Agents
    priority?: Priority;
    category?: string;
    reasoning_trace?: string;
    thought_signature?: string; // Crypto-audit
    structural_damage?: string; // Surveillance
    flood_level?: string;      // Surveillance
    assigned_assets?: string[]; // Logistics
}

export interface AgentResponse {
    success: boolean;
    data?: Partial<Incident>;
    error?: string;
}
