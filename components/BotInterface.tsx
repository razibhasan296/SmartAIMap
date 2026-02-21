import React, { useState, useEffect } from 'react';
import { BotLockStatus } from '../types';

interface BotInterfaceProps {
  status: BotLockStatus;
  onStatusChange: (status: BotLockStatus) => void;
}

const BotInterface: React.FC<BotInterfaceProps> = ({ status, onStatusChange }) => {
  const [logs, setLogs] = useState<string[]>(['System Initialized...', 'RAI Handshake: OK']);

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    let message = '';
    switch (status) {
      case BotLockStatus.UNLOCKED: message = 'L-SYNC RELEASED: FREE MOTION'; break;
      case BotLockStatus.SCANNING: message = 'INITIATING SPATIAL SWEEP...'; break;
      case BotLockStatus.LOCKED: message = 'BODYLOCK ENGAGED: TARGET FIXED'; break;
      case BotLockStatus.OVERRIDE: message = 'CRITICAL: MANUAL OVERRIDE ACTIVE'; break;
      case BotLockStatus.DECRYPTING: message = 'DECRYPTING CLASSIFIED #RAI CODE...'; break;
    }
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 3)]);
  }, [status]);

  const getThemeColor = () => {
    switch (status) {
      case BotLockStatus.LOCKED: return 'cyan';
      case BotLockStatus.SCANNING: return 'yellow';
      case BotLockStatus.OVERRIDE: return 'red';
      case BotLockStatus.UNLOCKED: return 'emerald';
      case BotLockStatus.DECRYPTING: return 'purple';
      default: return 'slate';
    }
  };

  const theme = getThemeColor();
  const colorMap = {
    cyan: 'text-cyan-400 border-cyan-500/50 shadow-cyan-500/20 bg-cyan-500/5',
    yellow: 'text-yellow-400 border-yellow-500/50 shadow-yellow-500/20 bg-yellow-500/5',
    red: 'text-red-500 border-red-600 shadow-red-600/30 bg-red-600/10',
    emerald: 'text-emerald-400 border-emerald-500/50 shadow-emerald-500/20 bg-emerald-500/5',
    purple: 'text-purple-400 border-purple-500/50 shadow-purple-500/20 bg-purple-500/5',
    slate: 'text-slate-400 border-slate-700 shadow-transparent bg-slate-900/40'
  };

  return (
    <div className={`border bg-slate-950/80 backdrop-blur-2xl p-5 rounded-xl transition-all duration-700 relative overflow-hidden ${colorMap[theme]} shadow-2xl`}>
      {/* Background Animated Elements */}
      {status === BotLockStatus.OVERRIDE && (
        <div className="absolute inset-0 bg-red-900/10 animate-[pulse_1s_infinite] pointer-events-none"></div>
      )}
      
      {status === BotLockStatus.DECRYPTING && (
        <div className="absolute inset-0 bg-purple-900/10 animate-pulse pointer-events-none"></div>
      )}
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex-1">
          <h3 className="text-[10px] font-orbitron text-slate-500 uppercase tracking-[0.3em] mb-1">Body Lock Interface</h3>
          <div className={`text-lg font-bold font-orbitron tracking-[0.15em] flex items-center gap-3 ${status === BotLockStatus.OVERRIDE || status === BotLockStatus.DECRYPTING ? 'animate-pulse' : ''}`}>
            {status === BotLockStatus.OVERRIDE && <span className="text-red-500 drop-shadow-[0_0_8px_#ef4444]">⚠</span>}
            {status === BotLockStatus.DECRYPTING && <span className="text-purple-500 drop-shadow-[0_0_8px_#a855f7]">◈</span>}
            {status}
          </div>
        </div>

        {/* Circular Diagnostic Visual */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className={`absolute inset-0 border-2 rounded-full border-t-transparent animate-[spin_3s_linear_infinite] ${status === BotLockStatus.SCANNING ? 'duration-1000' : 'opacity-20'}`}></div>
          <div className={`w-8 h-8 rounded-full border border-dashed animate-[spin_10s_linear_infinite_reverse] ${status === BotLockStatus.LOCKED ? 'opacity-100' : 'opacity-20'}`}></div>
          <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${status === BotLockStatus.OVERRIDE ? 'bg-red-500' : 'bg-current'}`}></div>
        </div>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-6 gap-2 mb-6 relative z-10">
        {[BotLockStatus.UNLOCKED, BotLockStatus.SCANNING, BotLockStatus.LOCKED, BotLockStatus.OVERRIDE, BotLockStatus.DECRYPTING].map((s, idx) => {
          const isActive = status === s;
          const sTheme = s === BotLockStatus.OVERRIDE ? 'red' : s === BotLockStatus.LOCKED ? 'cyan' : s === BotLockStatus.SCANNING ? 'yellow' : s === BotLockStatus.DECRYPTING ? 'purple' : 'emerald';
          const isFullRow = idx < 3;
          
          return (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`py-2 rounded-lg text-[8px] font-orbitron font-bold transition-all border flex flex-col items-center justify-center gap-1 group relative overflow-hidden
                ${isFullRow ? 'col-span-2' : 'col-span-3'}
                ${isActive 
                  ? `bg-${sTheme}-500/20 border-${sTheme}-400 text-${sTheme}-100 shadow-[0_0_15px_rgba(var(--${sTheme}-rgb),0.3)]` 
                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                }`}
            >
              <span className="relative z-10 tracking-widest truncate w-full px-1 text-center">{s}</span>
              {isActive && <div className="absolute inset-0 bg-current opacity-[0.03] animate-pulse"></div>}
              <div className={`w-4 h-[1px] mt-1 transition-all ${isActive ? 'bg-current w-full opacity-50' : 'bg-transparent'}`}></div>
            </button>
          );
        })}
      </div>

      {/* Terminal Log */}
      <div className="bg-black/60 rounded-lg p-3 border border-slate-800/50 mb-4">
        <div className="text-[7px] text-slate-600 font-mono mb-2 flex justify-between items-center">
          <span>EVENT_LOG v2.4.1</span>
          <span className="animate-pulse">_</span>
        </div>
        <div className="space-y-1">
          {logs.map((log, i) => (
            <div key={i} className={`text-[8px] font-mono leading-none ${i === 0 ? 'text-slate-300' : 'text-slate-600'}`}>
              {log}
            </div>
          ))}
        </div>
      </div>
      
      {/* Sub-Diagnostics */}
      <div className="pt-3 border-t border-slate-800/50 grid grid-cols-3 gap-3 relative z-10">
        <div className="flex flex-col">
          <span className="text-[7px] text-slate-500 font-mono uppercase">O2_L_SYS</span>
          <span className={`text-[10px] font-bold ${status === BotLockStatus.OVERRIDE ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
            {status === BotLockStatus.OVERRIDE ? 'FLUX' : '98.2%'}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-slate-500 font-mono uppercase">BATT</span>
          <span className={`text-[10px] font-bold ${status === BotLockStatus.OVERRIDE ? 'text-red-500' : 'text-cyan-500'}`}>
            {status === BotLockStatus.OVERRIDE ? 'CRIT' : '74.0%'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[7px] text-slate-500 font-mono uppercase">L_SYNC</span>
          <span className={`text-[10px] font-bold ${status === BotLockStatus.OVERRIDE ? 'text-red-600' : 'text-green-500'}`}>
            {status === BotLockStatus.OVERRIDE ? 'FAIL' : 'OK'}
          </span>
        </div>
      </div>

      <style>{`
        :root {
          --cyan-rgb: 34, 211, 238;
          --yellow-rgb: 250, 204, 21;
          --red-rgb: 239, 68, 68;
          --emerald-rgb: 52, 211, 153;
          --purple-rgb: 168, 85, 247;
        }
        @keyframes criticalFlash {
          0%, 100% { border-color: rgba(220, 38, 38, 0.5); box-shadow: 0 0 15px rgba(220, 38, 38, 0.1); }
          50% { border-color: rgba(239, 68, 68, 1); box-shadow: 0 0 25px rgba(239, 68, 68, 0.4); }
        }
      `}</style>
    </div>
  );
};

export default BotInterface;