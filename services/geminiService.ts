import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to get today's date context
const getContextDate = () => new Date().toISOString().split('T')[0];

export const generateSlotsFromNaturalLanguage = async (
  prompt: string, 
  currentDateContext: string = getContextDate(),
  durationMinutes: number = 60
): Promise<{ startTime: string; endTime: string }[]> => {
  
  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `
      You are a smart scheduling assistant. 
      Your goal is to extract meeting time slots from natural language text.
      The current reference date (start of the week or today) is ${currentDateContext}.
      The desired meeting duration is ${durationMinutes} minutes.
      
      Instructions:
      1. Analyze the input text to identify dates, times, and patterns.
      2. Return a JSON array of objects with 'startTime' and 'endTime' in ISO 8601 format.
      3. For specific times (e.g., "Monday at 3pm"), create a single slot with the defined duration.
      4. For time ranges (e.g., "Monday between 1pm and 4pm"):
         - Generate multiple potential slots of ${durationMinutes} minutes that fit entirely within that range.
         - Do not overlap them unless necessary, but spacing them out (e.g., every hour) is good.
      5. For recurring patterns (e.g., "every Tuesday"):
         - Generate the next 4 occurrences starting from the reference date.
      6. For relative dates (e.g., "tomorrow", "next week"):
         - Calculate based on the reference date: ${currentDateContext}.
      7. For generic requests (e.g., "suggest some times"):
         - Propose 3-5 slots during business hours (9am-5pm) in the current reference week.
      
      Ensure all times are valid ISO strings.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING }
            },
            required: ["startTime", "endTime"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
};

export const analyzeBestSlot = async (
  slots: any[], 
  participants: any[]
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      Analyze the following voting data for a meeting.
      Slots: ${JSON.stringify(slots)}
      Participants and Votes: ${JSON.stringify(participants)}
      
      Identify the best time slot. Consider:
      1. Maximum 'YES' votes.
      2. 'MAYBE' votes as a tie-breaker (weighted half).
      3. 'NO' votes are blockers.
      
      Return a short, friendly summary sentence explaining the best choice (e.g., "Tuesday at 2pm is best with 5 yes votes.").
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "Could not analyze results.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI analysis currently unavailable.";
  }
}