"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  ScanLine, 
  Package, 
  AlertTriangle,
  TrendingUp, 
  MoreVertical,
  LogOut,
  User as UserIcon,
  Settings,
  ClipboardList,
  BarChart3,
  X,
  Percent
} from "lucide-react";

import { exportToExcel, importFromExcel } from "../utils/excelHandler";
import { useInventory } from "../utils/useInventory";
import Modal from "../components/Modal";
import BarcodeScanner from "../components/BarcodeScanner";
import { useLanguage } from "../context/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

export default function Home() {
  const { data: session } = useSession();
  const { language, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { items, saveItems, saveItemsInBatches, isLoaded, refreshItems } = useInventory();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'confirm' | 'progress', 
    isOpen: boolean,
    progress?: number
  }>({
    title: '',
    message: '',
    type: 'info',
    isOpen: false,
    progress: 0
  });

  const isAdmin = (session?.user as any)?.role === "ADMIN";

  // Price Check State
  const [priceCheckCode, setPriceCheckCode] = useState("");
  const [priceCheckItem, setPriceCheckItem] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Auto-reset timer
  useEffect(() => {
    let timer: any;
    if (countdown !== null && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (countdown === 0) {
      setPriceCheckCode("");
      setPriceCheckItem(null);
      setCountdown(null);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handlePriceCheck = (code: string) => {
    const cleanCode = code.trim();
    
    if (!cleanCode) {
        setPriceCheckCode("");
        setPriceCheckItem(null);
        setCountdown(null);
        return;
    }

    setPriceCheckCode(cleanCode);

    const query = cleanCode.toLowerCase();
    
    // Normalize function to strip leading zeros for comparison
    const normalize = (val: string) => {
        const s = val.toLowerCase().trim().replace(/^0+/, '');
        return s || val.toLowerCase().trim(); // If after stripping zeros it's empty, return original trimmed
    };
    const normalizedQuery = normalize(query);

    const found = items.find(i => {
        const itemBarcode = (i.barcode || "").toLowerCase().trim();
        const itemKdBrg = (i.kd_brg || "").toLowerCase().trim();
        
        // Try exact match first
        if (itemBarcode === query || itemKdBrg === query) return true;
        
        // Try normalized match (strip leading zeros) as fallback
        if (normalize(itemBarcode) === normalizedQuery || normalize(itemKdBrg) === normalizedQuery) return true;
        
        return false;
    });

    if (found) {
        setPriceCheckItem(found);
        setCountdown(8); // Increased to 8 seconds for better readability
    } else {
        setPriceCheckItem(null);
        setCountdown(5); // Show "Not Found" for 5 seconds then clear
    }
  };

  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Stats
  const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.qty, 0), [items]);
  const totalValue = useMemo(() => items.reduce((acc, item) => acc + (item.hrg_beli * item.qty), 0), [items]);
  const lowStockCount = useMemo(() => items.filter(item => item.qty < item.qty_min).length, [items]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.nm_brg.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.kd_brg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.barcode && item.barcode.includes(searchQuery))
    );
  }, [items, searchQuery]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredItems, currentPage]);

  const handleExport = () => {
    exportToExcel(items, "inventory_data.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const importedItems = await importFromExcel(e.target.files[0]);
        console.log(`Importing ${importedItems.length} items...`);
        
        // Use batch import for large datasets (>1000 items)
        if (importedItems.length > 1000) {
          console.log('Using batch import for large dataset');
          
          // Show initial progress modal with spinner
          setAlertConfig({
            title: t('importing') || "Importing...",
            message: `Preparing to import ${importedItems.length.toLocaleString()} items...`,
            type: "progress",
            isOpen: true,
            progress: 0
          });
          
          // Track progress
          await saveItemsInBatches(importedItems, (current, total) => {
            const percentage = Math.round((current / total) * 100);
            setAlertConfig({
              title: t('importing') || "Importing...",
              message: current === 0 
                ? "Backing up images & Clearing database..." 
                : `Uploading batch ${current}/${total} (${percentage}%)`,
              type: "progress",
              isOpen: true,
              progress: percentage
            });
          });
          
        } else {
          // Use regular import for small datasets
          await saveItems(importedItems);
          await new Promise(resolve => setTimeout(resolve, 500));
          await refreshItems();
        }
        
        console.log('Import completed and data refreshed');
        
        setAlertConfig({
          title: t('import_success') || "Import Success",
          message: `Successfully imported ${importedItems.length.toLocaleString()} items!`,
          type: "success",
          isOpen: true
        });
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error("Import failed:", error);
        setAlertConfig({
          title: t('import_failed') || "Import Failed",
          message: error instanceof Error ? error.message : "Could not process the Excel file. Please check the format.",
          type: "warning",
          isOpen: true
        });
      }
    }
  };


  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen p-8 bg-slate-900 text-slate-100 font-sans selection:bg-purple-500/30">
        
        {/* Background Gradients */}
        <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[80px] -z-10 pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-pink-600/20 blur-[80px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col gap-8 mb-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
               {/* Logo Image */}
               <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                  <img 
                    src="/ndhvinventory.png" 
                    alt="ndhvInventory Logo" 
                    className="relative w-16 md:w-20 h-auto object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  />
               </div>
               
               <div>
                  <h1 className="text-xl md:text-3xl font-black tracking-tighter leading-none mb-0.5">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">ndhv</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-indigo-500 italic ml-px">Inventory</span>
                  </h1>
                  
                   <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400">
                      <span className="text-white font-bold tracking-tight">
                        {session?.user?.name || "User"}
                      </span>
                      <span className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-black tracking-widest uppercase text-slate-500 border border-white/5">
                        {(session?.user as any)?.role || "User"}
                      </span>
                   </div>
               </div>
            </div>

            <div className="flex items-center gap-2">
               <LanguageToggle />
               {(session?.user as any)?.role === "ADMIN" && (
                 <Link 
                   href="/settings/users"
                   className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                   title={t('users')}
                 >
                   <Settings size={20} />
                 </Link>
               )}
               <button 
                 onClick={() => setShowLogoutModal(true)}
                 className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all border border-white/5"
                 title={t('logout')}
               >
                 <LogOut size={20} />
               </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full">
             <Link 
               href="/stock-opname"
               className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white text-[11px] md:text-sm font-black transition-all shadow-lg shadow-blue-500/20 active:scale-95"
             >
               <ScanLine size={18} className="shrink-0" />
               <span className="whitespace-nowrap uppercase tracking-tighter">{t('stock_opname')}</span>
             </Link>
              {(session?.user as any)?.role === "ADMIN" && (
                <>
                  <Link 
                     href="/stock-opname/results"
                     className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white text-[11px] md:text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    <ClipboardList size={18} className="shrink-0" />
                    <span className="whitespace-nowrap uppercase tracking-tighter">{t('history')}</span>
                  </Link>
                  <Link 
                    href="/stock-opname/manage"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white text-[11px] md:text-sm font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    <BarChart3 size={18} className="shrink-0" />
                    <span className="whitespace-nowrap uppercase tracking-tighter">{t('management')}</span>
                  </Link>
                  <Link 
                    href="/inventory/manage"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-2xl text-white text-[11px] md:text-sm font-black transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Package size={18} className="shrink-0" />
                    <span className="whitespace-nowrap uppercase tracking-tighter">{t('master_item')}</span>
                  </Link>
                </>
              )}
          </div>
        </header>


        {/* Stats Grid or Price Check */}
        {(session?.user as any)?.role === "ADMIN" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10">
            {/* Stat 1 */}
            <div className="relative p-5 md:p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden group">
              <div className="absolute top-4 right-4 text-white/5 group-hover:text-white/10 transition-colors">
                <Package size={60} className="md:w-[80px] md:h-[80px]" />
              </div>
              <h3 className="text-[10px] md:text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">{t('total_items')}</h3>
              <p className="text-2xl md:text-4xl font-bold text-white tracking-tight">{totalItems}</p>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-green-400 mt-3 md:mt-4 font-medium">
                <TrendingUp size={14} /> 
                <span>{t('stock_level_healthy')}</span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="relative p-5 md:p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden group">
              <div className="absolute top-4 right-4 text-white/5 group-hover:text-white/10 transition-colors">
                <TrendingUp size={60} className="md:w-[80px] md:h-[80px]" />
              </div>
              <h3 className="text-[10px] md:text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">{t('stock_value')}</h3>
              <p className="text-2xl md:text-4xl font-bold text-white tracking-tight">{formatCurrency(totalValue)}</p>
              <div className="text-[10px] md:text-xs text-slate-500 mt-3 md:mt-4 font-medium">
                {t('purchase_price_value')}
              </div>
            </div>

            {/* Stat 3 */}
            <div className="relative p-5 md:p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden group col-span-1 sm:col-span-2 lg:col-span-1">
              <div className="absolute top-4 right-4 text-red-500/5 group-hover:text-red-500/10 transition-colors">
                <AlertTriangle size={60} className="md:w-[80px] md:h-[80px]" />
              </div>
              <h3 className="text-[10px] md:text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">{t('action_required')}</h3>
              <p className="text-2xl md:text-4xl font-bold text-red-400 tracking-tight">{lowStockCount}</p>
              <div className="text-[10px] md:text-xs text-red-300/60 mt-3 md:mt-4 font-medium">
                {t('below_threshold')}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-10 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
                      <ScanLine size={24} />
                  </div>
                  <div className="min-w-0">
                     <h2 className="text-xl font-bold text-white">{t('price_check')}</h2>
                     <p className="text-slate-400 text-sm truncate">{t('price_check_desc')}</p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsScannerOpen(!isScannerOpen)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isScannerOpen ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-red-500/5' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'}`}
                >
                  {isScannerOpen ? (
                    <>
                      <X size={16} className="md:w-[18px]" />
                      <span className="md:inline">{t('close')}</span>
                    </>
                  ) : (
                    <>
                      <ScanLine size={16} className="md:w-[18px]" />
                      <span>{t('camera')}</span>
                    </>
                  )}
                </button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  {isScannerOpen && (
                     <div className="relative aspect-square md:aspect-video max-h-[400px] bg-black/40 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5">
                        <BarcodeScanner 
                          onScanSuccess={(code) => {
                            handlePriceCheck(code);
                            // We no longer close the scanner automatically for better multi-scan experience
                            // setIsScannerOpen(false); 
                          }}
                        />
                     </div>
                  )}

                  <div className="relative">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 mb-2 block">{t('manual_entry_label')}</label>
                    <div className="relative group">
                      <input 
                          type="text"
                          value={priceCheckCode}
                          onChange={(e) => handlePriceCheck(e.target.value)}
                          placeholder={t('scan_placeholder')}
                          className="w-full bg-slate-900/50 border border-white/10 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500/50 transition-all font-mono text-lg placeholder:text-slate-700"
                          autoFocus
                          onBlur={(e) => {
                            if (!isScannerOpen) e.target.focus();
                          }}
                      />
                      {countdown !== null && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                           <div className="w-4 h-4 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                           <span className="text-blue-400 font-black text-[10px] tabular-nums">{countdown}s</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visual Guide for mobile users */}
                   <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                         <Package size={20} />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">{t('scanner_tip')}</p>
                   </div>
                </div>

                {/* Scan Results */}
                <div className="min-h-[200px]">
                  {!priceCheckItem && priceCheckCode && (
                    <div className="flex flex-col items-center justify-center p-12 bg-red-500/5 border border-red-500/10 rounded-[32px] animate-in fade-in zoom-in duration-300">
                      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <X className="text-red-500" size={32} />
                      </div>
                      <p className="text-red-400 font-bold mb-1 uppercase tracking-tighter">{t('item_not_found')}</p>
                      <p className="text-slate-600 text-xs text-center">{t('item_not_found_price', { code: priceCheckCode })}</p>
                    </div>
                  )}

                  {priceCheckItem ? (
                      <div className="bg-slate-900/50 rounded-[32px] p-6 md:p-8 border border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-8 text-blue-500/5 group-hover:text-blue-500/10 transition-colors pointer-events-none">
                           <TrendingUp size={120} />
                        </div>
                        
                        <div className="relative flex flex-col md:flex-row gap-8">
                           {/* Item Image with Premium Styling */}
                           <div className="w-full md:w-32 lg:w-48 aspect-square rounded-[24px] overflow-hidden flex items-center justify-center shrink-0 relative group/img shadow-xl border border-white/5">
                              {/* Base gradient background */}
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
                              
                              {/* Animated gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-blue-500/5 animate-pulse"></div>
                              
                              {/* Grid pattern overlay */}
                              <div className="absolute inset-0 opacity-[0.02]" style={{
                                backgroundImage: `
                                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                                `,
                                backgroundSize: '20px 20px'
                              }}></div>
                              
                              {/* Spotlight effect on hover */}
                              <div className="absolute inset-0 bg-gradient-radial from-blue-400/10 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-700"></div>
                              
                              {priceCheckItem.imageUrl ? (
                                <>
                                  {/* Glow effect behind image */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-2xl scale-95 opacity-0 group-hover/img:opacity-100 transition-opacity duration-700"></div>
                                  
                                  {/* Main image with black background removal - LARGER SCALE */}
                                  <img 
                                    src={priceCheckItem.imageUrl} 
                                    alt={priceCheckItem.nm_brg} 
                                    className="w-full h-full object-contain p-2 transition-transform duration-700 relative z-10 drop-shadow-2xl"
                                    style={{
                                      mixBlendMode: 'lighten',
                                      filter: 'contrast(1.1) brightness(1.05)',
                                      transform: 'scale(1.15)',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.25)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.15)';
                                    }}
                                  />
                                  
                                  {/* Bottom reflection effect */}
                                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-[5]"></div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center gap-3 relative z-10">
                                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700/50 via-slate-800/50 to-slate-700/50 flex items-center justify-center border border-white/5 shadow-xl relative overflow-hidden">
                                    {/* Animated shine effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/img:translate-x-full transition-transform duration-1000"></div>
                                    <Package size={40} className="text-slate-600 relative z-10" />
                                  </div>
                                  <div className="text-center">
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">No Image</span>
                                    <span className="text-[7px] text-slate-700 mt-1 block">Not Available</span>
                                  </div>
                                </div>
                              )}
                           </div>

                           <div className="flex-1 space-y-6">
                              <div>
                                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Item Identification</p>
                                 <h3 className="text-2xl md:text-3xl font-black text-white leading-tight uppercase tracking-tighter">{priceCheckItem.nm_brg}</h3>
                              </div>
                              
                              <div className="flex flex-wrap items-start gap-y-6 gap-x-12">
                                 <div className="min-w-max">
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Retail Price</p>
                                    <p className="text-3xl md:text-4xl font-black text-blue-400 tracking-tighter tabular-nums whitespace-nowrap leading-none">
                                      {formatCurrency(priceCheckItem.gol1)}
                                    </p>
                                 </div>
                                  <div className="min-w-0">
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Internal Stats</p>
                                    <div className="space-y-1">
                                       <p className="text-base md:text-lg font-mono font-bold text-slate-300 leading-none truncate">{priceCheckItem.barcode || 'No Barcode'}</p>
                                       <p className="text-[10px] font-mono text-slate-600 truncate">Stock: {priceCheckItem.qty} {priceCheckItem.satuan}</p>
                                    </div>
                                 </div>
                              </div>

                              <div className="pt-6 border-t border-white/5 flex items-center gap-2 flex-wrap">
                                 <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-widest border border-blue-500/20">{priceCheckItem.satuan}</span>
                                 <span className="px-3 py-1 rounded-lg bg-white/5 text-slate-500 text-[9px] font-bold uppercase tracking-widest border border-white/5">{priceCheckItem.golongan || 'General'}</span>
                                 <span className="px-3 py-1 rounded-lg bg-emerald-500/5 text-emerald-500/50 text-[9px] font-bold uppercase tracking-widest border border-emerald-500/10">{priceCheckItem.kd_brg}</span>
                              </div>
                           </div>
                        </div>
                      </div>
                   ) : !priceCheckCode && (
                      <div className="h-full flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-dashed border-white/10 rounded-[32px]">
                         <ScanLine size={48} className="text-slate-800 mb-4" />
                         <p className="text-slate-600 font-bold uppercase tracking-widest text-xs text-center">Menunggu scan untuk menampilkan data...</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}


        {/* Main Content */}
        {isAdmin && (
          <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl">
          
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
            <div className="relative w-full lg:w-[450px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder={t('search_inventory')} 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-all font-medium"
              />
            </div>

            <div className="flex gap-2 w-full lg:w-auto">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".xlsx, .xls" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-slate-300 bg-white/5 border border-white/10 rounded-xl hover:text-white hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest" 
              >
                <Upload size={16} />
                {t('import')}
              </button>
              <button 
                onClick={handleExport}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-slate-300 bg-white/5 border border-white/10 rounded-xl hover:text-white hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest" 
              >
                <Download size={16} />
                {t('export')}
              </button>
            </div>
          </div>


          {/* Table */}
          <div className="overflow-x-auto min-h-[500px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 md:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('item_th')}</th>
                  <th className="hidden md:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('spec_th')}</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">{t('price_th')}</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">{t('qty_th')}</th>
                  <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">{t('status_th')}</th>
                  <th className="px-4 md:px-6 py-4 w-10"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {currentItems.length > 0 ? (
                  currentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 md:px-6 py-4">
                         <div className="font-mono text-[9px] text-slate-600 mb-0.5">{item.kd_brg}</div>
                         <div className="text-xs md:text-sm font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight line-clamp-1">{item.nm_brg}</div>
                         <div className="hidden md:block text-[9px] text-slate-700 font-mono mt-0.5">{item.barcode}</div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center w-max px-1.5 py-0.5 text-[9px] font-black rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                            {item.golongan || t('misc')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-right font-semibold text-slate-300">{formatCurrency(item.gol1)}</td>
                      <td className="px-4 md:px-6 py-4 text-center">
                        <div className="text-xs md:text-sm font-bold text-white">{item.qty}</div>
                        <div className="text-[9px] text-slate-600 font-medium uppercase tracking-tighter">{item.satuan}</div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-center">
                        {item.qty < item.qty_min ? (
                          <div className="flex flex-col items-center">
                             <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
                               {t('low_status')}
                             </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">
                            {t('ok_status')}
                          </span>
                        )}
                      </td>

                      <td className="px-4 md:px-6 py-4 text-center">
                        <button className="text-slate-600 hover:text-white md:opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-white/5">
                          <MoreVertical size={16} />
                        </button>
                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-700">
                          <Package size={32} />
                        </div>
                         <div>
                           <p className="text-slate-400 font-medium">{t('no_data')}</p>
                           <p className="text-slate-600 text-sm mt-1">{t('import_prompt')}</p>
                         </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredItems.length > 0 && (
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {t('displaying_records', { 
                  start: ((currentPage - 1) * itemsPerPage) + 1, 
                  end: Math.min(currentPage * itemsPerPage, filteredItems.length), 
                  total: filteredItems.length 
                })}
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-wider"
                >
                   {t('prev')}
                 </button>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-purple-400">{currentPage}</span>
                  <span className="text-slate-700">/</span>
                  <span className="text-slate-400">{totalPages}</span>
                </div>
                 <button 
                   onClick={() => goToPage(currentPage + 1)}
                   disabled={currentPage === totalPages}
                   className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-wider"
                 >
                   {t('next')}
                 </button>
              </div>
            </div>
          )}

        </div>
       )}
      </div>

       <Modal 
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => signOut()}
        title={t('sign_out')}
        message={t('logout_confirm')}
        type="confirm"
        confirmText={t('exit_now')}
        cancelText={t('stay_here')}
      />

      <Modal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({...alertConfig, isOpen: false})}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>

  );
}
