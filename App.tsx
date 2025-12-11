import React, { useState } from 'react';
import { MODE_CONFIGS } from './constants';
import { EnvironmentMode, ModeConfig } from './types';
import EnvironmentCard from './components/EnvironmentCard';
import LiveSession from './components/LiveSession';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<ModeConfig | null>(null);

  const handleModeSelect = (config: ModeConfig) => {
    setActiveMode(config);
  };

  const handleExit = () => {
    setActiveMode(null);
  };

  if (activeMode) {
    return <LiveSession mode={activeMode} onExit={handleExit} />;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 flex flex-col max-w-2xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-yellow-400 mb-2 tracking-tight">
          VisionGuide
        </h1>
        <p className="text-xl text-gray-400">
          AI-Powered Navigation Assistant
        </p>
      </header>

      <main className="flex-grow flex flex-col justify-center">
        <h2 className="text-2xl font-bold mb-6 text-white border-l-4 border-yellow-400 pl-4">
          Select Environment
        </h2>
        
        <div className="space-y-4">
          {Object.values(MODE_CONFIGS).map((config) => (
            <EnvironmentCard 
              key={config.id} 
              config={config} 
              onClick={handleModeSelect} 
            />
          ))}
        </div>
      </main>

      <footer className="mt-8 text-center text-gray-600 text-sm">
        <p>Powered by Gemini Live API</p>
        <p className="mt-1">
          <i className="fas fa-universal-access mr-1"></i> Designed for Accessibility
        </p>
      </footer>
    </div>
  );
};

export default App;