import React, { useState } from 'react';
import { MarkerData } from '../types';

interface InteractiveMarkerProps {
  marker: MarkerData;
  onActivate?: (marker: MarkerData) => void;
}

const InteractiveMarker: React.FC<InteractiveMarkerProps> = ({ marker, onActivate }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getMarkerIcon = () => {
    switch (marker.type) {
      case 'Anomaly': return '☢️';
      case 'History': return '⌛';
      case 'Sensor': return '📡';
      default: return '📍';
    }
  };

  const getMarkerTheme = () => {
    switch (marker.type) {
      case 'Anomaly': return { color: 'purple', glow: '#a855f7' };
      case 'History': return { color: 'amber', glow: '#f59e0b' };
      case 'Sensor': return { color: 'cyan', glow: '#22d3ee' };
      default: return { color: 'slate', glow: '#94a3b8' };
    }
  };

  const theme = getMarkerTheme();
  const isHistory = marker.type === 'History';
  const isAnomaly = marker.type === 'Anomaly';

  return (
    <div 
      className={`absolute pointer-events-auto cursor-pointer transition-transform duration-300 z-30 
        ${isHistory ? 'animate-[temporalHover_4s_easeInOut_infinite]' : ''}`}
      style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: `translate(-50%, -50%) scale(${isHovered ? 1.3 : 1})` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onActivate?.(marker)}
    >
      {/* Visual Marker Container - Updated to match branding disc style */}
      <div className="relative w-14 h-14 flex items-center justify-center">
        
        {/* White Outer Circle Backdrop (from branding image) */}
        <div className={`absolute inset-0 bg-white rounded-full transition-all duration-500 shadow-[0_0_20px_rgba(255,255,255,0.4)] ${isHovered ? 'scale-110' : 'scale-90'}`}></div>

        {/* Pulsing Circuit Rings */}
        <div className={`absolute inset-[-4px] border border-white/20 rounded-full ${isHovered ? 'animate-ping opacity-30' : 'opacity-0'}`}></div>
        
        {/* Main Marker Core - Location Pin with Circuits */}
        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all relative z-10 
          bg-slate-950 border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.5)]
          ${isHovered ? 'border-[var(--theme-primary)] scale-105' : ''}`}>
          
          {/* Inner Circuit Glow */}
          <div className="absolute inset-1 rounded-full opacity-20 bg-[radial-gradient(circle_at_center,var(--theme-primary)_0%,transparent_70%)] animate-pulse"></div>
          
          <span className={`text-sm inline-block transition-transform relative z-10
            ${isHovered ? 'animate-[markerIconPulse_1.2s_ease-in-out_infinite]' : ''}`}>
            {getMarkerIcon()}
          </span>

          {/* Location Pin Tail Visual */}
          <div className={`absolute top-full -mt-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-950 z-0 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}></div>
        </div>

        {/* Rapid Label Tag */}
        <div className={`absolute top-full mt-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200 px-3 py-0.5 rounded-full text-[9px] font-orbitron font-bold text-slate-900 uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0 shadow-[0_4px_15px_rgba(0,0,0,0.2)]' : 'opacity-0 -translate-y-2'}`}>
          {marker.label}
        </div>
      </div>

      {/* Prominent HUD Tooltip */}
      <div 
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-6 w-64 p-4 bg-slate-950/95 backdrop-blur-3xl border-2 transition-all duration-500 origin-bottom overflow-hidden rounded-2xl ${
          isHovered 
            ? 'opacity-100 scale-115 translate-y-[-20px] border-[var(--theme-primary)] shadow-[0_0_60px_rgba(0,0,0,0.95)]' 
            : 'opacity-0 scale-90 border-slate-800 shadow-none pointer-events-none'
        }`}
      >
        {/* Holographic Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[var(--theme-primary)]/15 to-transparent h-12 w-full animate-[scanlineMove_2.5s_linear_infinite]"></div>

        <div className="relative z-10">
          <div className="text-[12px] font-orbitron font-bold theme-text-primary mb-1 flex justify-between items-center">
            <span className="truncate pr-2">{marker.label}</span>
            <span className={`px-2 py-0.5 rounded text-[8px] border ${isHistory ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-200 border-slate-700'} flex-shrink-0 uppercase font-bold tracking-widest`}>
              {marker.type}
            </span>
          </div>
          
          <div className="h-[1px] w-full bg-gradient-to-r from-[var(--theme-primary)]/60 via-[var(--theme-primary)]/20 to-transparent mb-2"></div>
          
          <p className="text-[10px] leading-relaxed font-mono text-slate-300">
            {marker.description}
          </p>
          
          <div className="mt-4 pt-2 border-t border-slate-800/50 flex justify-between items-center text-[7px] font-mono text-slate-500 uppercase tracking-widest">
             <span>L-SYNC: SYNCED</span>
             <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-full theme-bg-primary animate-[shimmer_1.5s_infinite]"></div>
             </div>
          </div>
        </div>

        <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] transition-colors duration-300 ${isHovered ? 'border-t-[var(--theme-primary)]' : 'border-t-slate-800'}`}></div>
      </div>

      <style>{`
        @keyframes temporalHover {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-10px); }
        }
        @keyframes scanlineMove {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(300%); }
        }
        @keyframes markerIconPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default InteractiveMarker;