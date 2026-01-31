export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Incident {
    id: string;
    type: "AUDIO" | "VIDEO" | "TEXT" | "COMMAND" | "IMAGE";
    raw_input: string; // URL or Base64 or Text
    timestamp: string;
    location: {
        lat: number;
        lng: number;
        address?: string;
    };
    status: "PENDING" | "ANALYZING" | "TRIAGED" | "RESOLVED";
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
    grounding_queries?: string[]; // Google Search terms used
    required_asset?: 'AIR' | 'MARINE' | 'GROUND' | 'General';
    detected_language?: string;

    requires_logistics?: boolean; // Agentic Handoff
    suggested_asset_type?: string;

    // Responder Action Fields
    responder_status?: "PENDING" | "ACKNOWLEDGED" | "EN_ROUTE" | "ON_SCENE" | "RESOLVED";
    acknowledged_at?: string;         // ISO timestamp when acknowledged
    acknowledged_by?: string;         // Unit identifier (e.g., "MARINE-DELTA-01")
    backup_requested?: boolean;       // Flag for backup request
    backup_requested_at?: string;     // ISO timestamp when backup was requested
    verification_status?: "VERIFIED" | "UNVERIFIED" | "HISTORICAL" | "PENDING"; // Grounding check

    // Forensic Fields
    signal_metadata?: {
        cell_tower_id?: string;
        ip_address?: string;
        estimated_radius_meters?: number;
    };
    location_source?: "SPOKEN" | "VISUAL_LANDMARK" | "SIGNAL_TRIANGULATION" | "MANUAL_TRACE_REQUIRED" | "UNKNOWN" | "GPS_DEFAULT";
    manual_trace_required?: boolean;

    // Conflict Resolution
    location_ambiguity?: boolean;
    conflicting_location?: {
        address: string;
        lat: number;
        lng: number;
        source: string;
    };
}

export interface AgentAuditLog {
    agent: string;
    action: string;
    detail: string;
    timestamp: string;
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
    // Granular Agent Actions
    agent_audit_log?: AgentAuditLog[];
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
