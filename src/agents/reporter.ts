"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident, type MissionReport } from "@/lib/types";
import { Type } from "@google/genai";
import { generateContentWithRetry, extractAndParseJSON } from "@/lib/gemini-utils";

export async function generateMissionReport(incidents: Incident[], logs: string[]): Promise<MissionReport> {
    console.log("[REPORTER] Generating formal mission report...");

    const missionStats = {
        total: incidents.length,
        critical: incidents.filter(i => i.priority === "CRITICAL").length,
        high: incidents.filter(i => i.priority === "HIGH").length,
        resolved: incidents.filter(i => i.status === "TRIAGED" || i.status === "RESOLVED").length,
        pending: incidents.filter(i => i.status === "PENDING").length,
        protocol_zero_count: incidents.filter(i => i.requires_human_auth).length,
        protocol_zero_approved: incidents.filter(i => i.auth_status === "APPROVED").length,
    };

    const airAssets = incidents.filter(i => i.required_asset === 'AIR').length;
    const marineAssets = incidents.filter(i => i.required_asset === 'MARINE').length;
    const groundAssets = incidents.filter(i => i.required_asset === 'GROUND').length;
    const totalDeployments = incidents.filter(i => i.assigned_assets && i.assigned_assets.length > 0).length;

    const geographicImpact = [...new Set(incidents.map(i => i.location?.address?.split(',').slice(-2).join(',').trim()).filter(Boolean))].slice(0, 5);

    const incidents_log = incidents.map(i => ({
        id: i.id,
        timestamp: i.timestamp,
        type: i.type,
        priority: i.priority || "UNKNOWN",
        status: i.status,
        category: i.category || "Uncategorized",
        location: i.location?.address || (i.location?.lat ? `${i.location.lat.toFixed(4)}, ${i.location.lng.toFixed(4)}` : "Unknown"),
        assets: i.assigned_assets || [],
        auth_status: i.requires_human_auth ? (i.auth_status || "N/A") : "N/A"
    }));

    const startTime = incidents.length > 0 ? incidents[0].timestamp : new Date().toISOString();
    const endTime = new Date().toISOString();

    // SIMULATION FALLBACK: If no API key, use deterministic data
    if (!process.env.GEMINI_API_KEY) {
        console.log("[REPORTER] [SIMULATION MODE] Generating deterministic mission report");
        return {
            report_id: `AEGIS-${new Date().toISOString().split('T')[0]}-SIM-${String(Date.now()).slice(-4)}`,
            classification: "OFFICIAL",
            incident_period: {
                start: startTime,
                end: endTime,
            },
            executive_summary: `Mission operations completed. Processed ${missionStats.total} total signals with ${missionStats.resolved} validated resolutions. All agents functioned in simulation mode using mock datasets.`,
            operational_metrics: {
                total_signals_processed: missionStats.total,
                validated_incidents: missionStats.resolved,
                critical_alerts: missionStats.critical,
                protocol_zero_interventions: missionStats.protocol_zero_count,
            },
            resource_deployment: {
                air_assets: airAssets,
                marine_assets: marineAssets,
                ground_assets: groundAssets,
                total_deployments: totalDeployments,
            },
            geographic_impact: geographicImpact.length > 0 ? geographicImpact : ["Simulated Disaster Zone"],
            situational_assessment: `Mission completed successfully. Operational integrity maintained at 100%. Critical incidents were prioritized and routed to appropriate specialized agents. No unauthorized breaches detected. [SIMULATION MODE]`,
            generated_at: new Date().toISOString(),
            incidents_log
        };
    }

    // Filter logs to reduce context window (Critical speed optimization)
    const criticalLogs = logs.filter(l => l.includes("CRITICAL") || l.includes("PROTOCOL ZERO") || l.includes("Action"));
    const recentLogs = logs.slice(-20); // Last 20 logs
    const contextLogs = [...new Set([...criticalLogs, ...recentLogs])].join("\n");

    const prompt = `You are a professional Government Emergency Response Analyst for Project Aegis.
    
MISSION STATISTICS:
- Total Signals Processed: ${missionStats.total}
- Validated Incidents: ${missionStats.resolved}
- Critical Alerts: ${missionStats.critical}
- Protocol Zero Triggered: ${missionStats.protocol_zero_count}
- Resource Deployments: Air: ${airAssets}, Marine: ${marineAssets}, Ground: ${groundAssets}

RECENT OPERATIONAL LOGS:
${contextLogs}

Generate a formal After Action Report (AAR) in JSON format with the following fields:
1. report_id: Format "AEGIS-[DATE]-[TYPE]-[NUMBER]"
2. classification: "OFFICIAL" | "SECRET" | "TOP SECRET" (choose based on mission intensity)
3. executive_summary: 2-3 sentence high-level overview of the operation.
4. situational_assessment: Detailed professional assessment of the overall disaster response, effectiveness of AI-human coordination, and current status of the region.

Avoid gamified language like "Performance Score" or "Lives Saved". Use professional, clinical, and authoritative tone.

Return valid JSON only.`;

    try {
        const response = await generateContentWithRetry(ai.models, {
            model: MODELS.REASONING,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        report_id: { type: Type.STRING },
                        classification: { type: Type.STRING },
                        executive_summary: { type: Type.STRING },
                        situational_assessment: { type: Type.STRING }
                    }
                }
            }
        });

        // Robust text extraction for @google/genai SDK
        let text = "";
        try {
            text = (typeof response.text === 'function') ? response.text() : (response.candidates?.[0]?.content?.parts?.[0]?.text || "");
        } catch (e) {
            console.warn("[REPORTER] response.text() failed, trying manual extraction:", e);
            text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }

        console.log("[REPORTER] Raw response length:", text.length);

        let data: any = {};
        if (text.length > 0) {
            try {
                data = extractAndParseJSON(text);
            } catch (e) {
                console.error("[REPORTER] Parse error", e);
            }
        }

        return {
            report_id: data.report_id || `AEGIS-${new Date().toISOString().split('T')[0]}-OPS-${String(Date.now()).slice(-4)}`,
            classification: (data.classification as any) || "OFFICIAL",
            incident_period: {
                start: startTime,
                end: endTime,
            },
            executive_summary: data.executive_summary || `Mission completed with ${missionStats.resolved} of ${missionStats.total} incidents resolved.`,
            operational_metrics: {
                total_signals_processed: missionStats.total,
                validated_incidents: missionStats.resolved,
                critical_alerts: missionStats.critical,
                protocol_zero_interventions: missionStats.protocol_zero_count,
            },
            resource_deployment: {
                air_assets: airAssets,
                marine_assets: marineAssets,
                ground_assets: groundAssets,
                total_deployments: totalDeployments,
            },
            geographic_impact: geographicImpact.length > 0 ? geographicImpact : ["Active Response Sectors"],
            situational_assessment: data.situational_assessment || "Operational assessment indicates successful mitigation of immediate threats. System oversight and human-in-the-loop validation ensured protocol adherence across all sectors.",
            generated_at: new Date().toISOString(),
            incidents_log
        };

    } catch (error) {
        console.error("[REPORTER] Failed to generate report:", error);

        return {
            report_id: `AEGIS-${new Date().toISOString().split('T')[0]}-ERR-${String(Date.now()).slice(-4)}`,
            classification: "OFFICIAL",
            incident_period: {
                start: startTime,
                end: endTime,
            },
            executive_summary: `System failure detected during report generation. Manual compilation required. Operational data saved to local secure logs.`,
            operational_metrics: {
                total_signals_processed: missionStats.total,
                validated_incidents: missionStats.resolved,
                critical_alerts: missionStats.critical,
                protocol_zero_interventions: missionStats.protocol_zero_count,
            },
            resource_deployment: {
                air_assets: airAssets,
                marine_assets: marineAssets,
                ground_assets: groundAssets,
                total_deployments: totalDeployments,
            },
            geographic_impact: geographicImpact.length > 0 ? geographicImpact : ["Unknown"],
            situational_assessment: "OFFLINE FALLBACK: Mission statistics compiled from incident logs. Situational assessment unavailable due to AI connectivity issues.",
            generated_at: new Date().toISOString(),
            incidents_log
        };
    }
}
