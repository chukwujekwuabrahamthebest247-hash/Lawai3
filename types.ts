
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: string[]; // base64 images
  sources?: GroundingSource[];
  audioBuffer?: AudioBuffer;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export type LegalMethod = 'NONE' | 'IRAC' | 'IPAC' | 'CREC';
export type SourceScope = 'NIGERIA' | 'GLOBAL';
export type VoiceGender = 'MALE' | 'FEMALE';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastModified: number;
}

export enum AppStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  ERROR = 'error'
}
