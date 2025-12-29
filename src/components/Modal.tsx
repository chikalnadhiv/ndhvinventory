"use client";

import { X, AlertTriangle, Info, CheckCircle, HelpCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: React.ReactNode;
  type?: 'info' | 'warning' | 'success' | 'confirm' | 'progress'; // Added progress type
  progress?: number; // Added progress percentage (0-100)
  confirmText?: string;
  cancelText?: string;
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  progress = 0,
  confirmText = 'OK',
  cancelText = 'Cancel'
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const icons = {
    info: <Info className="text-blue-400" size={32} />,
    warning: <AlertTriangle className="text-amber-400" size={32} />,
    success: <CheckCircle className="text-emerald-400" size={32} />,
    confirm: <HelpCircle className="text-purple-400" size={32} />,
    progress: <Loader2 className="text-blue-400 animate-spin" size={32} /> // Animated spinner
  };

  const colors = {
    info: "border-blue-500/20 bg-blue-500/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    success: "border-emerald-500/20 bg-emerald-500/5",
    confirm: "border-purple-500/20 bg-purple-500/5",
    progress: "border-blue-500/20 bg-blue-500/5"
  };

  const buttonColors = {
    info: "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20",
    warning: "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20",
    success: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20",
    confirm: "bg-purple-600 hover:bg-purple-500 shadow-purple-900/20",
    progress: "bg-slate-700 cursor-not-allowed opacity-50"
  };

  const isProgress = type === 'progress';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="w-full max-w-sm bg-slate-900/90 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
           <div className="flex justify-center mb-6">
              <div className={`p-4 rounded-2xl border ${colors[type]}`}>
                 {icons[type]}
              </div>
           </div>
           
           <h3 className="text-xl font-bold text-white text-center mb-2 tracking-tight">{title}</h3>
           <div className="text-slate-400 text-center text-sm font-medium leading-relaxed">{message}</div>

           {/* Progress Bar Animation */}
           {isProgress && (
             <div className="mt-6">
               <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                 <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
                 />
               </div>
               <div className="mt-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {Math.round(progress)}% {t('complete_label')}
               </div>
             </div>
           )}
        </div>

        {!isProgress && (
          <div className="flex p-4 gap-3 bg-white/[0.02] border-t border-white/5">
             {type === 'confirm' || onConfirm ? (
               <>
                 <button 
                   onClick={onClose}
                   className="flex-1 py-3.5 px-4 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all uppercase tracking-widest"
                 >
                   {cancelText}
                 </button>
                 <button 
                   onClick={() => {
                     onConfirm?.();
                     onClose();
                   }}
                   className={`flex-1 py-3.5 px-4 text-xs font-black text-white rounded-2xl transition-all active:scale-95 shadow-lg uppercase tracking-widest ${buttonColors[type]}`}
                 >
                   {confirmText}
                 </button>
               </>
             ) : (
               <button 
                 onClick={onClose}
                 className={`w-full py-4 px-4 text-xs font-black text-white rounded-2xl transition-all active:scale-95 shadow-lg uppercase tracking-widest ${buttonColors[type]}`}
               >
                 {confirmText}
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
