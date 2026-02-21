import React, { useState } from 'react';
import { generateJsonFromPrompt } from '../services/geminiService';

interface PromptToJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SCHEMA = `{
  "type": "OBJECT",
  "properties": {
    "entities": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "name": { "type": "STRING" },
          "type": { "type": "STRING" },
          "confidence": { "type": "NUMBER" }
        }
      }
    }
  }
}`;

const PromptToJsonModal: React.FC<PromptToJsonModalProps> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExtract = async () => {
    if (!prompt.trim() || !schema.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult('');
    
    try {
      const jsonResult = await generateJsonFromPrompt(prompt, schema);
      // Format the result nicely
      try {
        const parsed = JSON.parse(jsonResult);
        setResult(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setResult(jsonResult);
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract JSON");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none">
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md pointer-events-auto cursor-default" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-5xl h-[80vh] bg-slate-900/90 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.2)] pointer-events-auto overflow-hidden flex flex-col animate-[scaleIn_0.3s_ease-out]">
        {/* Header */}
        <div className="h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-orbitron font-bold text-white tracking-widest">RAI DATA EXTRACTOR</h2>
              <div className="text-[9px] text-cyan-500 font-mono uppercase tracking-widest">Prompt to JSON Module</div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Inputs */}
          <div className="w-1/2 border-r border-slate-800 flex flex-col p-4 gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                Input Prompt
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter unstructured text, logs, or instructions..."
                className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none"
              />
            </div>
            
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                JSON Schema
              </label>
              <textarea 
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 resize-none"
              />
            </div>

            <button 
              onClick={handleExtract}
              disabled={loading || !prompt.trim() || !schema.trim()}
              className={`w-full py-3 rounded font-orbitron font-bold text-xs tracking-widest transition-all ${
                loading || !prompt.trim() || !schema.trim() 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]'
              }`}
            >
              {loading ? 'EXTRACTING DATA...' : 'INITIATE EXTRACTION'}
            </button>
          </div>

          {/* Right Panel: Output */}
          <div className="w-1/2 flex flex-col p-4 bg-slate-950/30">
            <label className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Structured Output
            </label>
            
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 overflow-auto relative group">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-cyan-500 gap-4">
                  <div className="w-12 h-12 border-2 border-cyan-500/20 rounded-full border-t-cyan-400 animate-spin"></div>
                  <div className="text-[10px] font-mono uppercase animate-pulse">Processing Schema...</div>
                </div>
              ) : error ? (
                <div className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                  [ERROR]: {error}
                </div>
              ) : result ? (
                <>
                  <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">
                    {result}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(result)}
                    className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs uppercase">
                  Awaiting Input...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptToJsonModal;
