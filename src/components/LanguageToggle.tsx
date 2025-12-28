"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Languages } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner h-full">
      <button
        onClick={() => setLanguage('ID')}
        className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300 ${
          language === 'ID' 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        ID
      </button>
      <button
        onClick={() => setLanguage('EN')}
        className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300 ${
          language === 'EN' 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        EN
      </button>
    </div>
  );
}
