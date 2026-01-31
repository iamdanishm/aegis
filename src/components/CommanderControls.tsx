"use client";

import { useState, useRef } from "react";
import { Mic } from "lucide-react";
import { useSimulationStore } from "@/lib/store";
import { coordinateIncident } from "@/agents/coordinator";
import { cn } from "@/lib/utils";
import { type Incident } from "@/lib/types";

export function CommanderControls({ incidentContext, className }: { incidentContext?: Incident, className?: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const { addIncident, updateIncident, addLog, time, showNotification, isMicAuthorized } = useSimulationStore();

    const startRecording = async () => {
        if (!isMicAuthorized) {
            showNotification("Microphone permission required for Voice Override.", "error");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
                await processCommand(audioBlob);
                stream.getTracks().forEach(track => track.stop()); // Clean up
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            showNotification("Failed to start recording. Check mic connection.", "error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsProcessing(true);
        }
    };

    const processCommand = async (audioBlob: Blob) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result as string;

            const commandId = `CMD-${Math.floor(Math.random() * 1000)}`;
            const contextMsg = incidentContext ? `(Context: ${incidentContext.id})` : "(Global)";

            const newIncident: any = {
                id: commandId,
                type: "COMMAND",
                raw_input: base64Audio,
                timestamp: new Date().toISOString(),
                location: incidentContext?.location || { lat: 0, lng: 0, address: "COMMAND_CENTER" },
                status: "PENDING",
                priority: "CRITICAL",
                is_override: true,
                description_for_simulation: incidentContext ? `Override for ${incidentContext.id}` : undefined
            };

            addIncident(newIncident);
            addLog(`[${time}s] [COMMANDER] 🎙️ "VOICE OF GOD" ${contextMsg} INITIATED...`);

            try {
                const processed = await coordinateIncident(newIncident);
                updateIncident(commandId, processed);
                addLog(`[${time}s] [COMMANDER] Override Executed: ${processed.command_intent || "Order Applied"}`);
                showNotification("Voice Command Executed Successfully", "success");

            } catch (e: any) {
                console.error("Command processing failed:", e);
                addLog(`[${time}s] [COMMANDER] Override Failed: ${e.message}`);
                updateIncident(commandId, {
                    status: "RESOLVED",
                    reasoning_trace: `Command failed: ${e.message}`
                });
                showNotification("Voice Override Processing Failed", "error");
            } finally {
                setIsProcessing(false);
            }
        };
    };

    return (
        <div className={cn("relative flex items-center", className)}>
            <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                disabled={isProcessing}
                className={cn(
                    "relative group py-2 px-4 rounded-lg flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-300 border overflow-hidden",
                    isRecording
                        ? "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105"
                        : isProcessing
                            ? "bg-amber-500/10 border-amber-500/50 text-amber-400 cursor-wait"
                            : !isMicAuthorized
                                ? "bg-zinc-900 border-red-900/50 text-red-700 opacity-50 cursor-not-allowed"
                                : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:scale-[1.02]"
                )}
                title={!isMicAuthorized ? "Microphone permission denied" : "Hold to speak for Voice Command"}
            >
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                    isRecording ? "bg-white animate-[pulse_0.2s_infinite] scale-125" : "bg-current"
                )} />

                {isRecording ? "TRANSMITTING..." : isProcessing ? "PROCESSING UPLINK..." : "VOICE OVERRIDE"}

                <Mic className={cn("w-3.5 h-3.5 ml-0.5", isRecording && "fill-current animate-bounce")} />
            </button>
        </div>
    );
}
