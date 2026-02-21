import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateLocationData, generate360View, analyzeVideo, transcribeAudio, generateSpeech, complexReasoning, processVoiceCommand, decryptClassifiedCode } from './services/geminiService';
import { LocationInfo, BotLockStatus, HistoryEntry, VisualStyle, MarkerData } from './types';
import BotInterface from './components/BotInterface';
import SensorOverlay from './components/SensorOverlay';
import VisualControls from './components/VisualControls';
import CameraFeed from './components/CameraFeed';
import AudioManager from './components/AudioManager';
import InteractiveMarker from './components/InteractiveMarker';
import MarkerModal from './components/MarkerModal';
import MarkerCluster from './components/MarkerCluster';
import PromptToJsonModal from './components/PromptToJsonModal';
import Codex from './components/Codex';
import ChatBot from './components/ChatBot';
import BodyLockOverlay from './components/BodyLockOverlay';
import DynamicEnvironmentOverlay from './components/DynamicEnvironmentOverlay';

const INITIAL_LOCATION = "Mars Terraforming Site Delta";
const VISUAL_STYLES: VisualStyle[] = ['Cinematic', 'Thermal', 'Night Vision', 'Cyberpunk', 'Deep Space', 'Post-Apocalyptic', 'Solar-Punk', 'Classified'];
const CLUSTER_THRESHOLD = 12;

interface Ripple {
  id: number;
  x: number;
  y: number;
}

const THEME_CONFIGS: Record<VisualStyle, { primary: string, secondary: string, accent: string, bg: string, glow: string }> = {
  'Cinematic': { primary: '#22d3ee', secondary: '#a855f7', accent: '#ec4899', bg: '#000000', glow: 'rgba(34, 211, 238, 0.4)' },
  'Thermal': { primary: '#ef4444', secondary: '#f97316', accent: '#fbbf24', bg: '#1a0505', glow: 'rgba(239, 68, 68, 0.4)' },
  'Night Vision': { primary: '#22c55e', secondary: '#15803d', accent: '#86efac', bg: '#050a05', glow: 'rgba(34, 197, 94, 0.4)' },
  'Cyberpunk': { primary: '#f472b6', secondary: '#22d3ee', accent: '#a855f7', bg: '#020617', glow: 'rgba(244, 114, 182, 0.4)' },
  'Deep Space': { primary: '#6366f1', secondary: '#3730a3', accent: '#22d3ee', bg: '#020617', glow: 'rgba(99, 102, 241, 0.4)' },
  'Post-Apocalyptic': { primary: '#b45309', secondary: '#4d7c0f', accent: '#78350f', bg: '#1c1917', glow: 'rgba(180, 83, 9, 0.4)' },
  'Solar-Punk': { primary: '#10b981', secondary: '#fbbf24', accent: '#6ee7b7', bg: '#064e3b', glow: 'rgba(16, 185, 129, 0.4)' },
  'Classified': { primary: '#ffffff', secondary: '#94a3b8', accent: '#ef4444', bg: '#0f172a', glow: 'rgba(255, 255, 255, 0.2)' },
};

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

const App: React.FC = () => {
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [lockStatus, setLockStatus] = useState<BotLockStatus>(BotLockStatus.UNLOCKED);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollPos, setScrollPos] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('Cinematic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAutoPanning, setIsAutoPanning] = useState(true);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true); 
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [showAROverlay, setShowAROverlay] = useState(true);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // System Update state
  const [isSystemUpdating, setIsSystemUpdating] = useState(true);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const config = THEME_CONFIGS[selectedStyle];
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', config.primary);
    root.style.setProperty('--theme-secondary', config.secondary);
    root.style.setProperty('--theme-accent', config.accent);
    root.style.setProperty('--theme-bg', config.bg);
    root.style.setProperty('--theme-accent-glow', config.glow);
  }, [selectedStyle]);

  // System Update Emulation
  useEffect(() => {
    const logs = [
      "INITIALIZING RAI CODEC v4.0.0...",
      "FETCHING #SMARTAIMAP KERNEL...",
      "UPLINKING #SMARTAIBOTBODYLOCK PROTOCOLS...",
      "CALIBRATING #ENVIRONMENT SENSORS...",
      "DECRYPTING WORLD MAPS GEODATA...",
      "RAI HANDSHAKE ESTABLISHED.",
      "READY FOR USER INPUT."
    ];
    
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < logs.length) {
        setUpdateLog(prev => [...prev, logs[currentStep]]);
        setUpdateProgress(((currentStep + 1) / logs.length) * 100);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => setIsSystemUpdating(false), 800);
      }
    }, 600);
    
    return () => clearInterval(interval);
  }, []);

  const fetchRaiData = useCallback(async (target: string, style: VisualStyle = 'Cinematic', customStr: string = '') => {
    setLoading(true);
    setQuotaExceeded(false);
    setLockStatus(BotLockStatus.SCANNING);
    setSelectedMarker(null); 
    
    try {
      let finalTarget = target;
      let finalStyle = style;
      let finalCustomStr = customStr;

      // Detect 16-character hex-like classified codes
      if (/^[0-9A-F]{16}$/i.test(target.trim())) {
        setLockStatus(BotLockStatus.DECRYPTING);
        const decrypted = await decryptClassifiedCode(target.trim());
        finalTarget = decrypted.locationName;
        finalStyle = decrypted.style as VisualStyle;
        finalCustomStr = decrypted.intel;
        setSelectedStyle(finalStyle);
      }

      const info = await generateLocationData(finalTarget);
      setLocationInfo(info);
      const fullPrompt = `${finalTarget} in a ${finalStyle} style. ${finalCustomStr}`;
      const view = await generate360View(fullPrompt);
      setViewUrl(view);
      setHistory(prev => [{ id: Date.now().toString(), location: info.name, timestamp: new Date().toLocaleTimeString(), imageUrl: view, style: finalStyle }, ...prev.slice(0, 19)]);
      setLockStatus(BotLockStatus.LOCKED);
    } catch (error: any) {
      console.error("RAI Access Denied:", error);
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('EXHAUSTED')) {
        setQuotaExceeded(true);
      }
      setLockStatus(BotLockStatus.OVERRIDE);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSpeak = async (text: string) => {
    if (!text) return;
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (e) {
      console.error("TTS failed", e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setLoading(true);
          try {
            const transcript = await transcribeAudio(base64);
            setSearchQuery(transcript);
            
            const command = await processVoiceCommand(transcript);
            console.log("Voice Command Interpreted:", command);
            
            if (command.action === 'NAVIGATE' && command.target) {
              fetchRaiData(command.target, selectedStyle);
            } else if (command.action === 'SELECT_MARKER' && command.target) {
              const marker = locationInfo?.markers.find(m => 
                m.label.toLowerCase().includes(command.target!.toLowerCase())
              );
              if (marker) {
                handleMarkerActivate(marker);
              }
            } else if (command.action === 'CHANGE_STYLE' && command.target) {
              const style = VISUAL_STYLES.find(s => 
                s.toLowerCase().includes(command.target!.toLowerCase())
              );
              if (style) {
                setSelectedStyle(style);
                if (locationInfo) {
                  fetchRaiData(locationInfo.name, style);
                }
              }
            }
          } catch (err) {
            console.error("Voice command processing failed", err);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Mic access denied", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setImageLoading(true);
      const analysis = await analyzeVideo(base64, file.type, "Analyze this surveillance video for geographical or system anomalies.");
      setVideoAnalysis(analysis);
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const regenerateImage = async () => {
    if (!locationInfo) return;
    setImageLoading(true);
    setQuotaExceeded(false);
    try {
      const fullPrompt = `${locationInfo.name} in a ${selectedStyle} style. ${customPrompt}`;
      const view = await generate360View(fullPrompt);
      setViewUrl(view);
      setHistory(prev => [{ id: Date.now().toString(), location: locationInfo.name, timestamp: new Date().toLocaleTimeString(), imageUrl: view, style: selectedStyle }, ...prev.slice(0, 19)]);
      setLockStatus(BotLockStatus.LOCKED);
    } catch (error: any) {
      console.error("RAI Visual Recalibration Failed:", error);
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('EXHAUSTED')) {
        setQuotaExceeded(true);
      }
      setLockStatus(BotLockStatus.OVERRIDE);
    } finally {
      setImageLoading(false);
    }
  };

  useEffect(() => {
    if (!isSystemUpdating && lockStatus === BotLockStatus.LOCKED) {
      fetchRaiData(INITIAL_LOCATION, selectedStyle);
    }
  }, [fetchRaiData, isSystemUpdating, lockStatus, selectedStyle]);

  useEffect(() => {
    if (!loading && viewUrl && isAutoPanning && !isHoverPaused) {
      const interval = setInterval(() => {
        setScrollPos(prev => (prev + 0.04) % 100);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [loading, viewUrl, isAutoPanning, isHoverPaused]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchRaiData(searchQuery, selectedStyle);
      setSearchQuery('');
    }
  };

  const getRandomLocation = () => {
    const locations = ["Deep Sea RAI Node", "Arctic Satellite Array", "Cyber-Sahara Solar Colony", "Bioluminescent Forest X-12", "Low Earth Orbit RAI Station", "Martian Terraforming Site"];
    const random = locations[Math.floor(Math.random() * locations.length)];
    fetchRaiData(random, selectedStyle);
  };

  const resetToHub = () => {
    fetchRaiData(INITIAL_LOCATION, 'Cinematic');
  };

  const nudgeScroll = (amount: number) => {
    setIsAutoPanning(false);
    setScrollPos(prev => {
      let next = (prev + amount) % 100;
      if (next < 0) next += 100;
      return next;
    });
  };

  const handleMarkerActivate = (marker: MarkerData) => {
    setSelectedMarker(marker);
    setIsAutoPanning(false); 
  };

  const handleRestoreTimeline = (locationName: string) => {
    fetchRaiData(locationName, selectedStyle);
  };

  const handleViewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const clusters = useMemo(() => {
    if (loading || imageLoading || history.length <= 1) return [];
    const historyMarkers: MarkerData[] = history.slice(1, 11).map((entry, idx) => ({
      id: entry.id,
      label: `Echo: ${entry.location}`,
      description: `Temporal fracture detected from RAI capture at ${entry.timestamp}. Restore this timeline to revisit coordinates.`,
      type: 'History',
      thumbnailUrl: entry.imageUrl,
      x: 10 + (idx * 25) % 80 + (Math.sin(idx) * 8), 
      y: 40 + (Math.cos(idx) * 20)
    }));
    const result: MarkerData[][] = [];
    const used = new Set<string>();
    historyMarkers.forEach((m1) => {
      if (used.has(m1.id)) return;
      const currentGroup = [m1];
      used.add(m1.id);
      historyMarkers.forEach((m2) => {
        if (used.has(m2.id)) return;
        const dist = Math.sqrt(Math.pow(m1.x - m2.x, 2) + Math.pow(m1.y - m2.y, 2));
        if (dist < CLUSTER_THRESHOLD) {
          currentGroup.push(m2);
          used.add(m2.id);
        }
      });
      result.push(currentGroup);
    });
    return result;
  }, [history, loading, imageLoading]);

  const isAtHub = locationInfo?.name.includes("World Map Hub") || locationInfo?.name === INITIAL_LOCATION;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#020617] text-slate-200">
      <div className="scanline"></div>
      
      {/* System Update / Initialization Overlay */}
      {isSystemUpdating && (
        <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col items-center justify-center p-10">
          <div className="w-full max-w-lg space-y-8">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4">
              <div className="flex flex-col">
                <h2 className="font-orbitron font-bold text-2xl text-cyan-400">RAI_CORE_INIT</h2>
                <span className="text-[10px] font-mono text-slate-500">System Handshake Protocol v4.0.0</span>
              </div>
              <div className="w-12 h-12 bg-cyan-500/10 rounded flex items-center justify-center border border-cyan-500/50">
                <span className="text-xl animate-spin-slow">🌍</span>
              </div>
            </div>
            
            <div className="bg-black/60 border border-slate-800 rounded-xl p-6 font-mono text-xs space-y-2 h-64 overflow-hidden">
              {updateLog.map((log, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={i === updateLog.length - 1 ? 'text-cyan-400' : 'text-slate-400'}>{log}</span>
                </div>
              ))}
              <div className="animate-pulse text-cyan-400 mt-4">_</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-orbitron font-bold text-slate-500 uppercase">
                <span>Installation Progress</span>
                <span className="text-cyan-400">{Math.round(updateProgress)}%</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-cyan-400 shadow-[0_0_15px_#22d3ee] transition-all duration-500" style={{ width: `${updateProgress}%` }}></div>
              </div>
            </div>
            
            <div className="flex justify-center gap-12 text-[8px] font-mono text-slate-700 uppercase tracking-widest">
              <span>#SMARTAIMAP</span>
              <span>#RAI</span>
              <span>#ENVIRONMENT</span>
            </div>
          </div>
        </div>
      )}

      {/* Spectacular Global Loading Indicator */}
      {!isSystemUpdating && (loading || imageLoading) && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#020617]/95 backdrop-blur-2xl pointer-events-auto">
          <div className="relative">
            <div className="w-48 h-48 border-8 border-cyan-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-t-8 border-cyan-400 rounded-full animate-spin"></div>
            <div className="absolute inset-6 border-b-8 border-purple-500 rounded-full animate-[spin_3s_linear_infinite_reverse]"></div>
            <div className="absolute inset-12 border-l-8 border-pink-500 rounded-full animate-[spin_1.5s_linear_infinite]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_20px_#22d3ee] animate-ping"></div>
            </div>
          </div>
          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="font-orbitron text-cyan-400 animate-pulse tracking-[0.6em] text-xl uppercase text-center font-bold chromatic-aberration">
              {lockStatus === BotLockStatus.DECRYPTING ? 'DECRYPTING CLASSIFIED CODE' : loading ? 'SYNCHRONIZING RAI CORE' : 'RECALIBRATING LENS ARRAY'}
            </div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-widest opacity-80 flex gap-4">
              <span>#SMARTAIMAP</span> <span>#RAI</span> <span>#SMARTAIBOTBODYLOCK</span> <span>#ENVIRONMENT</span>
            </div>
          </div>
        </div>
      )}

      {locationInfo && (
        <AudioManager profile={locationInfo.soundProfile} status={lockStatus} scrollPos={scrollPos} isMuted={isMuted} />
      )}

      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <button onClick={resetToHub} className="w-10 h-10 bg-cyan-500 rounded flex items-center justify-center font-orbitron font-bold text-black shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:scale-105 transition-transform" >
            <span className="text-xl">🌍</span>
          </button>
          <div className="group relative cursor-help">
            <h1 className="font-orbitron font-bold text-xl tracking-tighter text-cyan-400 uppercase transition-all duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_10px_#22d3ee]">
              SMART AI MAP
            </h1>
            <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] leading-none">#RAI_SMARTAIBOT_BODYLOCK</div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-4">
          <button onClick={resetToHub} className={`px-6 py-2 border rounded font-orbitron font-bold text-[10px] tracking-widest transition-all uppercase ${isAtHub ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400'}`} >
            WORLD_MAP_UPLINK
          </button>
          <form onSubmit={handleSearch} className="flex-1 max-w-md relative flex items-center">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Enter Target Location for #RAI Scan..." className="w-full bg-slate-800/30 border border-slate-700 rounded-lg px-5 py-2 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all text-cyan-100 placeholder:text-slate-600" />
            <div className="absolute right-3 flex items-center gap-2">
              <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} className={`text-slate-500 hover:text-cyan-400 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : ''}`} title="Voice Command">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </button>
              <button type="submit" className="text-slate-500 hover:text-cyan-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setIsJsonModalOpen(true)} className="p-2 rounded-full border border-purple-500/50 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-all shadow-[0_0_10px_rgba(168,85,247,0.2)]" title="Extract JSON from Prompt">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </button>
          
          <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-full border transition-all ${isMuted ? 'border-slate-700 text-slate-500 bg-slate-800/50' : 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10 shadow-[0_0_10px_rgba(34,211,238,0.2)]'}`} title={isMuted ? "Unmute Ambient" : "Mute Ambient"} >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          <button onClick={() => setIsCodexOpen(true)} className="p-2 rounded-full border border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]" title="Open Codex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>

          <button onClick={() => setIsChatOpen(true)} className="p-2 rounded-full border border-cyan-500/50 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all shadow-[0_0_10px_rgba(34,211,238,0.2)]" title="RAI Assistant">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          
          <button onClick={getRandomLocation} className="group relative bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded text-[10px] font-bold font-orbitron transition-all overflow-hidden" >
            <span className="relative z-10">RANDOM_ACCESS</span>
            <div className="absolute inset-0 bg-cyan-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
          </button>
        </div>
      </header>

      <PromptToJsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} />

      <main className="flex-1 flex overflow-hidden relative">
        <aside className="w-80 border-r border-slate-800 bg-slate-950/60 backdrop-blur-md p-4 flex flex-col gap-4 z-10 overflow-y-auto">
          <div className="space-y-2">
            <h4 className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest flex items-center justify-between px-1">
              <span>Visor Feedback</span>
              <span className="text-[8px] opacity-50">SYNC_ACTIVE</span>
            </h4>
            <CameraFeed />
          </div>

          {locationInfo && !quotaExceeded && <SensorOverlay data={locationInfo.sensorSummary} />}
          
          <BotInterface status={lockStatus} onStatusChange={(s) => {
            if (quotaExceeded && s !== BotLockStatus.OVERRIDE && s !== BotLockStatus.DECRYPTING) setQuotaExceeded(false);
            setLockStatus(s);
          }} />

          <div className={`border rounded-lg p-3 relative overflow-hidden transition-all duration-500 ${quotaExceeded ? 'bg-red-950/40 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'bg-slate-900/40 border-slate-800'}`}>
            <div className="flex justify-between items-center mb-2">
              <h4 className={`text-[10px] font-orbitron uppercase ${quotaExceeded ? 'text-red-500' : 'text-cyan-500/70'}`}>
                {quotaExceeded ? '#CORE_QUOTA_EXCEEDED' : '#ENVIRONMENT_INTEL'}
              </h4>
              {locationInfo && (
                <button onClick={() => handleSpeak(locationInfo.description)} className="text-[8px] text-cyan-400 hover:text-white uppercase font-bold tracking-tighter flex items-center gap-1">
                  <span>🔊 Listen</span>
                </button>
              )}
            </div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-800/50 rounded w-3/4"></div>
                <div className="h-3 bg-slate-800/50 rounded"></div>
              </div>
            ) : quotaExceeded ? (
              <div className="space-y-3">
                <div className="text-[11px] text-red-400 font-mono leading-relaxed">
                  CRITICAL: Gemini RAI CORE uplink limit reached (429). Please wait for thermal reset of the relay nodes.
                </div>
                <button onClick={() => fetchRaiData(locationInfo?.name || INITIAL_LOCATION)} className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-orbitron font-bold text-[9px] rounded shadow-[0_0_10px_rgba(220,38,38,0.4)] transition-all uppercase" >
                  Force Re-Handshake
                </button>
              </div>
            ) : locationInfo ? (
              <>
                <div className="text-white font-bold mb-1 font-orbitron text-sm tracking-wide">{locationInfo.name}</div>
                <div className="text-[10px] text-slate-500 mb-2 font-mono flex items-center gap-2">
                  <span className="theme-text-primary">POS:</span> {locationInfo.coordinates.lat.toFixed(4)}, {locationInfo.coordinates.lng.toFixed(4)}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400 mb-3 border-l theme-border-primary pl-2">
                  {locationInfo.description}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[9px] text-slate-500 uppercase">Threat:</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                    locationInfo.threatLevel === 'Low' ? 'border-green-500/50 text-green-400 bg-green-500/5' : 
                    locationInfo.threatLevel === 'Moderate' ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/5' : 
                    'border-red-500/50 text-red-400 bg-red-500/5'
                  }`}>
                    {locationInfo.threatLevel.toUpperCase()}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3">
             <h4 className="text-[10px] font-orbitron text-cyan-500/70 mb-2 uppercase">#SURVEILLANCE_UPLINK</h4>
             <input type="file" accept="video/*" onChange={handleVideoUpload} id="video-upload" className="hidden" />
             <label htmlFor="video-upload" className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron font-bold text-[9px] rounded border border-slate-700 transition-all uppercase cursor-pointer block text-center">
                Analyze Surveillance Video
             </label>
             {videoAnalysis && (
               <div className="mt-3 p-2 bg-black/40 border border-cyan-500/20 rounded">
                 <p className="text-[10px] font-mono text-cyan-100/80 leading-relaxed italic">{videoAnalysis}</p>
                 <button onClick={() => handleSpeak(videoAnalysis)} className="mt-2 text-[7px] text-cyan-400 uppercase font-bold tracking-widest">Read Back Analysis</button>
               </div>
             )}
          </div>
        </aside>

        <section className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
          <MarkerModal marker={selectedMarker} onClose={() => setSelectedMarker(null)} onRestore={handleRestoreTimeline} />
          
          {isAtHub && !loading && !imageLoading && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
              <div className="px-6 py-2 bg-white/10 border-2 border-white/50 backdrop-blur-3xl rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <span className="text-[14px] font-orbitron font-bold text-white tracking-[0.4em] uppercase block text-center chromatic-aberration">
                  #SMARTAIMAP #RAI #SMARTAIBOTBODYLOCK #ENVIRONMENT
                </span>
              </div>
              <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest animate-pulse font-bold">
                 Global Hub 360 Uplink: ACTIVE
              </div>
            </div>
          )}

          {viewUrl ? (
            <div 
              className="w-full h-full relative group cursor-crosshair overflow-hidden"
              onClick={handleViewClick}
            >
              {ripples.map(ripple => (
                <React.Fragment key={ripple.id}>
                  <div 
                    className="absolute rounded-full border-2 border-[var(--theme-primary)] pointer-events-none z-[45] animate-holographicRipple"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 20px var(--theme-primary), inset 0 0 10px var(--theme-primary)'
                    }}
                  />
                </React.Fragment>
              ))}

              <div 
                className="absolute inset-0 flex transition-transform duration-500 ease-out" 
                style={{ transform: `translateX(-${33.333 + (scrollPos / 3)}%)` }} 
              >
                <div className="flex h-full" style={{ width: '300%' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="relative h-full w-1/3">
                      <img 
                        src={viewUrl} 
                        alt={`360 Perspective ${i}`} 
                        className="h-full object-cover w-full brightness-110 contrast-110 pointer-events-none select-none image-pulse-vitals" 
                      />
                      
                      {showAROverlay && !loading && !imageLoading && !quotaExceeded && (
                        <div className="absolute inset-0 pointer-events-none z-30">
                          {isAtHub && <DynamicEnvironmentOverlay />}
                          {locationInfo?.markers.map((marker) => (
                            <InteractiveMarker 
                              key={`${i}-${marker.id}`} 
                              marker={marker} 
                              onActivate={handleMarkerActivate} 
                            />
                          ))}
                          {clusters.map((markerList, idx) => (
                            <MarkerCluster 
                              key={`${i}-cluster-${idx}`} 
                              clusterId={`${i}-cluster-${idx}`} 
                              markers={markerList} 
                              onMarkerActivate={handleMarkerActivate} 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-10 z-30 flex flex-col items-center gap-4 px-10 pointer-events-none group-hover:opacity-100 opacity-40 transition-opacity">
                <div className="flex items-center gap-4 pointer-events-auto bg-slate-950/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl shadow-2xl">
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowAROverlay(!showAROverlay); }} 
                    className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center gap-2 group/btn ${showAROverlay ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' : 'border-slate-700 text-slate-500 bg-slate-800/50'}`}
                    title={showAROverlay ? "Hide AR Elements" : "Show AR Elements"}
                  >
                    <span className="text-[9px] font-orbitron font-bold uppercase tracking-tighter">AR_Overlay</span>
                    <span className="text-xl block leading-none group-hover/btn:scale-110 transition-transform">{showAROverlay ? '👁️' : '🕶️'}</span>
                  </button>

                  <div className="w-[1px] h-8 bg-slate-800 mx-1"></div>

                  <button onClick={(e) => { e.stopPropagation(); nudgeScroll(-5); }} className="p-2 hover:bg-cyan-500/20 rounded-full theme-text-primary transition-all hover:scale-110" title="Pan Left" >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex flex-col items-center gap-1 w-64">
                    <input type="range" min="0" max="100" step="0.1" value={scrollPos} onClick={(e) => e.stopPropagation()} onChange={(e) => { setIsAutoPanning(false); setScrollPos(parseFloat(e.target.value)); }} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all" />
                    <div className="text-[8px] font-mono text-cyan-500/60 flex justify-between w-full uppercase tracking-tighter">
                      <span>0°</span> <span>180° [CENTER]</span> <span>360°</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); nudgeScroll(5); }} className="p-2 hover:bg-cyan-500/20 rounded-full theme-text-primary transition-all hover:scale-110" title="Pan Right" >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="h-8 w-px bg-slate-800 mx-2"></div>
                  <button onClick={(e) => { e.stopPropagation(); setIsAutoPanning(!isAutoPanning); }} className={`px-3 py-1 rounded border text-[8px] font-orbitron font-bold transition-all ${ isAutoPanning ? 'bg-cyan-500/20 border-cyan-400 theme-text-primary' : 'bg-slate-800 border-slate-700 text-slate-500 hover:theme-text-primary hover:border-cyan-400/50' }`} >
                    {isAutoPanning ? 'AUTOPAN_ON' : 'AUTOPAN_OFF'}
                  </button>
                </div>
              </div>

              <VisualControls styles={VISUAL_STYLES} selectedStyle={selectedStyle} onStyleSelect={setSelectedStyle} customPrompt={customPrompt} onPromptChange={setCustomPrompt} onRegenerate={regenerateImage} disabled={loading || imageLoading} />
              
              <div className="subtle-holographic-glow"></div>
              <div className="absolute inset-0 hologram-shimmer pointer-events-none z-10"></div>
              <div className="absolute inset-0 hologram-grid pointer-events-none z-5"></div>
              
              <div className="absolute top-8 left-8 p-4 border-l-2 border-cyan-400 bg-slate-950/60 text-[9px] font-mono uppercase space-y-1 z-20 backdrop-blur-sm">
                <div className="text-cyan-400 font-bold">LINK_FEED_ACTIVE</div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase tracking-tighter">Bodylock:</span>
                  <span className={`font-bold animate-pulse ${lockStatus === BotLockStatus.OVERRIDE ? 'text-red-500' : 'text-green-400'}`}>
                    {lockStatus === BotLockStatus.OVERRIDE ? (quotaExceeded ? 'QUOTA_LIMIT' : 'SYSTEM_FAIL') : 'ENGAGED'}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-8 right-8 p-4 border-r-2 border-purple-500 bg-slate-950/60 text-[9px] font-mono text-right uppercase space-y-1 z-20 backdrop-blur-sm">
                <div className="text-purple-400 font-bold tracking-widest">#RAI_SMARTAIBOT</div>
                <div>AZIMUTH: {(180 + (scrollPos * 3.6)).toFixed(1)}°</div>
                <div className={`transition-colors ${lockStatus === BotLockStatus.OVERRIDE ? 'text-red-400' : 'text-slate-400'}`}>
                  ENVIRONMENT_LOCK: {lockStatus === BotLockStatus.OVERRIDE ? 'BREACHED' : 'OPTIMAL'}
                </div>
                <div className="theme-text-primary uppercase tracking-tighter">Lens: {selectedStyle}</div>
              </div>
              
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none z-10 opacity-30"></div>
            </div>
          ) : (
            <div className="text-slate-800 font-orbitron text-2xl tracking-[1em] opacity-20 uppercase">Link_Offline</div>
          )}
        </section>

        <aside className="w-64 border-l border-slate-800 bg-slate-950/60 backdrop-blur-md p-4 z-10 overflow-y-auto">
          <h3 className="text-[10px] font-orbitron text-slate-500 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1 h-3 bg-cyan-500"></span> Access Logs
          </h3>
          <div className="space-y-4">
            {history.map(entry => (
              <div key={entry.id} className="group cursor-pointer" onClick={() => fetchRaiData(entry.location, entry.style as VisualStyle || 'Cinematic')} onMouseEnter={() => setIsHoverPaused(true)} onMouseLeave={() => setIsHoverPaused(false)} >
                <div className="relative aspect-video rounded overflow-hidden border border-slate-800 group-hover:border-cyan-500/50 transition-all duration-300">
                  <img src={entry.imageUrl} className="w-full h-full object-cover saturate-50 brightness-75 group-hover:saturate-100 group-hover:brightness-100 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
                  <div className="absolute bottom-1.5 left-2 text-[9px] font-bold text-white truncate w-[80%] font-orbitron">
                    {entry.location}
                  </div>
                  <div className="absolute top-1 right-2 text-[7px] theme-text-primary font-bold uppercase tracking-tighter">{entry.style}</div>
                </div>
                <div className="flex justify-between mt-1.5 px-1">
                  <span className="text-[8px] text-slate-500 font-mono">{entry.timestamp}</span>
                  <span className="text-[8px] theme-text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold">Restore</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      <footer className="h-10 border-t border-slate-800 bg-slate-950 flex items-center px-6 text-[9px] font-mono text-slate-500 gap-8">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full animate-pulse ${lockStatus === BotLockStatus.OVERRIDE ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : lockStatus === BotLockStatus.DECRYPTING ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' : 'bg-cyan-500 shadow-[0_0_8px_#22d3ee]'}`}></span>
          <span className={`font-bold ${lockStatus === BotLockStatus.OVERRIDE ? 'text-red-500' : lockStatus === BotLockStatus.DECRYPTING ? 'text-purple-400' : 'text-cyan-400'}`}>
            RAI_CORE: {quotaExceeded ? 'QUOTA_EXHAUSTED' : lockStatus === BotLockStatus.OVERRIDE ? 'CRITICAL_FAILURE' : lockStatus === BotLockStatus.DECRYPTING ? 'DECRYPTING' : 'STABLE'}
          </span>
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap uppercase tracking-widest opacity-60">
          <span className="inline-block animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused] cursor-default">
            // [LINK_STABLE] // INITIALIZING #RAI #SMARTAIBOTBODYLOCK #ENVIRONMENT PROTOCOLS // {quotaExceeded ? 'WARNING: RESOURCE QUOTA EXHAUSTED' : lockStatus === BotLockStatus.DECRYPTING ? 'DECRYPTING CLASSIFIED #RAI DATA // BYPASSING FIREWALLS' : 'UPLINK ACTIVE'} // LATITUDE: {locationInfo?.coordinates.lat.toFixed(2) || '0.00'} // LONGITUDE: {locationInfo?.coordinates.lng.toFixed(2) || '0.00'} //
          </span>
        </div>
      </footer>

      <Codex isOpen={isCodexOpen} onClose={() => setIsCodexOpen(false)} />
      <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <PromptToJsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} />
      
      <BodyLockOverlay 
        status={lockStatus} 
        onVerify={() => setLockStatus(BotLockStatus.LOCKED)} 
      />
    </div>
  );
};

export default App;