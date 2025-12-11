import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ModeConfig } from '../types';
import { GeminiLiveService } from '../services/geminiLive';
import { VIDEO_FRAME_RATE_MS } from '../constants';

interface Props {
  mode: ModeConfig;
  onExit: () => void;
}

const LiveSession: React.FC<Props> = ({ mode, onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const frameIntervalRef = useRef<number | null>(null);

  // Helper for TTS
  const speakStatus = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop previous speech
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const initSession = useCallback(async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setError("API Key not found in environment.");
      speakStatus("Error. API Key not found.");
      return;
    }

    // Announce starting
    speakStatus(`Starting ${mode.label} mode. Connecting.`);

    // Initialize Service
    const service = new GeminiLiveService(
      apiKey, 
      () => {
        setIsConnected(false);
        speakStatus("Disconnected.");
      },
      (err) => {
        setError(err);
        speakStatus("Error. " + err);
      }
    );
    serviceRef.current = service;

    // 1. Connect to AI
    try {
      await service.connect(mode.systemInstruction);
      setIsConnected(true);
      speakStatus("Connected. Accessing camera.");
    } catch (e: any) {
      console.error(e);
      setError(`Connection Failed: ${e.message || "Unknown error"}`);
      speakStatus("Failed to connect to AI.");
      return; // Stop execution
    }

    // 2. Setup Camera (with Fallback)
    try {
      let stream: MediaStream;
      try {
         // Try environment camera first
         stream = await navigator.mediaDevices.getUserMedia({
          video: { 
              facingMode: 'environment',
              width: { ideal: 640 },
              height: { ideal: 480 }
          }
        });
      } catch (camErr) {
         console.warn("Environment camera failed, attempting default.", camErr);
         stream = await navigator.mediaDevices.getUserMedia({
          video: true 
         });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      speakStatus("Camera active. Listen to my guidance.");
      // Start Sending Frames
      startFrameStreaming();

    } catch (e) {
      console.error(e);
      setError("Camera Access Denied. Please check permissions.");
      speakStatus("Failed to access camera.");
    }
  }, [mode]);

  const startFrameStreaming = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = window.setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !serviceRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            // Convert to base64 JPEG
            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            serviceRef.current.sendVideoFrame(base64Data);
        }
    }, VIDEO_FRAME_RATE_MS);
  };

  useEffect(() => {
    initSession();

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      serviceRef.current?.disconnect();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      window.speechSynthesis.cancel();
    };
  }, [initSession]);

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Feed */}
      <div className="flex-grow relative overflow-hidden">
        <video 
            ref={videoRef} 
            className="absolute top-0 left-0 w-full h-full object-cover opacity-80"
            muted 
            playsInline 
        />
        
        {/* Connection Status Overlay */}
        {!isConnected && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20">
                <div className="text-center">
                    <i className="fas fa-circle-notch fa-spin text-6xl text-yellow-400 mb-4"></i>
                    <p className="text-2xl font-bold">Connecting...</p>
                </div>
            </div>
        )}

        {/* Error Overlay */}
        {error && (
             <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-95 z-30 p-8">
             <div className="text-center">
                 <i className="fas fa-exclamation-triangle text-6xl text-white mb-4"></i>
                 <p className="text-2xl font-bold mb-8">{error}</p>
                 <button 
                    onClick={onExit}
                    className="bg-white text-red-900 px-8 py-4 rounded-full font-bold text-xl uppercase tracking-wider"
                 >
                    Return Home
                 </button>
             </div>
         </div>
        )}

        {/* Active Indicator & Mode Label */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
             <div className="bg-black bg-opacity-70 backdrop-blur-md border border-yellow-400 rounded-lg p-3">
                 <div className="flex items-center gap-2">
                     <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                     <span className="font-bold uppercase tracking-wider text-sm">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                 </div>
             </div>
             <div className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold shadow-lg">
                <i className={`fas ${mode.icon} mr-2`}></i>
                {mode.label}
             </div>
        </div>
      </div>

      {/* Controls */}
      <div className="h-1/3 min-h-[200px] bg-gray-900 border-t-4 border-yellow-400 p-6 flex flex-col justify-between">
          <div className="text-center mb-4">
              <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Instructions</p>
              <p className="text-xl font-medium text-white">
                Point camera. Listen to guidance.
              </p>
          </div>

          <button 
            onClick={onExit}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 rounded-xl text-2xl uppercase tracking-widest shadow-lg active:transform active:scale-95 transition-all flex items-center justify-center gap-4"
            aria-label="Stop navigation and return to menu"
          >
            <i className="fas fa-stop-circle text-3xl"></i>
            End Session
          </button>
      </div>
    </div>
  );
};

export default LiveSession;