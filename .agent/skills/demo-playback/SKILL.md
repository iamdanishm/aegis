## ---

**name: demo-playback description: Controls the simulation playback engine, enabling start, stop, pause, and speed adjustments for the demo presentation.**

# **Demo Playback Control**

Use this skill when the user wants to "test the simulation", "speed up the demo", or "debug the timeline".

## **Instructions**

1. **Locate the Engine:** Find src/hooks/useDisasterSimulation.ts.  
2. **Modify Playback State:**  
   * To **Start**: Trigger the startSimulation() function in the global state.  
   * To **Speed Up**: Adjust the tickRate multiplier (e.g., set to 2x or 5x real-time).  
   * To **Inject Event**: Manually push a specific event object into the activeEvents array for testing specific UI reactions.  
3. **Verify UI Sync:** Ensure the Map and the Feed components are re-rendering upon state changes.

## **Verification Step**

After modifying playback, ask the user: "Do you want to run a 30-second dry run of the 'Attic Rescue' scenario to verify the Reasoning Log animation?"