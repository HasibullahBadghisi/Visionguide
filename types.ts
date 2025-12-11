export enum EnvironmentMode {
  HOME = 'HOME',
  MALL = 'MALL',
  STREET = 'STREET',
}

export interface ModeConfig {
  id: EnvironmentMode;
  label: string;
  icon: string;
  description: string;
  systemInstruction: string;
}

export interface LiveClientStatus {
  isConnected: boolean;
  isStreaming: boolean;
  error?: string;
}

export type AudioWorkletMessage = {
  type: 'AUDIO_DATA';
  payload: Float32Array;
};