import React, { useState, useEffect } from 'react';
import { CodexEntry } from '../types';
import { getCodexEntries } from '../services/geminiService';

interface CodexProps {
  isOpen: boolean;
  onClose: () => void;
}

const Codex: React.FC<CodexProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry | null>(null);

  const fetchEntries = async (query: string) => {
    setLoading(true);
    try {
      const data = await getCodexEntries(query || "General Protocols");
      setEntries(data);
    } catch (error) {
      console.error("Failed to fetch codex entries:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries('');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEntries(searchQuery);
  };

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl pointer-events-auto" onClick={onClose}></div>
      <div className="relative w-full max-w-4xl h-[80vh] bg-slate-900/90 border-2 border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] pointer-events-auto overflow-hidden flex flex-col animate-[scaleIn_0.3s_ease-out]">
        {/* Header */}
        <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center text-white font-bold">📖</div>
            <div>
              <h2 className="text-xl font-orbitron font-bold text-white tracking-tight">SYSTEM_CODEX</h2>
              <div className="text-[8px] text-slate-500 uppercase tracking-widest">#RAI_KNOWLEDGE_BASE</div>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-8 relative">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Intelligence Database..." 
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-purple-500 transition-all text-purple-100"
            />
            <button type="submit" className="absolute right-3 top-2 text-slate-500 hover:text-purple-400">🔍</button>
          </form>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2">✕</button>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: Entry List */}
          <aside className="w-72 border-r border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-950/20">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-slate-800/50 rounded"></div>)}
              </div>
            ) : (
              entries.map(entry => (
                <button 
                  key={entry.id} 
                  onClick={() => setSelectedEntry(entry)}
                  className={`w-full text-left p-3 rounded border transition-all ${
                    selectedEntry?.id === entry.id 
                      ? 'bg-purple-500/20 border-purple-500 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                      : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[8px] uppercase font-mono mb-1 opacity-50">{entry.category}</div>
                  <div className="text-[10px] font-bold font-orbitron truncate">{entry.title}</div>
                </button>
              ))
            )}
          </aside>

          {/* Main: Entry Detail */}
          <main className="flex-1 overflow-y-auto p-8 bg-slate-900/20">
            {selectedEntry ? (
              <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="inline-block px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/50 text-[8px] font-bold text-purple-400 uppercase mb-2">
                      {selectedEntry.category}
                    </div>
                    <h3 className="text-3xl font-orbitron font-bold text-white">{selectedEntry.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] text-slate-500 uppercase font-mono">Last Updated</div>
                    <div className="text-[10px] text-slate-400 font-mono">{selectedEntry.lastUpdated}</div>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none">
                  <p className="text-slate-300 leading-relaxed font-mono text-sm whitespace-pre-line">
                    {selectedEntry.content}
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-800 flex flex-wrap gap-2">
                  {selectedEntry.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 rounded bg-slate-800 text-[8px] text-slate-400 font-mono uppercase">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <div className="text-6xl opacity-20">📖</div>
                <div className="text-xs font-orbitron uppercase tracking-widest">Select an entry to view intelligence</div>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center text-[8px] font-mono text-slate-500">
          <div>ACCESS_LEVEL: OMEGA</div>
          <div className="flex gap-4">
            <span>ENTRIES_LOADED: {entries.length}</span>
            <span className="text-purple-500 animate-pulse">SYSTEM_SYNC: ACTIVE</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Codex;
