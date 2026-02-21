import React, { useRef, useState } from 'react';

const CameraFeed: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const startCamera = async () => {
    setIsRequesting(true);
    setError(null);
    
    // Check for Secure Context (Required for getUserMedia in most browsers)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setError("INSECURE_CONTEXT");
      setIsRequesting(false);
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("UNSUPPORTED_HARDWARE");
      }

      // Explicitly request video with standard constraints
      // This is now strictly called by a user-initiated button click
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 360 },
          facingMode: "user"
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
        setError(null);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      
      const errorName = err.name || '';
      const errorMessage = err.message || '';
      
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorMessage.toLowerCase().includes('denied')) {
        setError("PERM_DENIED");
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setError("NO_HARDWARE");
      } else {
        setError("UPLINK_OFFLINE");
      }
      setIsActive(false);
    } finally {
      setIsRequesting(false);
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
    }
  };

  return (
    <div className="relative border border-slate-700 bg-slate-900/60 rounded-lg overflow-hidden aspect-video shadow-lg group">
      {isActive ? (
        <div className="relative w-full h-full overflow-hidden bg-[#020617]">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover filter grayscale contrast-125 brightness-90 sepia-[0.2] hue-rotate-[140deg] opacity-80 mix-blend-screen"
            style={{
              backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="absolute inset-0 backdrop-blur-[3px] pointer-events-none" style={{ maskImage: 'radial-gradient(circle at center, transparent 20%, black 85%)', WebkitMaskImage: 'radial-gradient(circle at center, transparent 20%, black 85%)' }}></div>
          
          <button 
            onClick={stopCamera}
            className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 hover:bg-red-500/40 border border-white/10 rounded text-[7px] font-orbitron text-white/50 hover:text-white transition-colors"
          >
            TERM_FEED
          </button>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-4 gap-3 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#22d3ee_1px,transparent_1px)] bg-[size:10px_10px]"></div>
          
          <div className={`text-[10px] font-orbitron mb-1 uppercase tracking-widest z-10 ${error === "PERM_DENIED" ? "text-red-500" : "text-cyan-500 animate-pulse"}`}>
            {error === "PERM_DENIED" ? "CRITICAL: OPTIC_ACCESS_DENIED" : (error ? `SYS_ERR: ${error}` : "VISOR_FEED_STANDBY")}
          </div>

          <div className="flex flex-col gap-3 items-center z-10">
            {error === "PERM_DENIED" ? (
              <div className="text-[8px] text-slate-400 font-mono leading-tight uppercase bg-black/60 p-2 rounded border border-red-500/20 max-w-[80%]">
                LENS BLOCK DETECTED. <br/>
                PLEASE CHECK BROWSER PERMISSIONS.
              </div>
            ) : (
              <div className="text-[8px] text-slate-400 font-mono leading-tight uppercase bg-black/20 p-2 rounded border border-cyan-500/10">
                USER GESTURE REQUIRED TO <br/>
                INITIALIZE OPTICAL STREAM.
              </div>
            )}
            
            <button 
              onClick={startCamera}
              disabled={isRequesting}
              className={`px-5 py-2 text-[9px] font-orbitron transition-all uppercase active:scale-95 shadow-lg border rounded-lg flex items-center gap-2
                ${error === "PERM_DENIED" 
                  ? "bg-red-500/20 hover:bg-red-500/40 border-red-500/50 text-red-400" 
                  : "bg-cyan-500/20 hover:bg-cyan-500/40 border-cyan-500/50 text-cyan-400"}
                ${isRequesting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isRequesting ? (
                <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
              ) : (
                <span className="text-xs">⚡</span>
              )}
              {isRequesting ? "Linking..." : "Initialize Visor"}
            </button>
          </div>
        </div>
      )}

      {/* HUD borders */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className={`absolute top-2 left-2 w-4 h-4 border-t border-l transition-colors duration-500 ${error ? 'border-red-500' : 'border-cyan-500/50'}`}></div>
        <div className={`absolute top-2 right-2 w-4 h-4 border-t border-r transition-colors duration-500 ${error ? 'border-red-500' : 'border-cyan-500/50'}`}></div>
        <div className={`absolute bottom-2 left-2 w-4 h-4 border-b border-l transition-colors duration-500 ${error ? 'border-red-500' : 'border-cyan-500/50'}`}></div>
        <div className={`absolute bottom-2 right-2 w-4 h-4 border-b border-r transition-colors duration-500 ${error ? 'border-red-500' : 'border-cyan-500/50'}`}></div>
      </div>
      
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
    </div>
  );
};

export default CameraFeed;