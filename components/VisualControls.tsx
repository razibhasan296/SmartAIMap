import React from 'react';
import { VisualStyle } from '../types';

interface VisualControlsProps {
  styles: VisualStyle[];
  selectedStyle: VisualStyle;
  onStyleSelect: (style: VisualStyle) => void;
  customPrompt: string;
  onPromptChange: (prompt: string) => void;
  onRegenerate: () => void;
  disabled: boolean;
}

const VisualControls: React.FC<VisualControlsProps> = ({
  styles,
  selectedStyle,
  onStyleSelect,
  customPrompt,
  onPromptChange,
  onRegenerate,
  disabled
}) => {
  return (
    <div className="absolute top-24 left-8 z-20 flex flex-col gap-3 group/controls">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-[var(--theme-primary)]/30 p-3 rounded-lg shadow-2xl transition-all duration-300 opacity-0 group-hover/controls:opacity-100 hover:opacity-100 -translate-x-4 group-hover/controls:translate-x-0">
        <div className="text-[10px] font-orbitron theme-text-primary mb-3 uppercase tracking-widest flex items-center justify-between">
          <span>#SYSTEM_THEME_ENGINE</span>
          <div className="w-1.5 h-1.5 theme-bg-primary rounded-full animate-ping"></div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Style Selector */}
          <div className="space-y-2">
            <div className="text-[8px] text-slate-500 uppercase font-mono">Select Visual Theme</div>
            <div className="grid grid-cols-2 gap-1.5">
              {styles.map(style => (
                <button
                  key={style}
                  onClick={() => onStyleSelect(style)}
                  disabled={disabled}
                  className={`px-2 py-1.5 rounded text-[8px] font-bold font-orbitron transition-all border ${
                    selectedStyle === style 
                      ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)] theme-text-primary shadow-[0_0_8px_var(--theme-accent-glow)]' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {style.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Override */}
          <div className="space-y-2">
            <div className="text-[8px] text-slate-500 uppercase font-mono">#OVERRIDE_SPECIFICS</div>
            <textarea
              value={customPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              disabled={disabled}
              placeholder="E.g. neon storms, overgrown ruins..."
              className="w-full bg-slate-950/50 border border-slate-700 rounded p-2 text-[10px] font-mono focus:outline-none focus:border-[var(--theme-primary)] min-h-[60px] resize-none text-slate-200 placeholder:text-slate-700"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={onRegenerate}
            disabled={disabled}
            className={`w-full py-2 rounded font-orbitron font-bold text-[10px] tracking-widest transition-all ${
              disabled 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                : 'bg-[var(--theme-primary)] hover:brightness-110 text-black shadow-[0_0_15px_var(--theme-accent-glow)] border-t border-white/20 active:scale-95'
            }`}
          >
            {disabled ? 'SYNCING...' : 'INITIATE RENDER'}
          </button>
        </div>
      </div>
      
      {/* Tab handle when collapsed */}
      <div className="bg-[var(--theme-primary)]/10 backdrop-blur-sm border border-[var(--theme-primary)]/30 p-2 rounded-lg theme-text-primary cursor-pointer flex items-center justify-center opacity-100 group-hover/controls:opacity-0 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 v2m0-6V4" />
        </svg>
      </div>
    </div>
  );
};

export default VisualControls;