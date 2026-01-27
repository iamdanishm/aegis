export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Incident {
    id: string;
    type: "AUDIO" | "VIDEO" | "TEXT" | "COMMAND";
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
    coordinator_trace?: string; // Routing decisions
    thought_signature?: string; // Crypto-audit
    structural_damage?: string; // Surveillance
    flood_level?: string;      // Surveillance
    assigned_assets?: string[]; // Logistics
    description_for_simulation?: string; // Narrative context
    people_safety?: string;
    extracted_address?: string; // Triage
    extracted_lat?: number;
    extracted_lng?: number;
    is_override?: boolean; // Voice of God
    command_intent?: string; // Voice of God
    requires_human_auth?: boolean; // Protocol Zero
    auth_status?: "PENDING" | "APPROVED" | "DENIED"; // Protocol Zero
    auth_timeout_at?: number; // Protocol Zero (Simulation Time target)

}

export interface AgentResponse {
    success: boolean;
    data?: Partial<Incident>;
    error?: string;
}

export interface MissionReport {
    mission_id: string;
    duration: string;
    lives_saved_estimate: number;
    critical_events_summary: string[];
    performance_score: number; // 0-100
    officer_notes: string;
    generated_at: string;
    // Detailed incident log
    incidents_log: {
        id: string;
        type: string;
        priority: string;
        status: string;
        category: string;
        location: string;
        assets: string[];
        auth_status: string;
    }[];
}
