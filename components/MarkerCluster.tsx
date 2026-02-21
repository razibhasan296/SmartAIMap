import React, { useState } from 'react';
import { MarkerData } from '../types';
import InteractiveMarker from './InteractiveMarker';

interface MarkerClusterProps {
  clusterId: string;
  markers: MarkerData[];
  onMarkerActivate: (marker: MarkerData) => void;
}

const MarkerCluster: React.FC<MarkerClusterProps> = ({ clusterId, markers, onMarkerActivate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate center point of the cluster
  const centerX = markers.reduce((sum, m) => sum + m.x, 0) / markers.length;
  const centerY = markers.reduce((sum, m) => sum + m.y, 0) / markers.length;

  if (markers.length === 1) {
    return <InteractiveMarker marker={markers[0]} onActivate={onMarkerActivate} />;
  }

  /**
   * HIGH-ENGAGEMENT TIMING FUNCTIONS
   * springOut: A snappy expansion with a smooth overshoot.
   * fluidIn: A quick, liquid-like collapse.
   */
  const springOut = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const fluidIn = 'cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div 
      className="absolute z-40 pointer-events-none"
      style={{ left: `${centerX}%`, top: `${centerY}%` }}
    >
      {/* The Cluster Hub - Hexagonal Shape like RAI CORE */}
      <div 
        className={`pointer-events-auto cursor-pointer relative transition-all duration-700 flex items-center justify-center
          ${isExpanded ? 'scale-50 opacity-40 blur-[2px]' : 'scale-100 opacity-100 hover:scale-110'}`}
        style={{ 
          transform: 'translate(-50%, -50%)', 
          transitionTimingFunction: isExpanded ? fluidIn : springOut 
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Hexagon Hub */}
        <div className="w-16 h-16 bg-amber-500/10 border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.6)] flex items-center justify-center relative group"
             style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}>
          
          <div className="flex flex-col items-center justify-center relative z-10">
            <span className="font-orbitron font-bold text-amber-400 text-xl leading-none">{markers.length}</span>
            <span className="text-[7px] font-orbitron text-amber-500/70 font-bold uppercase tracking-tighter">Nodes</span>
          </div>

          {/* Internal data swirl */}
          <div className="absolute inset-0 opacity-40 bg-[conic-gradient(from_0deg,transparent,rgba(245,158,11,0.5),transparent)] animate-[spin_4s_linear_infinite]"></div>
        </div>

        {/* Outer orbital rings */}
        <div className="absolute inset-[-12px] border-2 border-dashed border-amber-500/20 rounded-full animate-[spin_25s_linear_infinite]"></div>
        <div className="absolute inset-[-6px] border border-amber-400/40 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
        
        {/* Connection status tag */}
        <div className={`absolute top-full mt-6 bg-slate-950/95 border border-amber-500/40 px-4 py-1.5 rounded-full text-[8px] font-orbitron text-amber-400 whitespace-nowrap transition-all duration-500 shadow-[0_10px_20px_rgba(0,0,0,0.5)] ${isHovered && !isExpanded ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90'}`}>
          <span className="w-2 h-2 inline-block rounded-full bg-amber-500 animate-ping mr-2"></span>
          TEMPORAL_CONVERGENCE_LOCKED
        </div>
      </div>

      {/* Children Expansion */}
      {markers.map((marker, index) => {
        const radius = isExpanded ? 130 : 0; 
        const angle = (index / markers.length) * Math.PI * 2 - (Math.PI / 2);
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;

        return (
          <div 
            key={marker.id}
            className={`absolute transition-all duration-[800ms] z-50 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}
            style={{ 
              transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
              transitionTimingFunction: springOut,
              transitionDelay: isExpanded ? `${index * 60}ms` : '0ms'
            }}
          >
            {/* Pulsing Data Link Line */}
            {isExpanded && (
              <div 
                className="absolute origin-left h-[2px] transition-opacity duration-1000"
                style={{ 
                  width: `${radius}px`,
                  left: `${-offsetX}px`,
                  top: `${-offsetY}px`,
                  transform: `rotate(${angle}rad)`,
                  zIndex: -1,
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.4) 0%, transparent 100%)',
                  opacity: isExpanded ? 1 : 0
                }}
              >
                <div className="h-full w-1/3 bg-amber-300 shadow-[0_0_10px_#f59e0b] animate-[dataFlow_2s_linear_infinite]"></div>
              </div>
            )}
            
            <InteractiveMarker marker={marker} onActivate={(m) => {
              onMarkerActivate(m);
              setIsExpanded(false);
            }} />
          </div>
        );
      })}

      {/* Close button for expanded state */}
      {isExpanded && (
        <button 
          onClick={() => setIsExpanded(false)}
          className="absolute pointer-events-auto bg-slate-900/95 border border-amber-500/50 rounded-full p-2 text-amber-500 hover:text-white hover:bg-amber-600 transition-all z-50 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-110 active:scale-95"
          style={{ transform: 'translate(-50%, -50%)', top: '0', left: '0' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <style>{`
        @keyframes dataFlow {
          0% { transform: translateX(-100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(300%); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default MarkerCluster;