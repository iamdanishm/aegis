# **Project Aegis: Comprehensive Simulation Demo Plan & Technical Execution Strategy**

## **Executive Strategic Overview and Architectural Philosophy**

The deployment of artificial intelligence in high-stakes disaster response scenarios presents a unique paradox: the systems designed to manage chaos must be the most stable components of the infrastructure. Project Aegis, conceptualized as a "Civilian-to-Command" Autonomous Response System, addresses the critical "Golden Hour" of mass casualty events—floods, earthquakes, and urban fires—where legacy 911 infrastructure inevitably collapses under the sheer volume of distress signals. The core value proposition of Aegis is not merely data visualization, but autonomous triage: the capability to ingest thousands of unstructured signals (text, audio, video), comprehend the semantic and physical implications of those signals (e.g., distinguishing between "water in the basement" and "water at socket level"), and route life-saving resources without human intervention.1  
However, demonstrating such a system in a hackathon or pilot environment introduces significant risk. Reliance on live data streams, real-time API latency, and the unpredictability of stochastic AI models can lead to catastrophic demonstration failures. Therefore, the "Simulation Demo Plan" is not a secondary requirement but the primary driver of success. This report details a **"Simulation-First" architecture**, a deterministic approach that prioritizes narrative fidelity and technical reliability over live data ingestion. By engineering a high-fidelity "Doomsday" dataset and a bespoke playback engine, Project Aegis creates a controlled environment where the system's reasoning capabilities—specifically Google Gemini 3.0’s "Deep Thinking" and "Thought Signature" features—can be showcased with absolute precision.1  
This report provides an exhaustive technical blueprint for generating, storing, and executing multimodal test data. It dissects the "Hackathon Stack" architecture, the nuances of synthetic data engineering using generative AI tools like ElevenLabs and Google Veo, and the implementation of a client-side simulation engine within Next.js 14\. Furthermore, it explores the integration of Gemini 3.0’s advanced reasoning parameters to create a "Glass Box" engine that makes AI decision-making transparent and auditable—a crucial requirement for trust in autonomous life-safety systems.

### **The "Hackathon Stack": Architectural Decisions and Justifications**

The architectural foundation of Project Aegis is selected to maximize development velocity—the "20-day sprint"—while ensuring zero-latency state management during the demo presentation. The "Hackathon Stack" leverages the Next.js App Router for a unified frontend/backend repository, enabling the "Vibe Coding" methodology supported by the Google Antigravity IDE.3

| Component Layer | Technology Choice | Architectural & Strategic Justification |
| :---- | :---- | :---- |
| **Frontend Framework** | **Next.js 16 (App Router)** | Provides a unified repository structure. The App Router's server components allow for the efficient pre-loading of heavy simulation assets (video/audio blobs) before the client hydrates, ensuring the demo does not stutter due to asset loading. Client components handle the high-frequency state updates required for the live map and feed visualization.1 |
| **Cognitive Engine** | **Gemini 3.0 (Pro & Flash)** | Specifically leveraging gemini-3-pro-preview for multimodal reasoning (video/audio analysis) and gemini-2.0-flash-thinking-exp for text-based reasoning traces. These models are unique in their ability to expose the "thought process" via the thinking\_level parameter and secure decisions via thought\_signatures.5 |
| **Simulation Runtime** | **Custom React Hooks** | A bespoke playback engine (useDisasterSimulation) acts as the system's "heartbeat." It ingests a local JSON timeline and hydrates the application state (via Zustand or React Context) in synchronized ticks, simulating a live event stream without the unpredictability of WebSockets or real-time polling.1 |
| **Visual Layer** | **Tailwind CSS \+ Shadcn/UI** | Facilitates the rapid construction of a "Command Center" aesthetic—dark mode, monospace fonts, and high-contrast alert indicators—that mimics expensive enterprise defense software. This visual language communicates robustness and urgency.1 |
| **Geospatial Engine** | **React Leaflet** | A lightweight, open-source library for rendering dynamic incident pins. Unlike Google Maps, it carries no per-load cost and offers complete control over offline map tiles, critical for demonstrating resilience when "infrastructure is down".1 |
| **IDE & Orchestration** | **Google Antigravity** | Utilizes "Agentic Mode" to autonomously generate boilerplate code, refactor component trees, and manage the complex integration of the simulation engine code. The IDE's ability to visualize agent tasks helps in managing the multi-agent workflow of the simulation.3 |

The choice of a local JSON-based simulation strategy over live APIs is driven by the need for deterministic storytelling. In a 3-minute demo, there is no margin for error. API rate limits, network congestion, or a model refusing to answer due to safety filters can derail the narrative. A local simulation ensures that the specific "hero scenarios"—such as a trapped family requiring immediate helicopter evacuation—trigger exactly when the script demands, allowing the presenter to synchronize their voiceover perfectly with the UI animations.1

## **The Cognitive Core: Mastering Gemini 3.0 Integration**

To differentiate Project Aegis from standard chatbots, the system must demonstrate "Deep Reasoning." It is not enough for the AI to simply label a message; it must explain *why* it applied that label. This requires a sophisticated integration of Gemini 3.0’s API features, specifically the thinking\_level parameter and the handling of thought\_signatures.

### **The "Glass Box" Reasoning Engine Configuration**

Standard AI implementations operate as "Black Boxes"—input goes in, and a decision comes out. Aegis operates as a "Glass Box." When a distress signal arrives, the UI visualizes the deduction chain. For example, if a message reads "Water is at the electrical sockets," the system should display: *"Analysis: Water \+ Electricity \= Immediate Electrocution Risk. Priority escalated to 1\. Resource: Power Cutoff Team."*  
To achieve this, the Gemini 3.0 model must be configured to explicit "Think Out Loud." The thinking\_level parameter is the primary control mechanism for this behavior.

#### **Thinking Level Optimization**

Gemini 3.0 introduces granular control over reasoning depth. For Project Aegis, the configuration depends on the modality of the input:

1. **Textual Analysis:** For analyzing SMS and social media text, the thinking\_level should be set to HIGH. This maximizes the reasoning depth, allowing the model to infer second-order risks (e.g., structural collapse from flood duration) that a lower setting might miss. While this increases latency slightly, the "Thinking Widget" in the UI (a typing animation) masks this delay and turns it into a feature—showing the AI "at work".5  
2. **Multimodal Analysis:** For analyzing CCTV video or drone feeds, gemini-3-pro-preview is the required model due to its superior multimodal context window (1M tokens). Here, the reasoning is implicit in the video understanding, but we can force explicit traces by prompting the model to "Describe your step-by-step visual analysis".7

JavaScript

// Example Configuration for Text Reasoning  
const generationConfig \= {  
  thinking\_config: {  
    thinking\_level: "HIGH", // Forces deep reasoning exploration  
    include\_thoughts: true  // Critical: Returns the internal monologue in the response  
  },  
  responseMimeType: "application/json" // Enforces structured output for the UI  
};

The decision to use responseMimeType: "application/json" is strategic. It forces the model to structure its output into predictable fields (priority, resource\_type, reasoning\_trace), which the frontend can then parse and render into the dashboard cards and map pins. This prevents the "hallucination" of UI-breaking text formats.1

### **Thought Signatures: The Trust Architecture**

A critical innovation in Gemini 3.0 is the concept of **Thought Signatures**. These are encrypted tokens returned by the API that represent the model's internal reasoning state. In a stateless API environment, these signatures allow the model to "remember" its chain of thought across multi-turn interactions, such as function calling.6  
For Project Aegis, Thought Signatures serve a dual purpose:

1. **Technical Validity:** They ensure that if the system needs to ask a clarifying question (e.g., "Is the water rising fast?"), it retains the context of the initial distress signal.  
2. **Narrative "Flex":** In the demo, these signatures are presented as **"Cryptographic Audits."** We visualize the signature string in a "Developer Console" overlay to claim that "Aegis cryptographically signs every decision, creating an immutable chain of custody for first responders." This framing transforms a technical API requirement into a compelling safety feature that appeals to judges looking for "Responsible AI" implementation.1

Validation Mechanism:  
The Gemini 3 API enforces strict validation. If a functionCall is generated, the response includes a thoughtSignature. This signature must be passed back in the subsequent request's history. Failure to do so results in a 400 Bad Request error. The simulation engine must therefore be capable of capturing these signatures and storing them in the mock database or state store alongside the incident record.6

## **Synthetic Data Engineering: The Multimodal "Doomsday" Dataset**

To validate Aegis as a "multimodal" system, the test data must simulate the chaotic reality of a disaster zone. We cannot rely on scraping real-time Twitter or YouTube feeds during a presentation. Instead, we engineer a **Synthetic Doomsday Dataset**. This dataset is a precise orchestration of 50–100 discrete events, timestamped to unfold over a 3-minute demo window.

### **Textual Distress Signal Generation**

Text messages (SMS, Tweets) form the backbone of the simulation. They provide high-volume data to populate the map and demonstrate the system's throughput.

* **Generation Strategy:** We utilize Gemini 3 Pro to generate a diverse set of 50 messages. The prompt must explicitly request "implicit risks" rather than explicit statements.  
  * *Bad Prompt:* "Help I am drowning."  
  * *Good Prompt:* "We are in the attic and the water is up to the trapdoor. My dad's oxygen tank runs on mains power." (This implies rising water, entrapment, and a medical dependency on electricity).  
* **Noise Injection:** To prove the triage capability, 10-15% of the dataset must be "noise"—non-emergency reports like "Traffic is terrible" or "I lost my cat." This allows the demo to show Aegis correctly filtering these as Priority 4 or 5, keeping lines open for true emergencies.1  
* **Geospatial Consistency:** The data must have realistic Lat/Long coordinates clustered around a specific disaster site (e.g., the Thames in London or New Orleans). Random coordinates would look chaotic on the map; clustered coordinates show the "spread" of the disaster.

### **Synthetic Audio Engineering: Simulating 911 Calls**

Audio inputs demonstrate the system's ability to handle voice calls when text infrastructure fails or when victims cannot type.

* **Technology Stack:** **ElevenLabs** for voice synthesis.  
* **Emotional Prompting:** Standard text-to-speech (TTS) is too calm for a disaster. We must use ElevenLabs' "Speech-to-Speech" or specific voice settings (e.g., high stability, low clarity) to simulate panic. Voices should be tagged with emotional markers like \[breathless\], \[trembling\], or \[shouting\] to induce the model to produce realistic distress.13  
* **Acoustic Layering:** A raw voice file is insufficient. We must overlay background noise using a DAW (Digital Audio Workstation) or programmatic mixing. Essential layers include:  
  * **Environmental:** Rushing water, wind howling, fire crackling.  
  * **Infrastructure:** Sirens, distant shouting, static/interference (simulating poor connection).  
* **File Format:** Compressed .mp3 or .ogg for fast browser loading. Storing these locally in the public/assets/audio directory avoids CDNs latency.

### **Synthetic Video Production: The "Visual Verification" Layer**

Video analysis provides the "wow factor" of the demo. It allows Aegis to claim it can "see" the disaster, verifying flood depths or structural damage that text reports might exaggerate or understate.

* **Generation Tools:** **Google Veo 3** (if available via Labs/Vertex AI) or **Luma Dream Machine**.  
  * *Google Veo 3 Capabilities:* Veo 3 is capable of generating 1080p+ video from text prompts. It supports "cinematic realism" and understands physics (e.g., water flow). Importantly, Veo 3 can be prompted with reference images to ensure consistency in the visual style of the disaster zone (e.g., consistent lighting or building types).15  
* **Prompt Engineering for Disaster:**  
  * "Drone footage, aerial view, 4k, suburban street submerged in muddy floodwater, cars floating, cinematic lighting, overcast sky, debris moving with current."  
  * "CCTV security camera footage, night vision, grainy, water rising up a staircase inside a house, flickering lights."  
* **Optimization:** Video files are heavy. For the simulation, we generate short loops (5-8 seconds). The resolution should be balanced; while Gemini 3 supports high-resolution analysis, for web performance, 720p is sufficient. The AI analysis will be pre-determined in the simulation script to match the video content, ensuring the reasoning log matches the visual perfectly.11

## **The Simulation Engine: Execution and Playback Logic**

The "Playback Engine" is the central nervous system of the demo. It is a piece of code that reads the static simulation\_data.json and "plays" it like a movie, emitting events to the UI at specific timestamps.

### **The simulation\_data.json Schema**

This file is the single source of truth for the demo. It dictates *what* happens and *when*.

JSON

### **The useDisasterSimulation Hook**

This custom React hook manages the simulation clock and event dispatching.

* **Timer Logic:** Instead of setInterval which can drift, the hook should use requestAnimationFrame for high-precision timing, or a delta-time calculation to ensure events fire accurately relative to the start time.  
* **Event Queue:** On initialization, the hook loads the JSON data into a queue. As the internal simulationTime advances, it checks the queue for events where timestamp\_offset\_ms \<= simulationTime.  
* **Dispatch Mechanism:** When an event is triggered, it is pushed to the global state (e.g., a Zustand store). This triggers a re-render of the UI components (Sidebar, Map).  
* **State Hydration:** To simulate a system that has been running for hours, the hook can support a start\_time\_offset. This allows the demo to start "in media res," with the map already partially populated, rather than starting from an empty screen.

### **Handling Multimodal Feeds in Next.js**

Simulating live video feeds requires careful handling in Next.js. We cannot simply embed a YouTube link.

* **Video Component:** A custom \<SimulatedLiveFeed\> component wraps the HTML5 \<video\> tag. It accepts a src from the local assets.  
* **Auto-Play Logic:** When a CCTV event triggers, the video component mounts and immediately begins playback (muted). This mimics a live feed activating upon motion detection or alert.  
* **HLS Simulation:** For a deeper technical flex, we can implement an HLS (HTTP Live Streaming) simulation using hls.js. We convert our synthetic MP4s into .m3u8 playlists and .ts segments using FFmpeg. The Next.js client then consumes this stream, mimicking a true broadcast protocol used by emergency centers. This adds a layer of technical realism that static MP4s lack, demonstrating readiness for real-world infrastructure.18

## **User Experience: Visualizing the "Thinking" Machine**

The success of the demo relies on visualizing the invisible. We must show the AI *thinking*, not just *answering*.

### **The "Reasoning Log" Component**

This component is the visual manifestation of Gemini 3.0’s reasoning\_trace.

* **Typing Effect:** The text should not appear instantly. It should type out character-by-character, mimicking a data stream or a hacker terminal. A speed of 10-20ms per character creates urgency.  
* **Styling:** A dark background (bg-slate-950), monospaced green or amber text (text-emerald-500, font-mono), and a blinking cursor (animate-pulse) evoke the "Command Center" aesthetic.  
* **Content Dynamic:** The text displayed is the direct output from Gemini's reasoning\_trace field. For example: *"Scanning input... Detected keyword 'trapped'... Cross-referencing location... Elevation: \-2m (Basement)... Risk: Drowning... Confidence: 98%... Action: Dispatch Boat Unit."*

### **The Dynamic Map Interface**

The map is the primary situational awareness tool.

* **Technology:** react-leaflet with OpenStreetMap tiles (dark mode filter applied via CSS).  
* **Dynamic Pins:** Pins should be color-coded by priority (Red=P1, Orange=P2, Green=Safe).  
* **Clustering:** If the simulation generates 100 points, the map must handle clustering to avoid UI clutter. Leaflet's MarkerClusterGroup can handle this automatically.  
* **Interactivity:** Clicking a pin should open the "Incident Detail" modal, showing the original distress message, the AI's reasoning log, and the "Thought Signature" verification hash.

### **Responder View (Mobile)**

To demonstrate the "Civilian-to-Command-to-Responder" loop, we simulate a mobile view.

* **Implementation:** A separate route (/responder/dashboard) or a responsive layout breakpoint that simplifies the UI into a checklist of tasks.  
* **Offline Mode:** We claim (and can technically mock) offline capabilities using localStorage or PWA service workers. The narrative is: "When cell towers fail, Aegis syncs critical data to responder devices via mesh networks, caching decisions locally."

## **20-Day Execution Roadmap & Risk Mitigation**

The 20-day sprint requires a disciplined focus on the "Golden Path"—the specific sequence of actions shown in the demo video.

| Phase | Duration | Goals & Deliverables |
| :---- | :---- | :---- |
| **1\. The Skeleton** | Days 1-4 | **Deliverable:** Functional Next.js 14 app with Tailwind/Shadcn. Basic Layout (Sidebar \+ Map). Map rendering with dummy pins. **Tools:** Google Antigravity (Scaffolding). |
| **2\. The Brain** | Days 5-9 | **Deliverable:** Integrated Gemini 3 API. triageIncident server action working with thinking\_level="HIGH". "Reasoning Log" component built. **Validation:** Verify JSON output structure and latency. |
| **3\. The Simulation** | Days 10-14 | **Deliverable:** simulation\_data.json generated and refined. useDisasterSimulation hook built and tested. Map pins populating in real-time. **Task:** Generate audio/video assets and link them in JSON. |
| **4\. The Polish** | Days 15-17 | **Deliverable:** "Thought Signature" mock verification UI. "Human Override" button. Audio/Video players integrated. HLS streaming setup (optional/stretch). **Focus:** Styling, animations, transitions. |
| **5\. The Production** | Days 18-20 | **Deliverable:** Final Demo Video. **Process:** Screen recording with OBS. Recording voiceover separately. Editing to ensure pacing matches the 3-minute limit. |

### **Risk Mitigation Strategies**

* **API Latency/Failure:** The demo video is recorded. If Gemini fails during a take, we cut and retry. For live judging, we can implement a "fallback mode" where the playback engine uses pre-cached AI responses from the JSON file instead of hitting the live API, guaranteeing zero latency.  
* **Rate Limits:** Gemini 3 Pro has rate limits. The simulation should throttle requests or use the "Flash" model for lower-priority background events while reserving "Pro" for the hero multimodal interactions.  
* **Browser Performance:** Rendering heavy video and maps can lag. We optimize by lazy-loading video components and using lightweight map tiles.

## **Conclusion**

Project Aegis represents a paradigm shift in disaster response technology, moving from passive dashboards to active, reasoning agents. By executing this "Simulation-First" plan, we ensure that the revolutionary capabilities of Gemini 3.0—Deep Reasoning, Multimodal Analysis, and Thought Signatures—are presented in a narrative that is both visceral and technically unassailable. The combination of a high-fidelity "Doomsday" dataset, a deterministic playback engine, and a "Glass Box" UI creates a demonstration that not only functions flawlessly but also tells a compelling story of how AI can save lives when seconds count. This plan provides the exact blueprint to transform that vision into a winning hackathon submission.

#### **Works cited**

1. Project Aegis: Definitive Hackathon Execution Blueprint  
2. accessed January 21, 2026, [https://en.wikipedia.org/wiki/Gemini\_(language\_model)\#:\~:text=They%20also%20introduced%20Gemini%202.5,available%20as%20of%20November%202025.](https://en.wikipedia.org/wiki/Gemini_\(language_model\)#:~:text=They%20also%20introduced%20Gemini%202.5,available%20as%20of%20November%202025.)  
3. Google Antigravity Tool (IDE): What It Is and How Developers Benefit: ExpertAppDevs.Com, accessed January 21, 2026, [https://medium.com/@expertappdevs/google-antigravity-tool-ide-what-it-is-and-how-developers-benefit-50119f8d886c](https://medium.com/@expertappdevs/google-antigravity-tool-ide-what-it-is-and-how-developers-benefit-50119f8d886c)  
4. Getting Started with Google Antigravity, accessed January 21, 2026, [https://codelabs.developers.google.com/getting-started-google-antigravity](https://codelabs.developers.google.com/getting-started-google-antigravity)  
5. Gemini thinking | Gemini API \- Google AI for Developers, accessed January 21, 2026, [https://ai.google.dev/gemini-api/docs/thinking](https://ai.google.dev/gemini-api/docs/thinking)  
6. Thought Signatures | Gemini API | Google AI for Developers, accessed January 21, 2026, [https://ai.google.dev/gemini-api/docs/thought-signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)  
7. Gemini 3 Pro | Generative AI on Vertex AI \- Google Cloud Documentation, accessed January 21, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro)  
8. Introducing Google Antigravity, a New Era in AI-Assisted Software Development, accessed January 21, 2026, [https://antigravity.google/blog/introducing-google-antigravity](https://antigravity.google/blog/introducing-google-antigravity)  
9. Thinking | Generative AI on Vertex AI \- Google Cloud Documentation, accessed January 21, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking)  
10. Generate structured output (like JSON and enums) using the Gemini API | Firebase AI Logic, accessed January 21, 2026, [https://firebase.google.com/docs/ai-logic/generate-structured-output](https://firebase.google.com/docs/ai-logic/generate-structured-output)  
11. Gemini 3 Developer Guide | Gemini API \- Google AI for Developers, accessed January 21, 2026, [https://ai.google.dev/gemini-api/docs/gemini-3](https://ai.google.dev/gemini-api/docs/gemini-3)  
12. Generate content with the Gemini API in Vertex AI \- Google Cloud Documentation, accessed January 21, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference)  
13. Panicky AI Voices | ElevenLabs Voice Library, accessed January 21, 2026, [https://elevenlabs.io/voice-library/panicky](https://elevenlabs.io/voice-library/panicky)  
14. Eleven v3 Audio Tags: Expressing emotional context in speech \- ElevenLabs, accessed January 21, 2026, [https://elevenlabs.io/blog/eleven-v3-audio-tags-expressing-emotional-context-in-speech](https://elevenlabs.io/blog/eleven-v3-audio-tags-expressing-emotional-context-in-speech)  
15. Veo 3.1 Ingredients to Video: More consistency, creativity and control \- Google Blog, accessed January 21, 2026, [https://blog.google/innovation-and-ai/technology/ai/veo-3-1-ingredients-to-video/](https://blog.google/innovation-and-ai/technology/ai/veo-3-1-ingredients-to-video/)  
16. Generate videos with Veo 3.1 in Gemini API | Google AI for Developers, accessed January 21, 2026, [https://ai.google.dev/gemini-api/docs/video](https://ai.google.dev/gemini-api/docs/video)  
17. Migrate to the latest Gemini models | Generative AI on Vertex AI | Google Cloud Documentation, accessed January 21, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/migrate](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/migrate)  
18. Next.js real-time video streaming: HLS.js and alternatives \- LogRocket Blog, accessed January 21, 2026, [https://blog.logrocket.com/next-js-real-time-video-streaming-hls-js-alternatives/](https://blog.logrocket.com/next-js-real-time-video-streaming-hls-js-alternatives/)  
19. Building a Modern HLS Video Player with Next.js: A Complete Guide \- Medium, accessed January 21, 2026, [https://medium.com/@dilshanmw717/building-a-modern-hls-video-player-with-next-js-a-complete-guide-19c39c61ae73](https://medium.com/@dilshanmw717/building-a-modern-hls-video-player-with-next-js-a-complete-guide-19c39c61ae73)