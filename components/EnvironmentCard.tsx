import React from 'react';
import { ModeConfig } from '../types';

interface Props {
  config: ModeConfig;
  onClick: (config: ModeConfig) => void;
}

const EnvironmentCard: React.FC<Props> = ({ config, onClick }) => {
  return (
    <button
      onClick={() => onClick(config)}
      className="w-full text-left p-6 mb-4 rounded-xl border-4 border-yellow-400 bg-gray-900 hover:bg-gray-800 transition-colors focus:ring-4 focus:ring-yellow-400 focus:outline-none group"
      aria-label={`Select ${config.label} mode. ${config.description}`}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-yellow-400 rounded-full text-black mr-4 group-hover:scale-110 transition-transform">
          <i className={`fas ${config.icon} text-3xl`}></i>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-yellow-400 mb-1">{config.label}</h3>
          <p className="text-gray-300 text-lg leading-snug">{config.description}</p>
        </div>
      </div>
    </button>
  );
};

export default EnvironmentCard;