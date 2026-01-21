## ---

**name: scaffold-agent description: Scaffolds a new Aegis AI Agent (e.g., Triage, Logistics) with Gemini 3 Deep Thinking configuration and Thought Signature handling.**

# **Scaffold New Aegis Agent**

Use this skill when the user asks to "create a new agent" or "build the \[Name\] agent".

## **Instructions**

1. **Identify the Agent Role:** Determine if this is a Coordinator, Triage, Surveillance, or Logistics agent based on the user request.  
2. **Create the File:** Generate a new file in src/agents/\[agent-name\].ts.  
3. **Apply Gemini 3 Configuration:**  
   * Initialize GoogleGenerativeAI client.  
   * **CRITICAL:** Set thinking\_config to ThinkingLevel.HIGH if it is a reasoning agent (Triage/Logistics).  
   * **CRITICAL:** Enable include\_thoughts: true.  
4. **Implement Thought Signature Loop:**  
   * Create a function runTurn(history, input) that calls generateContent.  
   * Extract thought\_signature from the response parts.  
   * Add a comment block explaining: *"We persist this signature to maintain the cryptographic chain of custody for the demo."*  
5. **Define Output Schema:** Ensure the agent returns structured JSON using responseMimeType: "application/json".

## **Template Code Pattern**

TypeScript

import { GoogleGenerativeAI, ThinkingLevel } from "@google/genai";

export class \[AgentName\] {  
  private model: any;

  constructor() {  
    const genAI \= new GoogleGenerativeAI(process.env.GEMINI\_API\_KEY);  
    this.model \= genAI.getGenerativeModel({  
      model: "gemini-2.0-flash-thinking-exp-1219",  
      generationConfig: {  
        thinkingConfig: {  
            thinkingLevel: ThinkingLevel.HIGH,  
            includeThoughts: true   
        },  
        responseMimeType: "application/json"  
      }  
    });  
  }

  async process(input: string, history: any) {  
    // Agent logic here  
  }  
}  
