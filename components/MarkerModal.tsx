import React, { useState } from 'react';
import { MarkerData } from '../types';
import { generateSpeech, complexReasoning } from '../services/geminiService';

interface MarkerModalProps {
  marker: MarkerData | null;
  onClose: () => void;
  onRestore?: (location: string) => void;
}

// Audio decoding helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const MarkerModal: React.FC<MarkerModalProps> = ({ marker, onClose, onRestore }) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingOutput, setThinkingOutput] = useState<string | null>(null);

  if (!marker) return null;

  const isHistory = marker.type === 'History';
  const isAnomaly = marker.type === 'Anomaly';

  const getTypeStyle = () => {
    switch (marker.type) {
      case 'Anomaly': return 'text-purple-400 border-purple-500/50 bg-purple-900/40 shadow-[0_0_20px_rgba(168,85,247,0.4)]';
      case 'History': return 'text-amber-400 border-amber-500/50 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      case 'Sensor': return 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10';
      default: return 'text-slate-300 border-slate-500/50 bg-slate-500/10';
    }
  };

  const handleRestoreAction = () => {
    if (isHistory && onRestore) {
      setIsRestoring(true);
      setTimeout(() => {
        const locationName = marker.label.replace(/^Echo:\s*/, '');
        onRestore(locationName);
        onClose();
        setIsRestoring(false);
      }, 800);
    }
  };

  const handleAnalyzeFurther = async () => {
    setIsProcessing(true);
    try {
      const result = await complexReasoning(`Explain the significance of this ${marker.type}: ${marker.label}. Context: ${marker.description}. Provide deep technical insight using thinking mode.`);
      setThinkingOutput(result);
    } catch (e) {
      console.error("Reasoning failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeakReport = async () => {
    try {
      const base64 = await generateSpeech(thinkingOutput || marker.description);
      if (base64) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const audioBuffer = await decodeAudioData(decode(base64), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (e) {
      console.error("TTS error", e);
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none">
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xl pointer-events-auto cursor-default transition-all duration-700" 
        onClick={onClose}
      ></div>
      
      <div className={`relative w-full max-w-2xl bg-slate-950/95 border-2 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.9)] pointer-events-auto overflow-hidden animate-[scaleIn_0.4s_cubic-bezier(0.16,1,0.3,1)] 
        ${isRestoring ? 'animate-pulse blur-sm scale-95' : ''}
        ${isAnomaly ? 'border-purple-600' : 'border-slate-800'}`}>
        
        {/* Holographic Top Bar */}
        <div className={`h-1.5 bg-gradient-to-r from-transparent ${isHistory ? 'via-amber-500' : isAnomaly ? 'via-purple-500' : 'via-cyan-500'} to-transparent relative`}>
          {(isRestoring || isAnomaly) && <div className="absolute inset-0 bg-white animate-ping opacity-30"></div>}
        </div>
        
        <div className="p-12">
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-orbitron font-bold uppercase mb-4 tracking-[0.2em] ${getTypeStyle()}`}>
                {isHistory ? '⏳ TEMPORAL_FRAGMENT' : isAnomaly ? '⚠️ ANOMALY_ALERT' : `📡 ${marker.type}_NODE`}
              </div>
              <h2 className="text-5xl font-orbitron font-bold text-white tracking-tighter uppercase chromatic-aberration">
                {marker.label}
              </h2>
              <div className="text-[10px] font-mono text-slate-500 mt-2 uppercase tracking-widest flex gap-4">
                <span>#SMARTAIMAP</span> <span>REF: RAI-{marker.id.slice(-6)}</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-all hover:rotate-90 duration-300 p-2 bg-slate-800/30 rounded-full border border-slate-700/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
            <div className="space-y-6">
              <div className={`border-l-4 ${isHistory ? 'border-amber-500' : isAnomaly ? 'border-purple-500' : 'border-cyan-500'} pl-6 py-2 bg-white/5 rounded-r-lg`}>
                <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Spatial L-Sync Coordinates</div>
                <div className="text-xl font-mono font-bold text-white">
                  {marker.x.toFixed(3)}° | {marker.y.toFixed(3)}°
                </div>
              </div>
              
              <div className="bg-black/60 rounded-2xl p-6 border border-slate-800 max-h-[250px] overflow-y-auto font-mono text-sm leading-relaxed text-slate-300">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                  <h4 className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">RAI System Codec Output</h4>
                  <button onClick={handleSpeakReport} className="text-[9px] text-cyan-400 hover:text-white uppercase font-bold tracking-tighter">🔊 Vocalize</button>
                </div>
                {thinkingOutput || marker.description}
                {isProcessing && <div className="mt-4 animate-pulse text-cyan-400">PROCESSING_COMPLEX_REASONING...</div>}
              </div>
            </div>
            
            <div className="space-y-6">
               <div className={`aspect-video rounded-3xl border-2 overflow-hidden bg-black flex items-center justify-center relative group transition-all duration-500 
                ${isHistory ? 'border-amber-500/40' : isAnomaly ? 'border-purple-500/40' : 'border-slate-800'}`}>
                {isHistory && marker.thumbnailUrl ? (
                  <img src={marker.thumbnailUrl} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900/50">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                       <span className="text-3xl">📍</span>
                    </div>
                    <span className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">No Visual Stream Data</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
                <div className="absolute bottom-4 left-6 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-[9px] font-mono text-white/80 uppercase">Rec: Sector_7G</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                    <div className="text-[8px] text-slate-500 uppercase font-mono mb-1">Signal Int.</div>
                    <div className="text-sm font-bold text-cyan-400 tracking-tighter">98.42% [OK]</div>
                 </div>
                 <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                    <div className="text-[8px] text-slate-500 uppercase font-mono mb-1">Data Jitter</div>
                    <div className="text-sm font-bold text-purple-400 tracking-tighter">0.12ms [SYNC]</div>
                 </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-10 border-t border-slate-800/50">
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest max-w-[250px] leading-relaxed">
              // CAUTION: DIRECT NEURAL UPLINK IN EFFECT // {isAnomaly ? 'CRITICAL ERROR IN SECTOR G9' : 'DATA INTEGRITY VERIFIED'} //
            </div>
            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 font-orbitron text-[11px] font-bold rounded-2xl border border-slate-800 transition-all uppercase tracking-widest"
              >
                Terminate
              </button>
              <button 
                onClick={isHistory ? handleRestoreAction : handleAnalyzeFurther}
                disabled={isProcessing}
                className={`px-10 py-4 font-orbitron text-[11px] font-bold rounded-2xl border-t transition-all uppercase tracking-[0.25em] flex items-center gap-3 active:scale-95 shadow-xl
                  ${isHistory ? 'bg-amber-600 hover:bg-amber-500 text-black border-amber-400' : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400'}`}
              >
                {isProcessing ? 'Thinking...' : isHistory ? 'Restore Timeline' : 'Thinking Scan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkerModal;