import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { LocationInfo, SensorData, VisualStyle, CodexEntry } from "../types";

const API_KEY = process.env.API_KEY || '';

export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: API_KEY });
};

export const generateJsonFromPrompt = async (prompt: string, schemaString: string): Promise<string> => {
  const ai = getGeminiClient();
  let schemaObj;
  try {
    schemaObj = JSON.parse(schemaString);
  } catch (e) {
    throw new Error("Invalid JSON Schema provided. Please ensure it is valid JSON.");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schemaObj,
    }
  });
  
  return response.text || "{}";
};

/**
 * Resilient wrapper for Gemini API calls to handle transient quota issues.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || 
                         error.message?.includes('quota') || 
                         error.message?.includes('EXHAUSTED');
    
    if (retries > 0 && isQuotaError) {
      console.warn(`RAI Uplink saturated. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateLocationData = async (locationName: string): Promise<LocationInfo> => {
  const ai = getGeminiClient();
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the location "${locationName}" for our SMARTAIMAP RAI system. Provide a detailed report including its environmental sound characteristics and 3-5 interesting points of interest (markers) that would be visible in a 360 view.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            coordinates: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              required: ["lat", "lng"]
            },
            description: { type: Type.STRING },
            threatLevel: { type: Type.STRING, enum: ["Low", "Moderate", "Critical", "Unknown"] },
            soundProfile: { type: Type.STRING, enum: ["Industrial", "Natural", "Void", "Electronic", "Hostile"] },
            markers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["History", "Anomaly", "Sensor", "POI"] },
                  x: { type: Type.NUMBER, description: "Horizontal position 0-100" },
                  y: { type: Type.NUMBER, description: "Vertical position 20-80" }
                },
                required: ["id", "label", "description", "type", "x", "y"]
              }
            },
            sensorSummary: {
              type: Type.OBJECT,
              properties: {
                temperature: { type: Type.NUMBER },
                humidity: { type: Type.NUMBER },
                pressure: { type: Type.NUMBER },
                radiation: { type: Type.NUMBER },
                aiSync: { type: Type.NUMBER },
                raiStability: { type: Type.NUMBER }
              }
            }
          },
          required: ["name", "coordinates", "description", "threatLevel", "sensorSummary", "soundProfile", "markers"]
        }
      }
    });
    return JSON.parse(response.text);
  });
};

export const generate360View = async (prompt: string): Promise<string> => {
  const ai = getGeminiClient();
  
  let finalPrompt = prompt;
  // Specialized epic logic for the WORLD MAPS Hub - Updated with white circular disc and circuit aesthetic
  if (prompt.toLowerCase().includes("world map") || prompt.toLowerCase().includes("nexus prime") || prompt.toLowerCase().includes("initial_location")) {
    finalPrompt = `A hyper-realistic 360-degree equirectangular panorama of the #SMARTAIMAP Global Intelligence Hub. The visualization displays a massive, glowing digital Earth in the center, surrounded by floating holographic data-streams. The map is alive with real-time environmental data: pulsing heat-maps of climate change, swirling emerald wind-patterns, and glowing cyan paths of #RAI bot swarms. Technical telemetry displays floating in mid-air: '#RAI', '#SMARTAIBOTBODYLOCK', '#ENVIRONMENT'. Massive curved obsidian floor reflects the glowing circuitry. Outside massive windows, orbital sunrise flares across the curve of Earth. Immersive, sci-fi, cinematic lighting, 8k resolution.`;
  }

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `A futuristic 360-degree equirectangular panoramic view of ${finalPrompt}. The perspective should feel like an immersive virtual environment from a smart bot visor. Hyper-realistic, 8k resolution, cinematic lighting, dramatic atmosphere, detailed textures.` }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data received");
  });
};

export const analyzeVideo = async (videoBase64: string, mimeType: string, prompt: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: videoBase64, mimeType } },
        { text: prompt }
      ]
    }
  });
  return response.text || "No analysis available.";
};

export const complexReasoning = async (query: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });
  return response.text || "Reasoning process failed.";
};

export const transcribeAudio = async (base64: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64, mimeType: 'audio/wav' } },
        { text: "Transcribe this audio command for the #RAI interface." }
      ]
    }
  });
  return response.text || "";
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO" as any],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const processVoiceCommand = async (transcript: string): Promise<{ action: string, target?: string }> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Interpret this voice command for the #RAI system: "${transcript}". 
    Possible actions: 
    - NAVIGATE: Go to a new location (e.g., "Take me to Tokyo", "Search for Mars").
    - SELECT_MARKER: Interact with a point of interest (e.g., "Select the anomaly", "Show info for the sensor").
    - CHANGE_STYLE: Change the visual lens (e.g., "Switch to Thermal", "Go Cyberpunk").
    - UNKNOWN: Command not recognized.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["NAVIGATE", "SELECT_MARKER", "CHANGE_STYLE", "UNKNOWN"] },
          target: { type: Type.STRING, description: "The specific location, marker name, or style name mentioned." }
        },
        required: ["action"]
      }
    }
  });
  
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return { action: "UNKNOWN" };
  }
};

export const chatWithGemini = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]): Promise<string> => {
  const ai = getGeminiClient();
  const chat = ai.chats.create({
    model: 'gemini-3.1-pro-preview',
    config: {
      systemInstruction: "You are the SMARTAIMAP AI Assistant. You help users navigate the #RAI system, explore 360 locations, and understand environmental data. Be technical, helpful, and maintain the futuristic aesthetic. Use #RAI and #SMARTAIMAP in your responses.",
    },
    history: history
  });
  const response = await chat.sendMessage({ message });
  return response.text || "Uplink failed.";
};

export const getMapsGrounding = async (query: string, lat?: number, lng?: number): Promise<string> => {
  const ai = getGeminiClient();
  const config: any = {
    tools: [{ googleMaps: {} }],
  };
  
  if (lat !== undefined && lng !== undefined) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: { latitude: lat, longitude: lng }
      }
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: query,
    config
  });
  
  return response.text || "No geographical data found.";
};

export const generateHighResImage = async (prompt: string, size: '1K' | '2K' | '4K', aspectRatio: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        imageSize: size as any,
        aspectRatio: aspectRatio as any
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("High-res render failed.");
};

export const generateVeoVideo = async (prompt: string, aspectRatio: '16:9' | '9:16'): Promise<string> => {
  const ai = getGeminiClient();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed.");
  
  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: { 'x-goog-api-key': API_KEY },
  });
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const getCodexEntries = async (query: string): Promise<CodexEntry[]> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 5 relevant SMARTAIMAP Codex entries for the query: "${query}". 
    Categories: Location, Protocol, Intelligence, Entity.
    Entries should be technical and sci-fi themed.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            category: { type: Type.STRING, enum: ["Location", "Protocol", "Intelligence", "Entity"] },
            content: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            lastUpdated: { type: Type.STRING }
          },
          required: ["id", "title", "category", "content", "tags", "lastUpdated"]
        }
      }
    }
  });
  
  return JSON.parse(response.text);
};

export const decryptClassifiedCode = async (code: string): Promise<{ locationName: string, intel: string, style: VisualStyle }> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Decrypt this classified #RAI access code: "${code}". 
    This is a high-security identifier for a secret location in the SMARTAIMAP system.
    Provide the name of the classified location, a brief high-level intelligence report, and the recommended visual lens style (e.g., 'Classified', 'Night Vision', 'Thermal').`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          locationName: { type: Type.STRING },
          intel: { type: Type.STRING },
          style: { type: Type.STRING }
        },
        required: ["locationName", "intel", "style"]
      }
    }
  });
  
  return JSON.parse(response.text);
};