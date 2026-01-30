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
        assigned_assets: ["Rescue Boat", "Medical Drone"],
        grounding_queries: ["Riverside flooding reports Camden", "Road accessibility Oak Street"],
        required_asset: "MARINE"
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
        assigned_assets: ["Heavy Lift Helicopter", "Dive Team"],
        grounding_queries: ["Bridge collapse New York reports", "Diving team availability NY"],
        required_asset: "AIR"
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
        },
        grounding_queries: ["Building collapse Mumbai news", "Traffic around Marine Drive"],
        required_asset: "GROUND"
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
        },
        grounding_queries: ["Toronto waterfront flooding live", "Road closures Lakeshore Blvd"],
        required_asset: "MARINE"
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
        },
        grounding_queries: ["Construction updates Westminster", "Traffic London central"],
        required_asset: "General"
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
        },
        grounding_queries: ["Shibuya heavy rain warning", "Street flooding Tokyo updates"],
        required_asset: "GROUND"
    },
    "EVT-CRITICAL-AUTH-001": {
        priority: "CRITICAL",
        category: "Infrastructure Failure",
        reasoning_trace: "CRITICAL: Potential dam failure imminent. Secondary analysis confirms structural integrity is compromised beyond automated repair. Immediate manual intervention and high-level asset deployment required. [MOCK ANALYSIS]",
        extracted_address: "Hoover Dam, Nevada, USA",
        extracted_lat: 36.1699,
        extracted_lng: -115.1398,
        location: {
            lat: 36.1699,
            lng: -115.1398,
            address: "Hoover Dam, Nevada, USA"
        },
        status: "TRIAGED",
        assigned_assets: ["Heavy Lift Helicopter", "Emergency Engineering Team"],
        grounding_queries: ["Hoover Dam structural status manual", "Nevada emergency engineering contacts"],
        required_asset: "AIR"
    },
    // FOREIGN LANGUAGE INCIDENTS (Universal Translation)
    "EVT-TEXT-ES-001": {
        priority: "CRITICAL",
        category: "FLOOD",
        reasoning_trace: "Basement flooding emergency. Elderly person trapped and unable to walk. Immediate rescue required. (Translated from Spanish)",
        detected_language: "Spanish",
        location: {
            lat: 51.5074,
            lng: -0.1278,
            address: "London, UK"
        },
        status: "TRIAGED",
        assigned_assets: ["Rescue Boat", "Medical Team"],
        grounding_queries: ["Flooding reports London", "Basement rescue protocols"],
        required_asset: "MARINE"
    },
    "EVT-TEXT-HI-001": {
        priority: "CRITICAL",
        category: "COLLAPSE",
        reasoning_trace: "Building has collapsed. Multiple people trapped in Sector 4. Immediate heavy rescue required. (Translated from Hindi)",
        detected_language: "Hindi",
        location: {
            lat: 51.5074,
            lng: -0.1278,
            address: "London, UK"
        },
        status: "TRIAGED",
        assigned_assets: ["Heavy Lift Helicopter", "Urban Search & Rescue"],
        grounding_queries: ["Building collapse London", "Sector 4 emergency access"],
        required_asset: "AIR"
    },
    "EVT-TEXT-FR-001": {
        priority: "HIGH",
        category: "FIRE",
        reasoning_trace: "Uncontrolled fire near gas station. High explosion risk. Immediate fire response required. (Translated from French)",
        detected_language: "French",
        location: {
            lat: 48.8566,
            lng: 2.3522,
            address: "Paris, France"
        },
        status: "TRIAGED",
        assigned_assets: ["Fire Response Unit", "Hazmat Team"],
        grounding_queries: ["Gas station fire protocols", "Paris emergency services"],
        required_asset: "GROUND"
    }
};
