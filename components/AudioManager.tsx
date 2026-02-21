import React, { useEffect, useRef } from 'react';
import { BotLockStatus } from '../types';

interface AudioManagerProps {
  profile: 'Industrial' | 'Natural' | 'Void' | 'Electronic' | 'Hostile';
  status: BotLockStatus;
  scrollPos: number; // 0 to 100
  isMuted: boolean;
}

const AudioManager: React.FC<AudioManagerProps> = ({ profile, status, scrollPos, isMuted }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  
  // Ambient noise components
  const noiseNodeRef = useRef<ScriptProcessorNode | null>(null);
  const noiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  
  // Harmonic components (Drones)
  const oscBankRef = useRef<OscillatorNode[]>([]);
  const droneGainRef = useRef<GainNode | null>(null);
  const spatialPannerRef = useRef<StereoPannerNode | null>(null);
  
  // System components
  const alarmOscRef = useRef<OscillatorNode | null>(null);
  const alarmGainRef = useRef<GainNode | null>(null);
  
  // Spatial Effects
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const mainGain = ctx.createGain();
    mainGain.connect(ctx.destination);
    mainGain.gain.value = isMuted ? 0 : 0.4;
    mainGainRef.current = mainGain;

    // 0. Spatial Delay Effect
    const delay = ctx.createDelay(1.0);
    const delayGain = ctx.createGain();
    delay.delayTime.value = 0.4;
    delayGain.gain.value = 0.2;
    
    mainGain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(mainGain); // Feedback loop
    
    delayNodeRef.current = delay;
    delayGainRef.current = delayGain;

    // 1. Noise Generator Logic
    const bufferSize = 4096;
    const noiseNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    noiseNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    };
    
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(mainGain);
    
    noiseNodeRef.current = noiseNode;
    noiseFilterRef.current = noiseFilter;
    noiseGainRef.current = noiseGain;

    // 2. Drone / Spatial Bank
    const panner = ctx.createStereoPanner();
    panner.connect(mainGain);
    spatialPannerRef.current = panner;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.2;
    droneGain.connect(panner);
    droneGainRef.current = droneGain;

    const bank: OscillatorNode[] = [];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      
      lfo.frequency.value = 0.1 + Math.random() * 0.5;
      lfoGain.gain.value = 5 + Math.random() * 10;
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      osc.connect(droneGain);
      osc.start();
      lfo.start();
      bank.push(osc);
    }
    oscBankRef.current = bank;

    // 3. OVERRIDE Alarm
    const alarmOsc = ctx.createOscillator();
    const alarmGain = ctx.createGain();
    alarmOsc.type = 'sawtooth';
    alarmGain.gain.value = 0;
    alarmOsc.connect(alarmGain);
    alarmGain.connect(mainGain);
    alarmOsc.start();
    alarmOscRef.current = alarmOsc;
    alarmGainRef.current = alarmGain;

    return () => {
      ctx.close();
    };
  }, []);

  // Handle Muting
  useEffect(() => {
    if (mainGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      mainGainRef.current.gain.setTargetAtTime(isMuted ? 0 : 0.4, now, 0.1);
    }
  }, [isMuted]);

  // Handle Spatial Panning and Delay modulation
  useEffect(() => {
    if (spatialPannerRef.current && audioCtxRef.current && delayNodeRef.current) {
      const panValue = (scrollPos / 50) - 1; 
      const now = audioCtxRef.current.currentTime;
      spatialPannerRef.current.pan.setTargetAtTime(panValue, now, 0.1);
      
      // Modulate delay time slightly based on pan for "Doppler-like" effect
      const delayMod = 0.3 + (Math.abs(panValue) * 0.2);
      delayNodeRef.current.delayTime.setTargetAtTime(delayMod, now, 0.5);
    }
  }, [scrollPos]);

  // Handle status-based audio (Alarm, Decrypting, Locked)
  useEffect(() => {
    if (!audioCtxRef.current || !alarmGainRef.current || !alarmOscRef.current) return;

    const now = audioCtxRef.current.currentTime;
    if (status === BotLockStatus.OVERRIDE) {
      alarmGainRef.current.gain.setTargetAtTime(0.15, now, 0.1);
      const interval = setInterval(() => {
        if (!audioCtxRef.current || !alarmOscRef.current) return;
        const time = audioCtxRef.current.currentTime;
        alarmOscRef.current.frequency.setValueAtTime(880, time);
        alarmOscRef.current.frequency.exponentialRampToValueAtTime(440, time + 0.4);
      }, 1000);
      return () => clearInterval(interval);
    } else if (status === BotLockStatus.DECRYPTING) {
      alarmGainRef.current.gain.setTargetAtTime(0.08, now, 0.1);
      const interval = setInterval(() => {
        if (!audioCtxRef.current || !alarmOscRef.current) return;
        const time = audioCtxRef.current.currentTime;
        alarmOscRef.current.type = 'square';
        alarmOscRef.current.frequency.setValueAtTime(1000 + Math.random() * 3000, time);
      }, 50);
      return () => {
        clearInterval(interval);
        if (alarmOscRef.current) alarmOscRef.current.type = 'sawtooth';
      };
    } else if (status === BotLockStatus.LOCKED) {
      alarmGainRef.current.gain.setTargetAtTime(0.2, now, 0.05);
      alarmOscRef.current.type = 'sine';
      alarmOscRef.current.frequency.setValueAtTime(440, now);
      alarmOscRef.current.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
      alarmGainRef.current.gain.setTargetAtTime(0, now + 0.3, 0.1);
      setTimeout(() => {
        if (alarmOscRef.current) alarmOscRef.current.type = 'sawtooth';
      }, 400);
    } else {
      alarmGainRef.current.gain.setTargetAtTime(0, now, 0.2);
    }
  }, [status]);

  // Core Synthesis logic for Profiles
  useEffect(() => {
    if (!audioCtxRef.current || !noiseFilterRef.current || !noiseGainRef.current || oscBankRef.current.length < 4 || !droneGainRef.current) return;
    
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const filter = noiseFilterRef.current;
    const nGain = noiseGainRef.current;
    const bank = oscBankRef.current;
    const dGain = droneGainRef.current;

    // Reset defaults
    filter.Q.setTargetAtTime(1, now, 0.5);
    nGain.gain.setTargetAtTime(0.4, now, 0.5);
    dGain.gain.setTargetAtTime(0.2, now, 0.5);

    let profileInterval: any = null;

    switch (profile) {
      case 'Natural': 
        filter.type = 'lowpass';
        filter.frequency.setTargetAtTime(600, now, 0.5);
        nGain.gain.setTargetAtTime(0.7, now, 0.5);
        
        bank[0].type = 'sine'; bank[0].frequency.setTargetAtTime(110, now, 0.5);
        bank[1].type = 'sine'; bank[1].frequency.setTargetAtTime(165, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(55, now, 0.5);
        bank[3].type = 'sine'; bank[3].frequency.setTargetAtTime(220, now, 0.5);

        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          filter.frequency.exponentialRampToValueAtTime(300 + Math.random() * 1200, t + 2);
          nGain.gain.linearRampToValueAtTime(0.4 + Math.random() * 0.4, t + 2);
        }, 2500);
        break;

      case 'Industrial': 
        filter.type = 'bandpass';
        filter.frequency.setTargetAtTime(150, now, 0.5);
        filter.Q.setTargetAtTime(12, now, 0.5);
        nGain.gain.setTargetAtTime(0.2, now, 0.5);

        bank[0].type = 'square'; bank[0].frequency.setTargetAtTime(60, now, 0.5);
        bank[1].type = 'sawtooth'; bank[1].frequency.setTargetAtTime(120, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(180, now, 0.5);
        bank[3].type = 'triangle'; bank[3].frequency.setTargetAtTime(30, now, 0.5);
        
        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          dGain.gain.setTargetAtTime(0.1 + Math.random() * 0.2, t, 0.1);
          filter.frequency.setTargetAtTime(100 + Math.random() * 400, t, 0.5);
        }, 800);
        break;

      case 'Void': 
        filter.type = 'lowpass';
        filter.frequency.setTargetAtTime(80, now, 0.5);
        nGain.gain.setTargetAtTime(0.15, now, 0.5);

        bank[0].type = 'sine'; bank[0].frequency.setTargetAtTime(30, now, 0.5);
        bank[1].type = 'sine'; bank[1].frequency.setTargetAtTime(45, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(22.5, now, 0.5);
        bank[3].type = 'sine'; bank[3].frequency.setTargetAtTime(15, now, 0.5);
        
        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          dGain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.15, t + 4);
        }, 5000);
        break;

      case 'Electronic': 
        filter.type = 'highpass';
        filter.frequency.setTargetAtTime(4000, now, 0.5);
        nGain.gain.setTargetAtTime(0.5, now, 0.5);

        bank[0].type = 'sawtooth'; bank[0].frequency.setTargetAtTime(440, now, 0.5);
        bank[1].type = 'square'; bank[1].frequency.setTargetAtTime(1320, now, 0.5);
        bank[2].type = 'sine'; bank[2].frequency.setTargetAtTime(2640, now, 0.5);
        bank[3].type = 'triangle'; bank[3].frequency.setTargetAtTime(880, now, 0.5);

        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          if (Math.random() > 0.7) {
            const targetOsc = bank[Math.floor(Math.random() * 4)];
            const originalFreq = targetOsc.frequency.value;
            targetOsc.frequency.setValueAtTime(2000 + Math.random() * 8000, t);
            targetOsc.frequency.exponentialRampToValueAtTime(originalFreq, t + 0.1);
          }
        }, 300);
        break;

      case 'Hostile': 
        filter.type = 'notch';
        filter.frequency.setTargetAtTime(1500, now, 0.5);
        filter.Q.setTargetAtTime(10, now, 0.5);
        nGain.gain.setTargetAtTime(0.9, now, 0.5);

        bank[0].type = 'sawtooth'; bank[0].frequency.setTargetAtTime(40, now, 0.5);
        bank[1].type = 'sawtooth'; bank[1].frequency.setTargetAtTime(41, now, 0.5);
        bank[2].type = 'square'; bank[2].frequency.setTargetAtTime(20, now, 0.5);
        bank[3].type = 'sawtooth'; bank[3].frequency.setTargetAtTime(82, now, 0.5);

        profileInterval = setInterval(() => {
          const t = ctx.currentTime;
          bank.forEach(osc => {
            const current = osc.frequency.value;
            osc.frequency.setTargetAtTime(current + (Math.random() - 0.5) * 40, t, 0.02);
          });
          if (Math.random() > 0.9) {
            filter.frequency.setTargetAtTime(500 + Math.random() * 4000, t, 0.01);
          }
        }, 40);
        break;
    }

    return () => {
      if (profileInterval) clearInterval(profileInterval);
    };
  }, [profile]);

  return null;
};

export default AudioManager;