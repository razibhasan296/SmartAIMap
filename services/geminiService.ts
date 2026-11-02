import { GoogleGenAI, Type } from "@google/genai";
import { LocationInfo, SensorData, VisualStyle, CodexEntry } from "../types";

const API_KEY = process.env.API_KEY || '';

export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: API_KEY });
};

export const generateJsonFromPrompt = async (prompt: string, schemaString: string): Promise<string> => {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "structured-json", prompt, schema: schemaString }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Structured extraction failed.");
  }
  return typeof result.text === "string" && result.text ? result.text : "{}";
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
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "location-report", prompt: locationName }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Location report failed.");
  }
  try {
    const parsed = JSON.parse(typeof result.text === "string" ? result.text : "");
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.markers)) {
      throw new Error("Invalid location report");
    }
    return parsed as LocationInfo;
  } catch {
    throw new Error("The AI service returned invalid location data.");
  }
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
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "reasoning", prompt: query }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Reasoning request failed.");
  }
  return typeof result.text === "string" && result.text ? result.text : "Reasoning process failed.";
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
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "voice-command", prompt: transcript }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Voice command request failed.");
  }

  try {
    const parsed = JSON.parse(typeof result.text === "string" ? result.text : "");
    const allowedActions = ["NAVIGATE", "SELECT_MARKER", "CHANGE_STYLE", "UNKNOWN"];
    if (!parsed || !allowedActions.includes(parsed.action)) return { action: "UNKNOWN" };
    return {
      action: parsed.action,
      ...(typeof parsed.target === "string" ? { target: parsed.target.slice(0, 200) } : {}),
    };
  } catch {
    return { action: "UNKNOWN" };
  }
};

export const chatWithGemini = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]): Promise<string> => {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "chat", prompt: message, history }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Chat request failed.");
  }
  return typeof result.text === "string" && result.text ? result.text : "Uplink failed.";
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
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "codex-entries", prompt: query }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Codex generation failed.");
  }
  try {
    const entries = JSON.parse(typeof result.text === "string" ? result.text : "");
    if (!Array.isArray(entries)) throw new Error("Invalid Codex response");
    return entries.slice(0, 5) as CodexEntry[];
  } catch {
    throw new Error("The AI service returned invalid Codex data.");
  }
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