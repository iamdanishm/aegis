# **Project Aegis: "Civilian-to-Command" Autonomous Response System**

**Context Version:** 1.0 (Hackathon Golden Path)

## **1\. Project Mission & Narrative**

Goal: Build an Autonomous Triage Officer for mass casualty events (floods, fires, earthquakes) that replaces failing 911 infrastructure with decentralized AI agents.  
Core Philosophy: "Simulation-First." We do not rely on live, flaky APIs during the demo. We use a deterministic "Doomsday Dataset" to guarantee a perfect narrative flow.  
Key Differentiator: "Glass Box AI." We explicitly visualize the AI's internal reasoning\_trace and thought\_signature to prove it isn't just a keyword search.

## **2\. The "Hackathon Stack" (Strict Adherence)**

* **Framework:** Next.js 16 (App Router)  
* **Language:** JavaScript  
* **AI SDK:** google-genai targeting **Gemini 3 Pro** & **Flash**.  
* **Styling:** Tailwind CSS \+ Shadcn/UI (Theme: "AI Centric Agentic Tactical Dark Mode").  
* **Maps:** react-leaflet.  
* **State:** Zustand (for the Simulation Clock).

## **3\. Hierarchical Multi-Agent Architecture**

Aegis uses a **Hierarchical Orchestration Pattern**.

### **3.1 The Coordinator Agent (The Orchestrator)**

* **Role:** The "Traffic Cop." Receives raw multimodal inputs (Text, Audio blobs, Video frames).  
* **Logic:**  
  * If input\_type \== "audio" \-\> Route to **Triage Agent**.  
  * If input\_type \== "video" \-\> Route to **Surveillance Agent**.  
  * If input\_type \== "text" \-\> Check priority.  
* **Model:** Gemini 3 Flash (Low Latency).

### **3.2 The Triage Agent (The Specialist)**

* **Role:** Analyzes distress calls for medical/safety urgency.  
* **Configuration:** thinking\_level="HIGH", include\_thoughts=true.  
* **Critical Output:** Must return a reasoning\_trace (e.g., *"Subject mentions water near outlets \-\> Electrocution Risk \-\> Priority 1"*).  
* **Crypto-Audit:** Must generate and log a thought\_signature to the console as a "Chain of Custody" proof.

### **3.3 The Surveillance Agent (The Eye)**

* **Role:** Analyzes drone footage (simulated) for structural damage/flood levels.  
* **Optimization:** Uses **Frame Sampling** (1 frame every 2s) to manage tokens.  
* **Model:** Gemini 3 Pro (Vision).

### **3.4 The Logistics Agent (The Hands)**

* **Role:** Routes assets (Boats, Helis) to high-priority pins.  
* **Logic:** Uses Google Search Grounding to check for road closures (simulated).

## **4\. Development Constraints (The "Don't Break" Rules)**

1. **No Live API calls for Data:** All incoming distress signals must come from useDisasterSimulation hook reading simulation\_data.json.  
2. **Visualize Thinking:** Every UI card must have a \<ReasoningLog /\> component that types out the AI's internal thought process.  
3. **Strict Typing:** All Agents must output valid JSON schema matching the Incident interface.  
4. **Mobile First:** The "Responder View" must be fully responsive for mobile simulations.

## **5\. Directory Structure**

/src  
  /agents         \# Logic for specific agents (Triage, Logistics, etc.)  
  /components     \# UI (Map, ReasoningLog, SignalFeed)  
  /hooks          \# useDisasterSimulation.ts  
  /lib            \# gemini-client.ts (configured for Thinking)  
  /simulation     \# simulation\_data.json (The "Doomsday" Script)  
