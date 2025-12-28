import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCcw, StopCircle, Zap } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
}

const BarcodeScanner = ({ onScanSuccess, onScanFailure }: BarcodeScannerProps) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);
  const isMountedRef = useRef(true);
  
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [isMirrored, setIsMirrored] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    const elementId = "reader";
    const html5QrCode = new Html5Qrcode(elementId, {
        verbose: false,
        formatsToSupport: [ 
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.EAN_8, 
            Html5QrcodeSupportedFormats.CODE_128, 
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR
        ]
    });
    html5QrCodeRef.current = html5QrCode;

    const init = async () => {
      try {
        // Try to start specifically with environment (back) camera first
        try {
          await performStart( { facingMode: "environment" });
        } catch (envErr) {
          // If environment camera fails, try to get anything available
          const devices = await Html5Qrcode.getCameras();
          if (isMountedRef.current && devices && devices.length > 0) {
            setCameras(devices);
            setSelectedCamera(devices[0].id);
            await performStart(devices[0].id);
          } else {
            throw new Error("No cameras found");
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setError("Camera Error: " + (err instanceof Error ? err.message : String(err)));
        console.error("Camera Init Error:", err);
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const lastResultRef = useRef<{text: string, time: number}>({ text: "", time: 0 });

  const performStart = async (cameraConfig: string | { facingMode: string }) => {
    if (!html5QrCodeRef.current || isTransitioningRef.current) return;
    
    isTransitioningRef.current = true;
    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdgePercentage = 0.7; // 70%
          const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
          return {
              width: qrboxSize,
              height: Math.floor(qrboxSize * 0.6) // Barcode-friendly ratio
          };
      };

      await html5QrCodeRef.current.start(
        cameraConfig,
        {
          fps: 30,
          qrbox: qrboxFunction,
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          const now = Date.now();
          // Avoid duplicate triggers within 2 seconds for same code
          if (decodedText === lastResultRef.current.text && (now - lastResultRef.current.time) < 2000) {
            return;
          }
          
          lastResultRef.current = { text: decodedText, time: now };
          
          // Visual feedback - flash the scanner box
          const box = document.querySelector('.scanner-box');
          if (box) {
            box.classList.add('scan-flash');
            setTimeout(() => box.classList.remove('scan-flash'), 500);
          }

          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          if (onScanFailure) onScanFailure(errorMessage);
        }
      );
      
      if (isMountedRef.current) {
        setCameraActive(true);
        setError(null);
        
        // Auto-detect if we should mirror (if it's a front camera)
        try {
            const videoTrack = (html5QrCodeRef.current as any)._videoTrack as MediaStreamTrack;
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                if (settings.deviceId) setSelectedCamera(settings.deviceId);
                
                // If facingMode is 'user' or the label contains 'front', enable mirroring
                const label = videoTrack.label.toLowerCase();
                const isFront = settings.facingMode === 'user' || label.includes('front') || label.includes('face');
                setIsMirrored(isFront);

                // Also refresh camera list
                Html5Qrcode.getCameras().then(devices => {
                    if (isMountedRef.current) setCameras(devices);
                });
            }
        } catch (e) {}
      }
    } catch (err) {
        throw err;
    } finally {
      isTransitioningRef.current = false;
    }
  };

  const startScanner = async (cameraConfig: string | { facingMode: string }) => {
    try {
        await performStart(cameraConfig);
    } catch (err) {
        if (isMountedRef.current) {
            setError("Failed to start camera: " + (err instanceof Error ? err.message : String(err)));
        }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      try {
        await html5QrCodeRef.current.stop();
        if (isMountedRef.current) {
          setCameraActive(false);
        }
      } catch (err) {
        console.error("Failed to stop scanner", err);
      } finally {
        isTransitioningRef.current = false;
      }
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1 || isTransitioningRef.current) return;
    
    const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex].id;
    
    setSelectedCamera(nextCamera);
    await performStart(nextCamera);
  };

  return (
    <div className={`relative w-full h-full min-h-[300px] flex flex-col items-center justify-center ${isMirrored ? 'mirror-camera' : ''}`}>
      {/* The actual scanner element */}
      <div id="reader" className="absolute inset-0 w-full h-full overflow-hidden"></div>

      {/* Modern Overlay UI */}
      {!cameraActive && !error && (
        <div className="z-10 flex flex-col items-center gap-4">
           <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
              <Camera className="text-slate-400" size={32} />
           </div>
           <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse text-center">Initializing Camera...</p>
        </div>
      )}

      {error && (
        <div className="z-10 p-6 glass-card bg-red-500/10 border border-red-500/20 rounded-3xl text-center max-w-[80%]">
           <StopCircle className="text-red-500 mx-auto mb-3" size={40} />
           <p className="text-red-400 font-bold text-sm mb-4">{error}</p>
           <button 
             onClick={() => {
                const element = document.getElementById('reader');
                if (element) element.innerHTML = '';
                Html5Qrcode.getCameras().then(devices => {
                  if (devices && devices.length > 0) {
                    setCameras(devices);
                    startScanner(devices[0].id);
                  }
                });
             }}
             className="px-6 py-2 bg-red-500 text-white rounded-xl text-xs font-bold uppercase"
           >
             Retry Permissions
           </button>
        </div>
      )}

      {cameraActive && (
        <>
          {/* Scanning Box Outline */}
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center unmirror-content">
             <div className="scanner-box relative w-[70%] aspect-[5/3] max-w-[400px] animate-in fade-in zoom-in-90 duration-700">
                <div className="absolute -inset-4 bg-blue-500/5 blur-2xl rounded-[40px]"></div>
                <div className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-blue-500 rounded-tl-[24px]"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-[3px] border-r-[3px] border-blue-500 rounded-tr-[24px]"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[3px] border-l-[3px] border-blue-500 rounded-bl-[24px]"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-blue-500 rounded-br-[24px]"></div>
                <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white/40 rounded-tl-[12px] translate-x-[-2px] translate-y-[-2px]"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white/40 rounded-tr-[12px] translate-x-[2px] translate-y-[-2px]"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white/40 rounded-bl-[12px] translate-x-[-2px] translate-y-[2px]"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white/40 rounded-br-[12px] translate-x-[2px] translate-y-[2px]"></div>
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_20px_rgba(59,130,246,1)] animate-scanner-line"></div>
             </div>
          </div>

          {/* Controls Overlay */}
          <div className="absolute bottom-0 inset-x-0 z-20 p-6 flex items-center justify-between pointer-events-none unmirror-content">
             <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest">
                   <Zap size={12} className="text-yellow-400" />
                   {isMirrored ? 'Front Camera' : 'Live Camera'}
                </div>
             </div>
             
             <div className="flex items-center gap-3">
               {cameras.length > 1 && (
                 <button 
                   onClick={(e) => { e.preventDefault(); switchCamera(); }}
                   className="pointer-events-auto w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-50"
                   disabled={isTransitioningRef.current}
                 >
                   <RefreshCcw size={20} className={isTransitioningRef.current ? 'animate-spin' : ''} />
                 </button>
               )}
             </div>
          </div>
        </>
      )}

      <style jsx global>{`
        #reader {
          border: none !important;
        }
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        .mirror-camera #reader video {
          transform: scaleX(-1);
        }
        /* Ensure overlay content doesn't get mirrored */
        .mirror-camera .unmirror-content {
           transform: none;
        }
        @keyframes scan-flash {
          0% { background-color: transparent; }
          50% { background-color: rgba(59, 130, 246, 0.4); }
          100% { background-color: transparent; }
        }
        .scan-flash {
          animation: scan-flash 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
