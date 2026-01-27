"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident, type MissionReport } from "@/lib/types";
import { Type } from "@google/genai";

export async function generateMissionReport(incidents: Incident[], logs: string[]): Promise<MissionReport> {
    console.log("[REPORTER] Generating formal mission report...");

    // Build incidents log directly (not dependent on LLM)
    const incidents_log = incidents.map(i => ({
        id: i.id,
        type: i.type,
        priority: i.priority || "UNKNOWN",
        status: i.status,
        category: i.category || "Uncategorized",
        location: i.location?.address || (i.location?.lat ? `${i.location.lat.toFixed(4)}, ${i.location.lng.toFixed(4)}` : "Unknown"),
        assets: i.assigned_assets || [],
        auth_status: i.requires_human_auth ? (i.auth_status || "N/A") : "N/A"
    }));

    const missionStats = {
        total: incidents.length,
        critical: incidents.filter(i => i.priority === "CRITICAL").length,
        high: incidents.filter(i => i.priority === "HIGH").length,
        resolved: incidents.filter(i => i.status === "TRIAGED" || i.status === "RESOLVED").length,
        pending: incidents.filter(i => i.status === "PENDING").length,
        protocol_zero_count: incidents.filter(i => i.requires_human_auth).length,
        protocol_zero_approved: incidents.filter(i => i.auth_status === "APPROVED").length,
    };

    // Filter logs to reduce context window (Critical speed optimization)
    const criticalLogs = logs.filter(l => l.includes("CRITICAL") || l.includes("PROTOCOL ZERO") || l.includes("Action"));
    const recentLogs = logs.slice(-20); // Last 20 logs
    const contextLogs = [...new Set([...criticalLogs, ...recentLogs])].join("\n");

    // Deterministic Calculations to ensure consistency
    const deterministicLives = (missionStats.critical * 4) + (missionStats.high * 2);
    const deterministicScore = Math.min(99, Math.max(0, 65 + (missionStats.critical * 8) + (missionStats.high * 4) - (incidents.filter(i => i.auth_status === "DENIED").length * 10)));
    const deterministicDuration = `${Math.max(5, Math.ceil(logs.length / 6))} minutes`;

    const prompt = `You are a military-style report generator for Project Aegis disaster response.
    
MISSION STATISTICS:
- Total Incidents: ${missionStats.total}
- Critical: ${missionStats.critical}, High: ${missionStats.high}
- Resolved: ${missionStats.resolved}, Pending: ${missionStats.pending}
- Protocol Zero Triggered: ${missionStats.protocol_zero_count}, Approved: ${missionStats.protocol_zero_approved}

RECENT LOG EXCERPTS:
${contextLogs}

INCIDENT IDS: ${incidents.map(i => i.id).join(", ")}

Generate a JSON report with:
1. mission_id: Format "AEGIS-[DATE]-[TYPE]-[NUMBER]"
2. critical_events_summary: Array of 4-5 bullet strings summarizing key events
3. officer_notes: Brief mission effectiveness summary, referencing the calculated score of ${deterministicScore}/100 and ${deterministicLives} lives saved.

Return valid JSON only.`;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.REASONING,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        mission_id: { type: Type.STRING },
                        critical_events_summary: { type: Type.ARRAY, items: { type: Type.STRING } },
                        officer_notes: { type: Type.STRING }
                    }
                }
            }
        });

        const text = response.text || "";
        console.log("[REPORTER] Raw response length:", text.length);

        let data: any = {};
        if (text.length > 0) {
            try {
                data = JSON.parse(text);
            } catch {
                try {
                    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    data = JSON.parse(cleanText);
                } catch (e) { console.error("Parse error", e); }
            }
        }

        return {
            mission_id: data.mission_id || `AEGIS-${new Date().toISOString().split('T')[0]}-OPS-${String(Date.now()).slice(-4)}`,
            duration: deterministicDuration,
            lives_saved_estimate: deterministicLives,
            critical_events_summary: Array.isArray(data.critical_events_summary) && data.critical_events_summary.length > 0
                ? data.critical_events_summary
                : [
                    `Processed ${missionStats.total} total incidents`,
                    `${missionStats.critical} critical incidents handled`,
                    `${missionStats.resolved} incidents successfully resolved`,
                    missionStats.protocol_zero_count > 0 ? `Protocol Zero triggered ${missionStats.protocol_zero_count} time(s)` : "No Protocol Zero incidents"
                ],
            performance_score: deterministicScore,
            officer_notes: data.officer_notes || `Mission completed with ${missionStats.resolved} of ${missionStats.total} incidents resolved. Critical response protocols were executed as designed.`,
            generated_at: new Date().toISOString(),
            incidents_log
        };

    } catch (error) {
        console.error("[REPORTER] Failed to generate report:", error);

        return {
            mission_id: `AEGIS-${new Date().toISOString().split('T')[0]}-ERR-${String(Date.now()).slice(-4)}`,
            duration: deterministicDuration,
            lives_saved_estimate: deterministicLives,
            critical_events_summary: [
                `Total incidents processed: ${missionStats.total}`,
                `Critical priority: ${missionStats.critical}`,
                `High priority: ${missionStats.high}`,
                `Successfully resolved: ${missionStats.resolved}`
            ],
            performance_score: deterministicScore,
            officer_notes: "Report generated with fallback data due to AI service unavailability. Mission statistics compiled from incident logs.",
            generated_at: new Date().toISOString(),
            incidents_log
        };
    }
}
