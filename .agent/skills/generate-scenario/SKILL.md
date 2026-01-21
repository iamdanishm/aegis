## ---

**name: generate-scenario description: Generates synthetic "Doomsday" disaster datasets (JSON) for the simulation engine, including distress texts, geo-coordinates, and urgency levels.**

# **Generate Disaster Scenario Data**

Use this skill when the user asks to "generate test data", "create a flood scenario", or "add more distress calls".

## **Instructions**

1. **Analyze the Request:** Identify the disaster type (Flood, Fire, Earthquake) and location (e.g., London, New Orleans).  
2. **Generate JSON Entries:** Create a JSON array of 10-20 objects.  
3. **Strict Schema Enforcement:** Each object MUST match:  
   JSON  
   {  
     "id": "uuid",  
     "timestamp\_offset": "number (seconds from start)",  
     "sender\_type": "SMS" | "TWITTER" | "CCTV",  
     "content": "string (the distress message)",  
     "location": { "lat": number, "lng": number },  
     "severity\_ground\_truth": "critical" | "moderate" | "low"  
   }

4. **Apply Narrative Arc:**  
   * Start with "low urgency" messages (e.g., "Power is flickering").  
   * Ramp up to "critical" messages (e.g., "Water at neck level", "Trapped in attic").  
   * Include "Noise" (irrelevant messages like "Traffic is bad") to test the Triage Agent's filtering.  
5. **Output:** Write the content directly to src/simulation/simulation\_data.json or append to it.

## **Creative Constraints**

* **Implicit Risks:** Do not just say "I need help." Generate messages like *"My oxygen tank battery is at 10% and the power is out"* (Implies Priority 1 Medical).  
* **Geospatial Clustering:** Ensure lat/lng coordinates are clustered around the specific disaster zone, not random.