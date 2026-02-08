# 🛡️ Project Aegis: Autonomous Response System

> **"Civilian-to-Command" Decentralized Triage & Orchestration**

Project Aegis is an Autonomous Triage Officer designed for mass casualty events (floods, fires, earthquakes). It replaces failing 911 infrastructure with decentralized AI agents that can process multimodal inputs, prioritize life-saving actions, and coordinate resources in real-time.

---

## 🚀 Mission & Narrative

In a crisis, communication infrastructure is the first to fail. Project Aegis provides a **"Simulation-First"** resilient layer that doesn't rely on live, flaky APIs. Instead, it uses a deterministic **"Doomsday Dataset"** to guarantee a perfect narrative flow during critical demos, ensuring the right help reaches the right place at the right time.

### 🔍 "Glass Box" AI
Unlike "Black Box" systems, Aegis is built on transparency. We explicitly visualize the AI's internal **Reasoning Trace** and **Thought Signature** to prove the validity of every decision made by the autonomous agents.

---

## 🏗️ Hierarchical Multi-Agent Architecture

Aegis uses a **Hierarchical Orchestration Pattern** to manage complex disaster scenarios.

| Agent | Role | Model | Capabilities |
| :--- | :--- | :--- | :--- |
| **The Coordinator** | The Traffic Cop | `gemini-3-flash` | Routes raw multimodal inputs (Text, Audio, Video) to specialists. |
| **The Triage Agent** | The Specialist | `gemini-3-pro` | Analyzes distress calls for medical/safety urgency with deep reasoning. |
| **The Surveillance Agent** | The Eye | `gemini-3-pro` | Analyzes drone footage for structural damage using frame sampling. |
| **The Logistics Agent** | The Hands | `gemini-3-pro` | Routes assets (Boats, Helis) based on priority and simulated road closures. |
| **The Reporter Agent** | The Chronicler | `gemini-3-flash` | Generates official mission reports and geographic impact summaries. |

---

## 🛠️ Tech Stack

*   **Framework:** Next.js 16 (App Router)
*   **Language:** JavaScript / TypeScript
*   **AI Engine:** Google Gemini (3 Pro & Flash) via `google-genai`
*   **Styling:** Tailwind CSS + Shadcn/UI (**Theme:** AI Centric Agentic Tactical Dark Mode)
*   **Maps:** React-Leaflet
*   **State Management:** Zustand (Simulation Clock & Agent State)
*   **Video Processing:** ffmpeg-static (for drone footage analysis)

---

## 📂 Project Structure

```bash
/src
  /agents         # Autonomous Agent logic (Triage, Logistics, etc.)
  /components     # UI Components (Tactical Map, ReasoningLog, SignalFeed)
  /hooks          # useDisasterSimulation (Core simulation engine)
  /lib            # Gemini Client & Thinking Configuration
  /simulation     # simulation_data.json (The "Doomsday" Script)
```

---

## 🚦 Getting Started

### 1. Prerequisites
- Node.js 18+
- A Google Gemini API Key

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/iamdanishm/aegis.git

# Install dependencies
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the root:
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

### 4. Run the Simulation
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to enter the Aegis Command Center.

---

## 🛡️ Development Constraints

1.  **Deterministic Simulation:** All distress signals come from `simulation_data.json`.
2.  **Visible Reasoning:** Every AI decision must type out its internal thought process via `<ReasoningLog />`.
3.  **Audit Trail:** Every agent generates a `thought_signature` for "Chain of Custody" proof.
4.  **Mobile First:** Tactical views optimized for field responders and command officers alike.

---

**Built for the Gemini Hackathon 2025** 🚁🔥🌊
