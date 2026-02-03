"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mic } from "lucide-react";
import { useSimulationStore } from "@/lib/store";
import { coordinateIncident } from "@/agents/coordinator";
import { cn } from "@/lib/utils";
import { type Incident } from "@/lib/types";

export function CommanderControls({ incidentContext, className }: { incidentContext?: Incident, className?: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const recognitionRef = useRef<any>(null); // Use 'any' for window.webkitSpeechRecognition
    const finalTranscriptRef = useRef("");     // Accumulate final results here
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    // Prevent auto-restart if user intentionally stopped
    const intentionalStopRef = useRef(false);

    // Global Store
    const {
        addIncident, updateIncident, addLog, time, showNotification, isMicAuthorized,
        setIsVoiceProcessing // New global setter
    } = useSimulationStore();

    // Sync local processing state to global store for ReasoningLog visibility
    useEffect(() => {
        setIsVoiceProcessing(isProcessing);
    }, [isProcessing, setIsVoiceProcessing]);

    // Handle "Cancel" logic -> Clean stop without processing
    const abortRecording = () => {
        intentionalStopRef.current = true;

        // Stop Speech
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) { }
        }

        // Stop Audio
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        setIsRecording(false);
        setTranscript("");
        chunksRef.current = [];
        showNotification("Voice Command Cancelled", "info");
    };

    const startRecording = async () => {
        intentionalStopRef.current = false; // Reset flag
        if (!isMicAuthorized) {
            showNotification("Microphone permission required for Voice Override.", "error");
            return;
        }

        try {
            // 1. Initialize MediaRecorder (Fallback & Truth)
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.start();

            // 2. Initialize SpeechRecognition (Progressive Enhancement)
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = "en-US";

                recognitionRef.current.onstart = () => {
                    setTranscript("");
                    finalTranscriptRef.current = "";
                };

                recognitionRef.current.onresult = (event: any) => {
                    let interimTranscript = "";
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        const result = event.results[i];
                        if (result.isFinal) {
                            finalTranscriptRef.current += result[0].transcript + " ";
                        } else {
                            interimTranscript += result[0].transcript;
                        }
                    }
                    setTranscript(finalTranscriptRef.current + interimTranscript);
                };

                // Auto-restart logic for reliability
                recognitionRef.current.onend = () => {
                    if (isRecording && !intentionalStopRef.current) {
                        // Restart if it stopped unexpectedly (silence/network) BUT user is still "holding" button
                        try { recognitionRef.current.start(); } catch (e) { }
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.warn("[VOICE] Speech recognition error/fallback:", event.error);
                    if (event.error === 'aborted') return; // Ignore intentional aborts
                    // Don't stop everything, just let MediaRecorder continue
                    // We might show a visual cue that we are in "Offline/Fallback" mode if needed
                };

                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.warn("[VOICE] Failed to start speech recognition:", e);
                }
            }

            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            showNotification("Failed to start recording. Check mic connection.", "error");
        }
    };

    const stopRecording = () => {
        if (!isRecording) return;
        intentionalStopRef.current = true; // Mark as intentional stop so onend doesn't restart
        setIsRecording(false);
        setIsProcessing(true);

        // Stop Speech Recognition
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
        }

        // Stop Media Recorder and Process
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
                // Clean up tracks
                mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());

                // DECISION LOGIC:
                // 1. If we have a good transcript, use it (Fast Path)
                // 2. If no transcript (Network error/Offline), use Audio Blob (Reliable Path)

                if (transcript.trim().length > 2) {
                    await processCommand(transcript, undefined);
                } else {
                    console.log("[VOICE] No transcript captured. Falling back to Audio Blob.");
                    showNotification("Network issue detected. Sending Audio for Processing...", "info");
                    await processCommand(undefined, audioBlob);
                }
            };
            mediaRecorderRef.current.stop();
        } else {
            // Should typically not happen if start succeeded, but just in case
            setIsProcessing(false);
        }
    };

    const processCommand = async (textInput?: string, audioBlob?: Blob) => {
        // Generate ID / Context
        const commandId = `CMD-${Math.floor(Math.random() * 1000)}`;
        const targetId = incidentContext ? incidentContext.id : commandId;

        // =======================================================================
        // SMART ROUTING: Check if target event is currently being analyzed by hook
        // =======================================================================
        if (incidentContext) {
            const currentState = useSimulationStore.getState().incidents.find(i => i.id === incidentContext.id);

            if (currentState?.status === "ANALYZING") {
                // EVENT IS CURRENTLY BEING PROCESSED BY HOOK
                // 1. Inject Transcript (Cumulative)
                const previousContext = currentState.transcript_context || "";
                const newContext = previousContext
                    ? `${previousContext} ${textInput || ""}`.trim()
                    : (textInput || "Processing Audio Command...");

                addLog(`[${time}s] [COMMANDER] 🗣️ INTERRUPTING active analysis for ${targetId}. Merging inputs...`);

                updateIncident(targetId, {
                    transcript_context: newContext
                });

                // 2. TRIGGER IMMEDIATE ABORT of standard analysis
                const abortController = useSimulationStore.getState().activeAbortController;
                if (abortController) {
                    console.log("[COMMANDER] Aborting standard analysis stream...");
                    abortController.abort(); // This throws AbortError in the hook
                }

                showNotification("Analysis Interrupted - Applying User Context...", "info");
                setIsProcessing(false);
                setTranscript("");
                chunksRef.current = [];
                return; // Exit early - hook handles the rest
            }
        }

        // =======================================================================
        // STANDARD FLOW: Event is NOT currently analyzing, run independent command
        // =======================================================================

        // =======================================================================
        // STANDARD FLOW: Event is NOT currently analyzing, run independent command
        // =======================================================================

        // 1. PREEMPTION: Abort any currently running analysis to free up the system
        const activeController = useSimulationStore.getState().activeAbortController;
        if (activeController) {
            console.log("[COMMANDER] Preempting current analysis for high-priority command...");
            addLog(`[${time}s] [COMMANDER] ⚡ PREEMPTING current analysis for priority override.`);
            activeController.abort(); // This throws AbortError in the hook

            // Wait a tick to ensure hook cleans up
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Feedback Logic
        if (incidentContext) {
            // CRITICAL FIX: Do NOT append hardcoded text to reasoning_trace. 
            // The UI will show "Live User Command" via the `transcript_context` field.

            updateIncident(targetId, {
                status: "ANALYZING",
                // reasoning_trace: Keep existing trace! Don't append noise.
                transcript_context: textInput || "Processing Audio Command..."
            });
            addLog(`[${time}s] [COMMANDER] 🎙️ OVERRIDE RECEIVED for ${targetId}`);
        } else {
            const newIncident: any = {
                id: commandId,
                type: "COMMAND",
                raw_input: "Voice Command",
                timestamp: new Date().toISOString(),
                location: { lat: 0, lng: 0, address: "COMMAND_CENTER" },
                status: "ANALYZING",
                priority: "CRITICAL",
                is_override: true,
                mission_context: "Processing Voice Command...",
                transcript_context: textInput || "Processing Audio Command..."
            };
            addIncident(newIncident);
            addLog(`[${time}s] [COMMANDER] 🎙️ GLOBAL COMMAND INITIATED...`);
        }

        try {
            // Prepare Payload
            const baseIncident = incidentContext || {};

            // Handle Audio Blob to Base64 if needed
            let finalRawInput = "data:audio/webm;base64,MOCK_AUDIO";
            if (audioBlob) {
                finalRawInput = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(audioBlob);
                });
            }

            const payloadIncident: any = {
                ...baseIncident,
                id: targetId,
                type: "COMMAND",
                raw_input: finalRawInput, // This goes to AI for processing
                command_intent: textInput,
                mission_context: textInput || "Audio Verification Required",
                location: (baseIncident as any).location || { lat: 0, lng: 0, address: "COMMAND_CENTER" },
                transcript_context: textInput || "Audio Command - Pending Transcription" // <-- NEW
            };

            const processed = await coordinateIncident(payloadIncident);

            // CRITICAL FIX: Get FRESH incident data from store, NOT stale incidentContext prop
            // This prevents race conditions where the simulation hook updated the incident in the meantime
            const freshIncident = incidentContext
                ? useSimulationStore.getState().incidents.find(i => i.id === targetId)
                : null;

            // CONSTRUCT FINAL UPDATE
            // We must restore the ORIGINAL raw_input (filename) so the card doesn't show the audio blob
            // We also want to MERGE the status/priority/assets BUT suppress the trace as requested.

            const existingReasoning = freshIncident?.reasoning_trace || incidentContext?.reasoning_trace || "";
            // If it's an update to an existing incident, APPEND with separator for SignalFeed visibility.
            const combinedReasoning = incidentContext
                ? `${existingReasoning}\n\n[COMMAND OVERRIDE]: ${processed.command_intent || "Executed"}\n${processed.reasoning_trace}`.trim()
                : (`[COMMAND]: ${processed.command_intent || "Executed"}\n${processed.reasoning_trace}`);

            // Merge Assets - use FRESH data
            // 1. Start with existing assets
            const existingAssets = freshIncident?.assigned_assets || incidentContext?.assigned_assets || [];
            // 2. Get new assets (defaulting to empty array)
            const newAssets = processed.assigned_assets || [];
            // 3. Filter out "SYSTEM_UPDATE" or duplicates
            const mergedAssets = Array.from(new Set([
                ...existingAssets,
                ...newAssets.filter(a => a !== "SYSTEM_UPDATE" && a !== "ACKNOWLEDGED_ACTION")
            ]));

            updateIncident(targetId, {
                ...processed,
                status: "RESOLVED",
                type: incidentContext?.type || "COMMAND",
                // IMPORTANT: Restore original raw_input if this was an update
                raw_input: incidentContext ? (freshIncident?.raw_input || incidentContext.raw_input) : (processed.raw_input || finalRawInput),
                // Merge reasoning
                reasoning_trace: combinedReasoning,
                // Ensure location updates if the AI found one, otherwise keep old
                location: processed.location || freshIncident?.location || incidentContext?.location,
                // Persist merged assets
                assigned_assets: mergedAssets.length > 0 ? mergedAssets : existingAssets,
                // Clear transcript context after use
                transcript_context: undefined
            });

            // Force update transcript for UI feedback if we fell back to audio
            if (!transcript && processed.command_intent) {
                setTranscript(processed.command_intent);
            }

            showNotification("Voice Command Executed", "success");

        } catch (e: any) {
            console.error("Command processing failed:", e);
            addLog(`[${time}s] [COMMANDER] Override Failed: ${e.message}`);
            updateIncident(targetId, {
                status: "RESOLVED",
                reasoning_trace: (incidentContext?.reasoning_trace || "") + `\n\n[COMMAND FAILED]: ${e.message}`,
                transcript_context: undefined
            });
            showNotification("Voice Override Output Failed", "error");
        } finally {
            setIsProcessing(false);
            // Don't clear transcript immediately so user can see what was sent
            setTimeout(() => setTranscript(""), 2000);
            chunksRef.current = [];
        }
    };



    return (
        <div className={cn("relative flex items-center gap-2", className)}>
            <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={(e) => {
                    if (isRecording) {
                        abortRecording();
                    }
                }}
                disabled={isProcessing}
                className={cn(
                    "relative group py-2 px-4 rounded-lg flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-wider font-bold transition-all duration-300 border overflow-hidden",
                    // Dynamic width for transcript
                    isRecording ? "w-auto min-w-[200px]" : "w-auto",
                    isRecording
                        ? "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] scale-105"
                        : isProcessing
                            ? "bg-amber-500/10 border-amber-500/50 text-amber-400 cursor-wait"
                            : !isMicAuthorized
                                ? "bg-zinc-900 border-red-900/50 text-red-700 opacity-50 cursor-not-allowed"
                                : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:scale-[1.02]"
                )}
                title={!isMicAuthorized ? "Microphone permission denied" : "Hold to Speak / Drag out to Cancel"}
            >
                <div className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300 shrink-0",
                    isRecording ? "bg-white animate-[pulse_0.2s_infinite] scale-125" : "bg-current"
                )} />

                {isRecording ? (
                    <span className="animate-pulse">
                        LISTENING...
                    </span>
                ) : isProcessing ? (
                    "PROCESSING OVERRIDE..."
                ) : (
                    "VOICE OVERRIDE"
                )}

                <Mic className={cn("w-3.5 h-3.5 ml-0.5 shrink-0", isRecording && "fill-current animate-bounce")} />
            </button>



            {/* Live Transcript Portal - Breaks out of overflow-hidden containers */}
            {isRecording && transcript && typeof document !== 'undefined' && createPortal(
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-black/90 backdrop-blur-md border border-red-500/50 p-4 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.5)] min-w-[300px] max-w-[500px] text-center animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="text-[10px] uppercase tracking-widest text-red-400 mb-2 font-bold flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Live Voice Transcript
                    </div>
                    <div className="text-sm font-mono text-white leading-relaxed whitespace-pre-wrap">
                        {transcript}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
