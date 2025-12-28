"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  Search, 
  Download, 
  History, 
  Package, 
  CheckCircle, 
  X,
  Loader2,
  Trash2,
  Calendar,
  Users,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Filter,
  BarChart3,
  User,
  Layers,
  Clock,
  ClipboardList,
  Barcode,
  Bell,
  FileText
} from "lucide-react";
import { useStockOpname, StockOpnameRecord } from "@/utils/useStockOpname";
import * as XLSX from 'xlsx';
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

export default function StockOpnameManagePage() {
  const { data: session } = useSession();
  const { language, t } = useLanguage();
  const { records, isLoading, clearHistory, deleteRecord, refreshRecords } = useStockOpname();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("All Users");
  const [selectedDivision, setSelectedDivision] = useState("All Divisions");
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [previewedRack, setPreviewedRack] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'user' | 'division' | null>(null);
  
  // Notification State
  const [notifications, setNotifications] = useState<{id: string, message: string, user: string, item: string, rack: string, type?: 'VERIFIED' | 'CLOSED'}[]>([]);
  const lastKnownIdRef = useRef<string | null>(null);
  const lastKnownActivityIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const isActivityInitialLoadRef = useRef(true);

  const [alertConfig, setAlertConfig] = useState<{title: string, message: string, type: 'info' | 'success' | 'warning' | 'confirm', isOpen: boolean, onConfirm?: () => void}>({
    title: '',
    message: '',
    type: 'info',
    isOpen: false
  });

  // Extract unique users and racks for filters
  const uniqueUsers = useMemo(() => ["All Users", ...Array.from(new Set(records.map(r => r.userName)))], [records]);
  const uniqueDivisions = useMemo(() => ["All Divisions", ...Array.from(new Set(records.map(r => r.division)))].filter(Boolean) as string[], [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = r.nm_brg.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.kd_brg && r.kd_brg.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (r.barcode && r.barcode.includes(searchQuery)) ||
                          (r.rackNo && r.rackNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (r.userName && r.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (r.division && r.division.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesUser = selectedUser === "All Users" || r.userName === selectedUser;
      const matchesDivision = selectedDivision === "All Divisions" || r.division === selectedDivision;
      return matchesSearch && matchesUser && matchesDivision;
    });
  }, [records, searchQuery, selectedUser, selectedDivision]);

  const rackedRecords = useMemo(() => {
    const groups: Record<string, {
      rackNo: string;
      users: string[];
      itemsCount: number;
      totalDiff: number;
      totalValueDiff: number;
      lastUpdate: string;
      records: StockOpnameRecord[];
    }> = {};

    filteredRecords.forEach(r => {
      if (!groups[r.rackNo]) {
        groups[r.rackNo] = {
          rackNo: r.rackNo,
          users: [],
          itemsCount: 0,
          totalDiff: 0,
          totalValueDiff: 0,
          lastUpdate: r.createdAt || "",
          records: []
        };
      }
      const g = groups[r.rackNo];
      if (!g.users.includes(r.userName)) g.users.push(r.userName);
      g.itemsCount += 1;
      g.totalDiff += r.difference;
      g.totalValueDiff += (r.difference * r.hrg_beli);
      g.records.push(r);
      if (r.createdAt && (!g.lastUpdate || r.createdAt > g.lastUpdate)) {
        g.lastUpdate = r.createdAt;
      }
    });

    return Object.values(groups).sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate));
  }, [filteredRecords]);

  // 1. Initial ID setup for Stock Records
  useEffect(() => {
    if (!isLoading && records.length > 0 && isInitialLoadRef.current) {
      lastKnownIdRef.current = records[0].id || null;
      isInitialLoadRef.current = false;
    }
  }, [isLoading, records]);

  // 2. Initial ID setup for Activities (Independent of records)
  useEffect(() => {
    const initActivities = async () => {
      try {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            lastKnownActivityIdRef.current = data[0].id;
          }
          isActivityInitialLoadRef.current = false;
        }
      } catch(e) {
        // Silently fail during init, the poll loop will take over
      }
    };
    initActivities();
  }, []);

  // 3. Polling for Live Updates (Records & Activities)
  useEffect(() => {
    if (isLoading) return;

    const pollInterval = setInterval(async () => {
      try {
        // Poll for Stock Records - Always update table, notify if not initial
        const response = await fetch('/api/stock-opname');
        if (response.ok) {
          const latestRecords: StockOpnameRecord[] = await response.json();
          if (latestRecords.length > 0) {
            const newestRecord = latestRecords[0];
            if (newestRecord.id !== lastKnownIdRef.current) {
              lastKnownIdRef.current = newestRecord.id || null;
              refreshRecords(); 
            }
          }
        }

        // Poll for Activities (Session Closed etc)
        const actResponse = await fetch('/api/activities');
        if (actResponse.ok) {
          const latestActivities = await actResponse.json();
          if (latestActivities.length > 0) {
            const newestActivity = latestActivities[0];
            
            // If not initialized yet, initialize now with the latest ID
            if (isActivityInitialLoadRef.current) {
              lastKnownActivityIdRef.current = newestActivity.id;
              isActivityInitialLoadRef.current = false;
            } else if (newestActivity.id !== lastKnownActivityIdRef.current) {
              // Only show notification if it's a NEW activity
              const newActs = latestActivities.filter((a: any) => a.id !== lastKnownActivityIdRef.current);
              if (newActs.length > 0) {
                const latest = newActs[0];
                if (latest.type === 'SESSION_CLOSED') {
                  const newNotif = {
                    id: `act-${Date.now()}`,
                    message: t('session_complete'),
                    user: latest.user,
                    item: "SESSION CLOSED",
                    rack: latest.rack,
                    type: 'CLOSED' as const
                  };
                  setNotifications(prev => [newNotif, ...prev].slice(0, 3));
                  try { new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3').play(); } catch(e) {}
                  refreshRecords();
                }
              }
              lastKnownActivityIdRef.current = newestActivity.id || null;
            }
          }
        }
      } catch (err) {
        // Only log if it's not a standard fetch failure (e.g. during dev restart)
        if (err instanceof Error && err.name !== 'TypeError') {
          console.error("Polling error:", err);
        }
      }
    }, 3000); // Polling faster for real-time feel

    return () => clearInterval(pollInterval);
  }, [isLoading]); 

  // Statistics
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const surplus = filteredRecords.filter(r => r.difference > 0).length;
    const shortage = filteredRecords.filter(r => r.difference < 0).length;
    const matched = filteredRecords.filter(r => r.difference === 0).length;
    const totalValue = filteredRecords.reduce((acc, r) => acc + (r.physicalQty * r.hrg_beli), 0);
    const diffValue = filteredRecords.reduce((acc, r) => acc + (r.difference * r.hrg_beli), 0);

    return { total, surplus, shortage, matched, totalValue, diffValue };
  }, [filteredRecords]);

  const handleExport = () => {
    if (filteredRecords.length === 0) return;
    
    const exportData = filteredRecords.map((r: StockOpnameRecord) => ({
      'Item': r.nm_brg,
      'Item code': r.kd_brg || '',
      'Barcode': r.barcode || '',
      'Unit of measure': r.satuan || '',
      'Stock': r.physicalQty,
      'Price': r.hrg_beli,
      'Note': r.rackNo || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Opname Results");
    XLSX.writeFile(wb, `StockOpname_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportRack = (rackNo: string) => {
    const rackRecords = records.filter(r => r.rackNo === rackNo);
    if (rackRecords.length === 0) return;

    const exportData = rackRecords.map((r: StockOpnameRecord) => ({
      'Item': r.nm_brg,
      'Item code': r.kd_brg || '',
      'Barcode': r.barcode || '',
      'Unit of measure': r.satuan || '',
      'Stock': r.physicalQty,
      'Price': r.hrg_beli,
      'Note': ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${rackNo}`);
    XLSX.writeFile(wb, `${rackNo}.xlsx`);
  };

  const handleExportTxt = () => {
    if (filteredRecords.length === 0) return;
    
    // Group by barcode/kd_brg and sum quantities
    const grouped = filteredRecords.reduce((acc: Record<string, number>, r) => {
      const key = r.barcode || r.kd_brg || 'no-barcode';
      acc[key] = (acc[key] || 0) + r.physicalQty;
      return acc;
    }, {});

    const content = Object.entries(grouped)
      .map(([barcode, qty]) => `${barcode},${qty}`)
      .join('\r\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StockOpname_Export_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportRackTxt = (rackNo: string) => {
    const rackRecords = records.filter(r => r.rackNo === rackNo);
    if (rackRecords.length === 0) return;

    // Group by barcode/kd_brg and sum quantities
    const grouped = rackRecords.reduce((acc: Record<string, number>, r) => {
      const key = r.barcode || r.kd_brg || 'no-barcode';
      acc[key] = (acc[key] || 0) + r.physicalQty;
      return acc;
    }, {});

    const content = Object.entries(grouped)
      .map(([barcode, qty]) => `${barcode},${qty}`)
      .join('\r\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rackNo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin && session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <X size={64} className="text-red-500 mb-6" />
        <h1 className="text-3xl font-black text-white mb-2">{t('access_denied')}</h1>
        <p className="text-slate-500 max-w-md">{t('no_permission')}</p>
        <Link href="/" className="mt-8 px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all">
          {t('return_to_home')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans p-4 md:p-8">
      {/* Dynamic Background */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/5 blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/5 blur-[120px] -z-10" />

      {/* Real-time Notifications Toast */}
      <div className="fixed top-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
        {notifications.map((notif) => (
             <div className={`flex gap-4 p-5 rounded-[28px] border backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-12 fade-in duration-500 pointer-events-auto ${notif.type === 'CLOSED' ? 'bg-indigo-900/90 border-indigo-500/30' : 'bg-slate-900/90 border-blue-500/30'}`}
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
             >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${notif.type === 'CLOSED' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'}`}>
                   <Bell size={24} className={notif.type === 'CLOSED' ? '' : 'animate-bounce'} />
                </div>
                <div className="min-w-0">
                   <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${notif.type === 'CLOSED' ? 'text-indigo-400' : 'text-blue-500'}`}>
                        {notif.type === 'CLOSED' ? t('session_complete') : t('live_update')}
                      </span>
                      <button className="text-slate-600 hover:text-white" onClick={(e) => { e.stopPropagation(); setNotifications(prev => prev.filter(n => n.id !== notif.id)); }}><X size={14} /></button>
                   </div>
                   <h4 className="text-xs font-black text-white uppercase truncate">{notif.item}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      <span className={`${notif.type === 'CLOSED' ? 'text-indigo-300' : 'text-blue-400'} font-bold`}>{notif.user}</span> 
                      {notif.type === 'CLOSED' ? ` ${t('completed')} ` : ` ${t('verified_on')} `}
                      <span className="text-white font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{notif.rack}</span>
                    </p>
                </div>
             </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <header className="flex flex-col xl:flex-row items-center justify-between mb-8 gap-8">
          <div className="flex flex-col md:flex-row items-center gap-5 w-full md:w-auto">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <Link 
                href="/"
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 group shrink-0"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </Link>
              
              <div className="flex items-center gap-3">
                 <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <img 
                      src="/ndhvinventory.png" 
                      alt="ndhvInventory Logo" 
                      className="relative w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    />
                 </div>
                 <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[8px] font-black text-blue-400 uppercase tracking-widest">Admin</span>
                      <h1 className="text-xl md:text-3xl font-black tracking-tighter italic leading-none">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">ndhv</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-indigo-500">Inventory</span>
                      </h1>
                    </div>
                    <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                       Opname Management
                    </p>
                 </div>
              </div>
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <LanguageToggle />
              <div className="hidden sm:flex p-1 bg-white/5 border border-white/10 rounded-2xl">
                <button 
                   onClick={() => setViewMode('list')}
                   className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   <LayoutGrid size={14} />
                   {t('list_view')}
                </button>
                <button 
                   onClick={() => setViewMode('stats')}
                   className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'stats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   <BarChart3 size={14} />
                   {t('stats_view')}
                </button>
              </div>
             
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleExport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20 active:scale-[0.98]"
                  title="Export Excel"
                >
                  <Download size={18} />
                  Excel
                </button>
                <button 
                  onClick={handleExportTxt}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98]"
                  title="Export TXT (barcode,qty)"
                >
                  <FileText size={18} />
                  TXT
                </button>
              </div>
          </div>
        </header>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl -translate-y-12 translate-x-12" />
            <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/10">
                 <CheckCircle size={20} />
               </div>
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('progress')}</span>
            </div>
            <p className="text-3xl font-black text-white">{stats.total}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{t('verified_skus')}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-3xl -translate-y-12 translate-x-12" />
             <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/10">
                 <TrendingUp size={20} />
               </div>
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('discrepancy')}</span>
            </div>
            <p className="text-3xl font-black text-emerald-400">+{stats.surplus}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{t('surplus_items')}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-3xl -translate-y-12 translate-x-12" />
             <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-red-500/10 rounded-2xl text-red-400 border border-red-500/10">
                 <TrendingDown size={20} />
               </div>
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('discrepancy')}</span>
            </div>
            <p className="text-3xl font-black text-red-400">-{stats.shortage}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{t('shortage_items')}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-3xl -translate-y-12 translate-x-12" />
             <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 border border-purple-500/10">
                 <Users size={20} />
               </div>
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('team')}</span>
            </div>
            <p className="text-3xl font-black text-white">{uniqueUsers.length - 1}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{t('active_personnel')}</p>
          </div>
        </div>

        {/* Dashboard Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            <div className="lg:col-span-12 flex flex-col md:flex-row gap-4 items-end">
               <div className="flex-1 w-full relative group">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder={t('search_placeholder')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/40 transition-all font-bold text-sm shadow-2xl"
                  />
               </div>
               
               <div className="flex gap-4 w-full md:w-auto">
                 {/* Custom User Dropdown */}
                  <div className="flex-1 md:min-w-[200px] relative group/select">
                    <div className="absolute -top-2 left-4 px-2 bg-[#070b14] text-[9px] font-black text-slate-600 uppercase tracking-widest z-10 group-focus-within/select:text-blue-500 transition-colors">{t('filter_by_user')}</div>
                   <button 
                     onClick={() => setActiveDropdown(activeDropdown === 'user' ? null : 'user')}
                     className={`w-full bg-white/[0.03] border rounded-2xl pl-12 pr-10 py-4 text-xs font-black text-left transition-all flex items-center justify-between ${activeDropdown === 'user' ? 'border-blue-500/50 bg-white/[0.07] text-white' : 'border-white/10 text-slate-300 hover:bg-white/[0.05]'}`}
                   >
                     <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${activeDropdown === 'user' ? 'text-blue-500' : 'text-slate-600'}`} size={16} />
                     <span className="truncate">{selectedUser}</span>
                     <ChevronRight size={14} className={`text-slate-600 transition-transform duration-300 ${activeDropdown === 'user' ? '-rotate-90 text-blue-500' : 'rotate-90'}`} />
                   </button>
                   
                   {activeDropdown === 'user' && (
                     <>
                       <div className="fixed inset-0 z-20" onClick={() => setActiveDropdown(null)} />
                       <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#0d131f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                         <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                           {uniqueUsers.map(user => (
                             <button
                               key={user}
                               onClick={() => {
                                 setSelectedUser(user);
                                 setActiveDropdown(null);
                               }}
                               className={`w-full px-5 py-3.5 text-left text-[11px] font-bold transition-all border-b border-white/[0.03] last:border-0 hover:bg-blue-600/10 flex items-center justify-between group/item ${selectedUser === user ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
                             >
                               {user}
                               {selectedUser === user && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
                             </button>
                           ))}
                         </div>
                       </div>
                     </>
                   )}
                 </div>

                  {/* Custom Division Dropdown */}
                  <div className="flex-1 md:min-w-[200px] relative group/select">
                    <div className="absolute -top-2 left-4 px-2 bg-[#070b14] text-[9px] font-black text-slate-600 uppercase tracking-widest z-10 group-focus-within/select:text-emerald-500 transition-colors">{t('filter_by_division')}</div>
                   <button 
                     onClick={() => setActiveDropdown(activeDropdown === 'division' ? null : 'division')}
                     className={`w-full bg-white/[0.03] border rounded-2xl pl-12 pr-10 py-4 text-xs font-black text-left transition-all flex items-center justify-between ${activeDropdown === 'division' ? 'border-emerald-500/50 bg-white/[0.07] text-white' : 'border-white/10 text-slate-300 hover:bg-white/[0.05]'}`}
                   >
                     <Users className={`absolute left-4 top-1/2 -translate-y-1/2 ${activeDropdown === 'division' ? 'text-emerald-500' : 'text-slate-600'}`} size={16} />
                     <span className="truncate">{selectedDivision}</span>
                     <ChevronRight size={14} className={`text-slate-600 transition-transform duration-300 ${activeDropdown === 'division' ? '-rotate-90 text-emerald-500' : 'rotate-90'}`} />
                   </button>

                   {activeDropdown === 'division' && (
                     <>
                       <div className="fixed inset-0 z-20" onClick={() => setActiveDropdown(null)} />
                       <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#0d131f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                         <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                           {uniqueDivisions.map(div => (
                             <button
                               key={div}
                               onClick={() => {
                                 setSelectedDivision(div);
                                 setActiveDropdown(null);
                               }}
                               className={`w-full px-5 py-3.5 text-left text-[11px] font-bold transition-all border-b border-white/[0.03] last:border-0 hover:bg-emerald-600/10 flex items-center justify-between group/item ${selectedDivision === div ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                             >
                               {div}
                               {selectedDivision === div && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                             </button>
                           ))}
                         </div>
                       </div>
                     </>
                   )}
                 </div>
               </div>
            </div>
        </div>

        {/* Content View */}
        {viewMode === 'list' ? (
          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] overflow-hidden shadow-3xl">
            <div className="overflow-x-auto min-h-[500px]">
               <table className="w-full text-left">
                  <thead>
                     <tr className="border-b border-white/[0.03] bg-white/[0.01]">
                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">{t('workforce_response')}</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">{t('warehouse_rack')}</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] text-center">{t('items')}</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] text-right">{t('plus_minus')}</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] text-right">{t('total_diff_value')}</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] text-center">{t('action_th')}</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-32 text-center">
                           <Loader2 className="animate-spin text-blue-500 mx-auto" size={48} />
                        </td>
                      </tr>
                    ) : rackedRecords.length > 0 ? (
                      rackedRecords.map((g, idx) => (
                        <tr key={g.rackNo || idx} className="hover:bg-white/[0.02] transition-all group/row">
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                 <div className="flex -space-x-3">
                                   {g.users.map((u, i) => (
                                     <div key={u} className="w-9 h-9 rounded-full bg-slate-800 border-2 border-[#070b14] flex items-center justify-center text-[10px] font-bold text-white uppercase" title={u}>
                                       {u.charAt(0)}
                                     </div>
                                   ))}
                                 </div>
                                  <div className="ml-2">
                                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{t('scanned_by')}</div>
                                     <div className="text-xs font-bold text-white mt-1 uppercase">{g.users.join(", ")}</div>
                                  </div>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <button 
                                onClick={() => setPreviewedRack(g.rackNo)}
                                className="flex flex-col text-left group/btn"
                              >
                                 <div className="flex items-center gap-2 mb-1">
                                    <Layers size={14} className="text-blue-500" />
                                    <span className="text-lg font-black text-white group-hover/btn:text-blue-400 transition-colors tracking-tighter">{g.rackNo}</span>
                                 </div>
                                  <div className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
                                     <Clock size={10} />
                                     {t('updated_at')} {new Date(g.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                              </button>
                           </td>
                           <td className="px-8 py-6 text-center">
                               <button 
                                 onClick={() => setPreviewedRack(g.rackNo)}
                                 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 transition-all active:scale-95"
                               >
                                 <Package size={14} className="text-slate-500" />
                                 {t('items_count', { count: g.itemsCount })}
                               </button>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className={`text-sm font-black ${g.totalDiff === 0 ? 'text-slate-600' : g.totalDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {g.totalDiff > 0 ? '+' : ''}{g.totalDiff}
                              </div>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className={`text-sm font-mono font-bold ${g.totalValueDiff === 0 ? 'text-slate-700' : g.totalValueDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {g.totalValueDiff > 0 ? '+' : ''}{formatCurrency(g.totalValueDiff)}
                              </div>
                           </td>
                           <td className="px-8 py-6 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportRack(g.rackNo);
                                  }}
                                  className="p-2.5 bg-white/5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/20 rounded-xl transition-all"
                                  title="Export Excel"
                                >
                                  <Download size={16} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportRackTxt(g.rackNo);
                                  }}
                                  className="p-2.5 bg-white/5 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 border border-white/5 hover:border-blue-500/20 rounded-xl transition-all"
                                  title="Export TXT (barcode,qty)"
                                >
                                  <FileText size={16} />
                                </button>
                              </div>
                           </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-32 text-center">
                           <History size={64} className="text-slate-900 mx-auto mb-4" />
                           <p className="text-slate-600 italic">{t('no_matching_activity')}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
             {/* Simple Analytics View */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                      <Users size={16} className="text-blue-500" />
                      {t('workforce_distribution')}
                    </h3>
                   <div className="space-y-6">
                      {uniqueUsers.filter(u => u !== "All Users").map(user => {
                        const userRecs = records.filter(r => r.userName === user);
                        const percentage = (userRecs.length / records.length) * 100;
                        return (
                          <div key={user} className="space-y-2">
                             <div className="flex justify-between items-center text-xs font-bold">
                               <span className="text-white uppercase tracking-tight">{user}</span>
                               <span className="text-slate-500">{userRecs.length} items ({percentage.toFixed(1)}%)</span>
                             </div>
                             <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                               <div 
                                 className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" 
                                 style={{ width: `${percentage}%` }}
                               />
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>

                 <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-500" />
                      {t('value_summary')}
                    </h3>
                   <div className="space-y-8">
                        <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/[0.08] transition-all">
                          <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{t('total_stock_value')}</p>
                            <p className="text-2xl font-black text-white">{formatCurrency(stats.totalValue)}</p>
                          </div>
                         <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                           <LayoutGrid size={24} />
                         </div>
                      </div>

                        <div className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/[0.08] transition-all">
                          <div>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{t('total_diff_value')}</p>
                            <p className={`text-2xl font-black ${stats.diffValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                             {stats.diffValue > 0 ? '+' : ''}{formatCurrency(stats.diffValue)}
                           </p>
                         </div>
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stats.diffValue >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                           <TrendingUp size={24} />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

       <Modal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({...alertConfig, isOpen: false})}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.type === 'confirm' ? t('yes_proceed') : 'OK'}
      />

      <Modal
        isOpen={!!previewedRack}
        onClose={() => setPreviewedRack(null)}
        title={`${previewedRack}`}
        message={
          <div className="mt-4 space-y-4">
             <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {records.filter(r => r.rackNo === previewedRack).map((r, idx) => (
                  <div key={r.id || idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group/item">
                     <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white uppercase truncate">{r.nm_brg}</div>
                        <div className="mt-1">
                           <span className="text-[10px] font-mono text-slate-500 tracking-wider flex items-center gap-1.5">
                              <Barcode size={10} className="text-slate-600" />
                              {r.barcode || r.kd_brg || '-'}
                           </span>
                        </div>
                     </div>
                      <div className="flex items-center gap-4 text-right">
                         <div className="shrink-0 px-4">
                            <div className="text-[8px] font-black text-slate-600 uppercase mb-0.5 tracking-widest opacity-70">{t('opname_qty_label')}</div>
                            <div className="text-sm font-black text-white">{r.physicalQty}</div>
                         </div>
                        <button 
                          onClick={() => {
                            if (r.id) {
                              setAlertConfig({
                                title: t('delete_item_record'),
                                message: t('delete_item_confirm', { name: r.nm_brg }),
                                type: "confirm",
                                isOpen: true,
                                onConfirm: () => {
                                  deleteRecord(r.id!);
                                  // Close preview if it was the last item
                                  const remaining = records.filter(rec => rec.rackNo === previewedRack && rec.id !== r.id);
                                  if (remaining.length === 0) setPreviewedRack(null);
                                  setAlertConfig((prev) => ({ ...prev, isOpen: false }));
                                }
                              });
                            }
                          }}
                          className="p-2 text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                     </div>
                  </div>
                ))}
             </div>
             <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">Inventory Audit System v2.0</p>
                <button 
                  onClick={() => setPreviewedRack(null)}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Close Detail
                </button>
             </div>
          </div>
        }
      />
    </div>
  );
}
