import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { PCM_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE } from '../constants';
import { arrayBufferToBase64, base64ToUint8Array, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private onDisconnect: () => void;
  private onError: (error: string) => void;

  constructor(apiKey: string, onDisconnect: () => void, onError: (err: string) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onDisconnect = onDisconnect;
    this.onError = onError;
  }

  async connect(systemInstruction: string) {
    // 1. Initialize Audio Contexts
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: PCM_SAMPLE_RATE,
    });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
    });
    this.nextStartTime = this.outputAudioContext.currentTime;

    // 2. Resume AudioContexts immediately
    try {
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }
    } catch (e) {
      console.warn("Failed to resume audio context:", e);
    }

    // 3. Connect to Gemini Live
    try {
      // Assign promise immediately
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: this.handleClose.bind(this),
          onerror: (e) => {
            console.error('Gemini API Error:', e);
            this.onError("Connection error occurred.");
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      // Wait for the connection to be established to catch immediate errors
      await this.sessionPromise;

    } catch (err: any) {
        // Clean up if connection failed immediately
        this.cleanup();
        throw new Error(err.message || "Failed to initiate connection");
    }
  }

  private async handleOpen() {
    console.log("Connected to Gemini Live");
    // Start Microphone Stream
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      if (!this.inputAudioContext) return;

      const source = this.inputAudioContext.createMediaStreamSource(this.stream);
      this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = float32ToInt16(inputData);
        const base64Data = arrayBufferToBase64(pcmData.buffer);
        
        this.sessionPromise?.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        });
      };

      source.connect(this.processor);
      this.processor.connect(this.inputAudioContext.destination);

    } catch (err) {
      this.onError("Microphone access denied or failed.");
    }
  }

  private async handleMessage(message: LiveServerMessage) {
    if (!this.outputAudioContext) return;

    // Handle Interruption (User spoke while model was speaking)
    const interrupted = message.serverContent?.interrupted;
    if (interrupted) {
      this.stopAllAudio();
      this.nextStartTime = this.outputAudioContext.currentTime; 
      return;
    }

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      try {
        const uint8Array = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(uint8Array, this.outputAudioContext, AUDIO_OUTPUT_SAMPLE_RATE);
        
        // Ensure seamless playback by scheduling next chunk
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        
        source.onended = () => {
          this.sources.delete(source);
        };
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
      } catch (e) {
        console.error("Error decoding audio", e);
      }
    }
  }

  private handleClose() {
    console.log("Gemini connection closed");
    this.cleanup();
    this.onDisconnect();
  }

  public sendVideoFrame(base64Image: string) {
     this.sessionPromise?.then(session => {
        session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64Image
            }
        });
     });
  }

  public stopAllAudio() {
    this.sources.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    this.sources.clear();
  }

  public async disconnect() {
    if (this.sessionPromise) {
       // Best effort close
       try {
           const session = await this.sessionPromise;
           if (session && typeof session.close === 'function') {
             session.close();
           }
       } catch (e) {
           console.log("Session close error", e);
       }
    }
    this.cleanup();
    this.onDisconnect();
  }

  private cleanup() {
    this.stopAllAudio();
    if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    if (this.inputAudioContext) {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    this.sessionPromise = null;
  }
}