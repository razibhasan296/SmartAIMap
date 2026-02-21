import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Bot {
  id: string;
  x: number;
  y: number;
  speed: number;
  angle: number;
  type: 'Scout' | 'Repair' | 'Data';
}

interface WeatherPattern {
  id: string;
  x: number;
  y: number;
  size: number;
  intensity: number;
}

const DynamicEnvironmentOverlay: React.FC = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [weather, setWeather] = useState<WeatherPattern[]>([]);

  // Initialize bots
  useEffect(() => {
    const initialBots: Bot[] = Array.from({ length: 8 }).map((_, i) => ({
      id: `bot-${i}`,
      x: Math.random() * 100,
      y: 30 + Math.random() * 40,
      speed: 0.05 + Math.random() * 0.1,
      angle: Math.random() * Math.PI * 2,
      type: ['Scout', 'Repair', 'Data'][Math.floor(Math.random() * 3)] as any,
    }));
    setBots(initialBots);

    const initialWeather: WeatherPattern[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `weather-${i}`,
      x: Math.random() * 100,
      y: 20 + Math.random() * 60,
      size: 15 + Math.random() * 20,
      intensity: 0.3 + Math.random() * 0.7,
    }));
    setWeather(initialWeather);
  }, []);

  // Animation loop for bots
  useEffect(() => {
    const interval = setInterval(() => {
      setBots(prev => prev.map(bot => {
        let newX = bot.x + Math.cos(bot.angle) * bot.speed;
        let newY = bot.y + Math.sin(bot.angle) * bot.speed;
        let newAngle = bot.angle;

        // Bounce off boundaries or wrap around
        if (newX < 0) newX = 100;
        if (newX > 100) newX = 0;
        if (newY < 20 || newY > 80) {
          newAngle = -bot.angle;
        }

        // Randomly change direction slightly
        if (Math.random() < 0.02) {
          newAngle += (Math.random() - 0.5) * 0.5;
        }

        return { ...bot, x: newX, y: newY, angle: newAngle };
      }));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {/* Weather Patterns */}
      <svg className="absolute inset-0 w-full h-full opacity-30">
        <defs>
          <filter id="weatherBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
          </filter>
        </defs>
        {weather.map(w => (
          <motion.circle
            key={w.id}
            cx={`${w.x}%`}
            cy={`${w.y}%`}
            r={`${w.size}%`}
            fill="url(#weatherGradient)"
            filter="url(#weatherBlur)"
            animate={{
              cx: [`${w.x}%`, `${(w.x + 5) % 100}%`, `${w.x}%`],
              opacity: [w.intensity * 0.5, w.intensity, w.intensity * 0.5],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
        <linearGradient id="weatherGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--theme-primary)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--theme-secondary)" stopOpacity="0.05" />
        </linearGradient>
      </svg>

      {/* Bot Activity */}
      {bots.map(bot => (
        <div
          key={bot.id}
          className="absolute transition-all duration-500 ease-linear"
          style={{
            left: `${bot.x}%`,
            top: `${bot.y}%`,
            transform: `translate(-50%, -50%) rotate(${bot.angle}rad)`,
          }}
        >
          <div className="relative group">
            {/* Bot Body */}
            <div className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center bg-slate-900/80 shadow-[0_0_10px_currentColor] ${
              bot.type === 'Scout' ? 'text-cyan-400 border-cyan-500/50' :
              bot.type === 'Repair' ? 'text-emerald-400 border-emerald-500/50' :
              'text-purple-400 border-purple-500/50'
            }`}>
              <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
            </div>
            
            {/* Bot Label (Visible on hover simulation or always small) */}
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[6px] font-mono text-white/40 uppercase tracking-tighter">
                #{bot.type}_{bot.id.split('-')[1]}
              </span>
            </div>

            {/* Trail Effect */}
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-gradient-to-r from-transparent to-current opacity-30"></div>
          </div>
        </div>
      ))}

      {/* Global Data Stream Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(34,211,238,0.1)_50%,transparent_100%)] bg-[length:200%_100%] animate-[dataStream_10s_linear_infinite]"></div>
      </div>

      <style>{`
        @keyframes dataStream {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

export default DynamicEnvironmentOverlay;
