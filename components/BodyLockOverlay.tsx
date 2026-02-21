import React, { useState, useEffect, useRef } from 'react';
import { BotLockStatus } from '../types';

interface BodyLockOverlayProps {
  status: BotLockStatus;
  onVerify: () => void;
}

const BodyLockOverlay: React.FC<BodyLockOverlayProps> = ({ status, onVerify }) => {
  const [progress, setProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPressing && progress < 100) {
      timerRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timerRef.current!);
            setScanComplete(true);
            setTimeout(onVerify, 1000);
            return 100;
          }
          return prev + 2;
        });
      }, 30);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!scanComplete) {
        setProgress(prev => Math.max(0, prev - 5));
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPressing, progress, scanComplete, onVerify]);

  if (status === BotLockStatus.LOCKED && !isPressing && progress === 0) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-1000 ${status === BotLockStatus.LOCKED ? 'opacity-0 pointer-events-none' : 'bg-black/90 backdrop-blur-3xl'}`}>
      <div className="max-w-md w-full p-8 flex flex-col items-center text-center">
        {/* Futuristic Header */}
        <div className="mb-12">
          <div className="text-[10px] font-orbitron text-cyan-500/50 uppercase tracking-[0.5em] mb-2">Security Protocol</div>
          <h1 className="text-3xl font-bold font-orbitron tracking-tighter text-white mb-4 italic">
            #SMARTAIBOT<span className="text-cyan-400">BODYLOCK</span>
          </h1>
          <p className="text-slate-400 text-xs font-mono leading-relaxed">
            Biometric synchronization required for RAI interface access. 
            Maintain physical contact with the neural uplink sensor.
          </p>
        </div>

        {/* Biometric Scanner UI */}
        <div className="relative w-64 h-64 flex items-center justify-center mb-12">
          {/* Outer Rings */}
          <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
          <div className="absolute inset-4 border border-dashed border-cyan-500/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
          
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-800"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 120}
              strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
              className="text-cyan-400 transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(34,211,238,0.5)]"
              strokeLinecap="round"
            />
          </svg>

          {/* Scanner Button */}
          <button
            onMouseDown={() => setIsPressing(true)}
            onMouseUp={() => setIsPressing(false)}
            onMouseLeave={() => setIsPressing(false)}
            onTouchStart={() => setIsPressing(true)}
            onTouchEnd={() => setIsPressing(false)}
            className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 group
              ${isPressing ? 'scale-95 shadow-[0_0_50px_rgba(34,211,238,0.4)]' : 'hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]'}
              ${scanComplete ? 'bg-cyan-500' : 'bg-slate-900 border border-cyan-500/30'}
            `}
          >
            {scanComplete ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-black animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center transition-all duration-300 ${isPressing ? 'border-cyan-400' : 'border-slate-700'}`}>
                  <div className={`w-8 h-[2px] bg-cyan-400 animate-[scan_2s_linear_infinite] ${isPressing ? 'opacity-100' : 'opacity-20'}`}></div>
                </div>
                <span className="text-[10px] font-orbitron text-cyan-500/70 tracking-widest">HOLD TO SYNC</span>
              </div>
            )}
            
            {/* Pulse Effect */}
            {isPressing && (
              <div className="absolute inset-0 rounded-full animate-ping bg-cyan-500/20"></div>
            )}
          </button>
        </div>

        {/* Status Indicators */}
        <div className="w-full grid grid-cols-3 gap-4 font-mono text-[8px] uppercase tracking-widest">
          <div className="flex flex-col gap-1">
            <span className="text-slate-500">Neural_Link</span>
            <span className={isPressing ? 'text-cyan-400' : 'text-slate-700'}>{isPressing ? 'ACTIVE' : 'WAITING'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-500">Sync_Rate</span>
            <span className="text-white">{progress}%</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-500">Encryption</span>
            <span className="text-white">AES-512-RAI</span>
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-12 text-[7px] text-slate-600 font-mono uppercase tracking-[0.2em]">
          Authorized Personnel Only // System ID: RAI-EXPLORER-01
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-15px); }
          50% { transform: translateY(15px); }
          100% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  );
};

export default BodyLockOverlay;
