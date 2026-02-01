
import { GoogleGenAI, Modality } from "@google/genai";
import { GroundingSource, SourceScope, VoiceGender, LegalMethod } from "../types";

// Gemini 3 Pro for superior reasoning and tool calling reliability
const TEXT_MODEL = 'gemini-3-pro-preview';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const generateAIResponse = async (
  prompt: string,
  base64Images: string[] = [],
  legalMethod: LegalMethod = 'NONE',
  scope: SourceScope = 'GLOBAL'
): Promise<{ text: string; sources: GroundingSource[]; error?: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return { text: "", sources: [], error: "API_KEY is missing in project settings." };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [{ text: prompt }];
  
  // Add multimodal support
  base64Images.forEach((img) => {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.split(',')[1] || img
      }
    });
  });

  const methodInstruction = legalMethod !== 'NONE' 
    ? `Apply the ${legalMethod} methodology to your analysis.`
    : "";

  const systemInstruction = `You are OmniSearch AI, a high-intelligence research assistant.
    CRITICAL: For every query, ALWAYS use the 'googleSearch' tool to verify facts and check recent events.
    JURISDICTION FOCUS: ${scope === 'NIGERIA' ? 'Nigeria (Constitution and Laws)' : 'Global/International'}.
    ${methodInstruction}
    Always provide factual citations and link to sources at the end. Be professional and direct.`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: { parts },
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI.");

    const sources: GroundingSource[] = [];
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    
    // Extract search grounding URLs as per guidelines
    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ 
            title: chunk.web.title || "Reference", 
            uri: chunk.web.uri 
          });
        }
      });
    }

    return { text, sources };
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return { 
      text: "", 
      sources: [], 
      error: error.message || "The AI encountered a search failure." 
    };
  }
};

export const generateSpeech = async (text: string, voiceGender: VoiceGender): Promise<Uint8Array | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  // Initialize AI client right before use
  const ai = new GoogleGenAI({ apiKey });
  const voiceName = voiceGender === 'FEMALE' ? 'Kore' : 'Fenrir';
  try {
    const cleanText = text
      .replace(/[#*_`~>]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim()
      .slice(0, 4000);
    
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName } 
          } 
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData?.data);
    return audioPart?.inlineData?.data ? decode(audioPart.inlineData.data) : null;
  } catch (error) { 
    return null; 
  }
};

/**
 * Standard base64 decoding to Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * Implementation follows the @google/genai guidelines for Live/TTS audio.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
