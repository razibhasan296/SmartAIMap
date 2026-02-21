import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { chatWithGemini, generateHighResImage, generateVeoVideo } from '../services/geminiService';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'SMARTAIMAP AI Assistant online. How can I assist with your #RAI exploration today?', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Check for special commands
      if (input.toLowerCase().startsWith('/render ')) {
        const prompt = input.slice(8);
        const url = await generateHighResImage(prompt, '1K', '16:9');
        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `High-res render complete for: "${prompt}"`,
          timestamp: new Date().toLocaleTimeString(),
          media: { type: 'image', url }
        };
        setMessages(prev => [...prev, modelMsg]);
      } else if (input.toLowerCase().startsWith('/video ')) {
        const prompt = input.slice(7);
        const url = await generateVeoVideo(prompt, '16:9');
        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `Video generation complete for: "${prompt}"`,
          timestamp: new Date().toLocaleTimeString(),
          media: { type: 'video', url }
        };
        setMessages(prev => [...prev, modelMsg]);
      } else {
        const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));
        const response = await chatWithGemini(input, history);
        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, modelMsg]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Uplink error. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col z-[100] animate-[slideUp_0.3s_ease-out]">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
          <h3 className="text-xs font-orbitron font-bold text-cyan-400 uppercase tracking-widest">RAI_ASSISTANT</h3>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-xl text-xs font-mono leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-100' 
                : 'bg-slate-800/50 border border-slate-700 text-slate-300'
            }`}>
              {msg.text}
              {msg.media && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                  {msg.media.type === 'image' ? (
                    <img src={msg.media.url} alt="Render" className="w-full h-auto" />
                  ) : (
                    <video src={msg.media.url} controls className="w-full h-auto" />
                  )}
                </div>
              )}
            </div>
            <span className="text-[8px] text-slate-600 mt-1 uppercase">{msg.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950/40 rounded-b-2xl">
        <div className="relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask RAI or use /render, /video..." 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-all text-cyan-100"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="absolute right-2 top-1.5 p-1 text-cyan-500 hover:text-cyan-400 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex gap-2 text-[7px] text-slate-600 uppercase font-mono">
          <span>/render [prompt]</span>
          <span>/video [prompt]</span>
        </div>
      </form>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default ChatBot;
