import { type Incident } from "@/lib/types";

export const MOCK_RESPONSES: Record<string, Partial<Incident>> = {
    "EVT-AUDIO-001": {
        priority: "CRITICAL",
        category: "Natural Disaster",
        reasoning_trace: "The caller is distressed, mentioning rising water levels and structural instability ('walls are moving'). The mention of '42 Oak Street' confirms a residential area. Immediate evacuation required. [MOCK ANALYSIS]",
        extracted_address: "42 Oak Street",
        extracted_lat: 34.0522,
        extracted_lng: -118.2437,
        location: {
            lat: 34.0522,
            lng: -118.2437,
            address: "42 Oak Street"
        },
        status: "TRIAGED",
        assigned_assets: ["Rescue Boat", "Medical Drone"]
    },
    "EVT-AUDIO-002": {
        priority: "CRITICAL",
        category: "Accident",
        reasoning_trace: "Reports of bridge collapse at 'North Bridge'. Mulitple vehicles submerged. People seen waving from debris. High casualty risk. [MOCK ANALYSIS]",
        extracted_address: "North Bridge",
        extracted_lat: 40.7128,
        extracted_lng: -74.0060,
        location: {
            lat: 40.7128,
            lng: -74.0060,
            address: "North Bridge"
        },
        status: "TRIAGED",
        assigned_assets: ["Heavy Lift Helicopter", "Dive Team"]
    },
    "EVT-VIDEO-001": {
        flood_level: "None",
        structural_damage: "Severe",
        reasoning_trace: "Drone footage shows a collapsed building facade. Debris blocking the street. No flood waters visible. Possible trapped civilians under rubble. [MOCK ANALYSIS]",
        category: "Structural Failure",
        priority: "HIGH",
        people_safety: "DANGER",
        status: "TRIAGED",
        location: {
            lat: 19.0760,
            lng: 72.8777,
            address: "Marine Drive, Mumbai, India"
        }
    },
    "EVT-VIDEO-002": {
        flood_level: "Severe",
        structural_damage: "Minor",
        reasoning_trace: "Waves crashing over seawall. Streets flooded. Cars submerged. No people visible immediately but conditions are hazardous. [MOCK ANALYSIS]",
        category: "Natural Disaster",
        priority: "HIGH",
        people_safety: "SAFE",
        status: "TRIAGED",
        location: {
            lat: 43.6532,
            lng: -79.3832,
            address: "Downtown Toronto, Canada"
        }
    },
    "EVT-VIDEO-003": {
        flood_level: "None",
        structural_damage: "None",
        reasoning_trace: "Construction site. Normal operations. No visible hazards or distress. [MOCK ANALYSIS]",
        category: "Routine",
        priority: "LOW",
        people_safety: "SAFE",
        status: "TRIAGED",
        location: {
            lat: 51.5074,
            lng: -0.1278,
            address: "Westminster, London, UK"
        }
    },
    "EVT-VIDEO-004": {
        flood_level: "Moderate",
        structural_damage: "Minor",
        reasoning_trace: "Residential street with ankle-deep water. People walking through water. Not immediately life threatening but monitoring required. [MOCK ANALYSIS]",
        category: "Natural Disaster",
        priority: "MEDIUM",
        people_safety: "SAFE",
        status: "TRIAGED",
        location: {
            lat: 35.6762,
            lng: 139.6503,
            address: "Shibuya, Tokyo, Japan"
        }
    }
};
