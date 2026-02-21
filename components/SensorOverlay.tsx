import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { SensorData } from '../types';

interface SensorOverlayProps {
  data: SensorData;
}

const SensorOverlay: React.FC<SensorOverlayProps> = ({ data }) => {
  const chartData = [
    { subject: 'Temp', A: data.temperature, fullMark: 50 },
    { subject: 'Humid', A: data.humidity, fullMark: 100 },
    { subject: 'Press', A: data.pressure, fullMark: 1200 },
    { subject: 'Rad', A: data.radiation, fullMark: 10 },
    { subject: 'AI Sync', A: data.aiSync, fullMark: 100 },
    { subject: 'RAI', A: data.raiStability, fullMark: 1.0 },
  ];

  // Helper to determine status color based on stability value (0-1)
  const getStatusColor = (val: number) => {
    if (val >= 0.7) return 'text-emerald-400';
    if (val >= 0.4) return 'text-yellow-400';
    return 'text-red-500';
  };

  const getBarColor = (val: number) => {
    if (val >= 0.7) return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]';
    if (val >= 0.4) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]';
    return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  };

  const getStatusText = (val: number) => {
    if (val >= 0.7) return 'NOMINAL';
    if (val >= 0.4) return 'DEGRADED';
    return 'CRITICAL';
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-lg border border-slate-700 shadow-xl h-full flex flex-col">
      <h3 className="text-xs font-orbitron mb-4 text-cyan-400 uppercase tracking-widest flex justify-between">
        Environmental Sensors
        <span className="animate-pulse">● LIVE</span>
      </h3>
      
      <div className="flex-1 w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Radar
              name="Environment"
              dataKey="A"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase">Radiation</div>
          <div className={`text-sm font-bold ${data.radiation > 5 ? 'text-red-400' : 'text-slate-200'}`}>
            {data.radiation.toFixed(2)} mSv/h
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase flex justify-between items-center">
            <span>RAI Stability</span>
            <span className={`text-[7px] font-bold px-1 rounded bg-black/40 border border-white/10 ${getStatusColor(data.raiStability)}`}>
              {getStatusText(data.raiStability)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-sm font-bold ${getStatusColor(data.raiStability)}`}>
              {(data.raiStability * 100).toFixed(1)}%
            </div>
            {/* Visual Stability Bar */}
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5 relative">
              <div 
                className={`h-full transition-all duration-1000 ease-out ${getBarColor(data.raiStability)}`}
                style={{ width: `${data.raiStability * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensorOverlay;