"use client";

import { useState, useMemo } from "react";
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
  BarChart3,
  LayoutGrid
} from "lucide-react";
import { useStockOpname, StockOpnameRecord } from "@/utils/useStockOpname";
import * as XLSX from 'xlsx';
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

export default function StockOpnameResultsPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { records, isLoading, clearHistory } = useStockOpname();
  const [searchQuery, setSearchQuery] = useState("");

  const [alertConfig, setAlertConfig] = useState<{title: string, message: string, type: 'info' | 'success' | 'warning' | 'confirm', isOpen: boolean, onConfirm?: () => void}>({
    title: '',
    message: '',
    type: 'info',
    isOpen: false
  });


  const filteredRecords = useMemo(() => {
    return records.filter((r: StockOpnameRecord) => 
      r.nm_brg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.kd_brg && r.kd_brg.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.barcode && r.barcode.includes(searchQuery))
    );
  }, [records, searchQuery]);

  const handleExport = () => {
    if (records.length === 0) {
      setAlertConfig({
        title: t('export_error'),
        message: t('no_records_to_export'),
        type: "info",
        isOpen: true
      });
      return;
    }
    
    const exportData = records.map((r: StockOpnameRecord) => ({

      'Division': r.division || '-',
      'Inspector': r.userName,
      'Rack': r.rackNo || '-',
      'Item': r.nm_brg,
      'Item code': r.kd_brg,
      'Barcode': r.barcode,
      'Unit of me': r.satuan,
      'Stock': r.physicalQty,
      'Price': r.hrg_beli,
      'Note': r.difference === 0 ? 'Match' : (r.difference > 0 ? `Surplus: ${r.difference}` : `Shortage: ${r.difference}`),
      'Timestamp': r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Opname Results");
    XLSX.writeFile(wb, `StockOpname_Full_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleClear = () => {
    setAlertConfig({
      title: t('clear_history_title'),
      message: t('clear_history_msg'),
      type: "confirm",
      isOpen: true,
      onConfirm: async () => {
        await clearHistory();
      }
    });
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const currentRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8">
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] -z-10" />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col gap-6 mb-8 pb-6 border-b border-white/5">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Link 
                href="/"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 shrink-0"
              >
                <ArrowLeft size={18} />
              </Link>
              
              <div className="flex items-center gap-3">
                 <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <img 
                      src="/ndhvinventory.png" 
                      alt="ndhvInventory Logo" 
                      className="relative w-10 h-10 md:w-16 md:h-16 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    />
                 </div>
                 <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 leading-none">
                      <h1 className="text-lg md:text-3xl font-black tracking-tighter italic whitespace-nowrap">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">ndhv</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-indigo-500">Inventory</span>
                      </h1>
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-600/10 border border-blue-600/20 text-[8px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest">{t('reports')}</span>
                    </div>
                    <p className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mt-1 truncate">{t('history_archive')}</p>
                 </div>
              </div>
            </div>

            {(session?.user as any)?.role === "ADMIN" && (
              <button 
                onClick={handleClear}
                disabled={records.length === 0}
                className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all border border-white/5 shrink-0"
                title={t('clear_history')}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            {(session?.user as any)?.role === "ADMIN" && (
              <Link 
                href="/stock-opname/manage"
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
              >
                <LayoutGrid size={16} />
                {t('manage_dashboard')}
              </Link>
            )}
            <button 
              onClick={handleExport}
              disabled={records.length === 0}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >
              <Download size={16} />
              {t('export_excel')}
            </button>
          </div>
        </header>


        {/* Filters and List */}
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text" 
              placeholder={t('filter_results')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all font-medium"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('item_info_th')}</th>
                    <th className="hidden lg:table-cell px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('timestamp_th')}</th>
                    <th className="hidden sm:table-cell px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">{t('system_label').replace(':', '')}</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">{t('qty_th')}</th>
                    <th className="px-4 md:px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">{t('diff_th')}</th>
                    <th className="hidden md:table-cell px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">{t('price_th')}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <Loader2 className="animate-spin text-blue-500 mx-auto" size={40} />
                      </td>
                    </tr>
                  ) : currentRecords.length > 0 ? (
                    currentRecords.map((r: StockOpnameRecord, idx: number) => (
                      <tr key={r.id || idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 md:px-6 py-4 md:py-5">
                          <div className="flex items-center gap-3 md:gap-4">
                             <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 border ${r.difference === 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                {r.difference === 0 ? <CheckCircle size={14} className="md:w-[18px] md:h-[18px]" /> : <X size={14} className="md:w-[18px] md:h-[18px]" />}
                             </div>
                             <div>
                                <div className="text-xs md:text-sm font-bold text-white uppercase group-hover:text-blue-400 transition-colors line-clamp-1">{r.nm_brg}</div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                   <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">{r.kd_brg}</span>
                                   <span className="px-1 py-0.5 rounded bg-white/5 text-[8px] font-black text-slate-600 uppercase tracking-widest border border-white/5">Inspector: {r.userName}</span>
                                   <span className="px-1 py-0.5 rounded bg-emerald-500/5 text-[8px] font-black text-emerald-500/50 uppercase tracking-widest border border-emerald-500/10">Divisi: {r.division}</span>
                                </div>
                             </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-5">
                           <div className="flex items-center gap-2 text-slate-400 text-xs">
                              <Calendar size={14} className="text-slate-600" />
                              {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                           </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-5 text-center text-xs md:text-sm font-medium text-slate-500">{r.systemQty} {r.satuan}</td>
                        <td className="px-4 md:px-6 py-4 md:py-5 text-center text-xs md:text-sm font-bold text-white">{r.physicalQty} {r.satuan}</td>
                        <td className="px-4 md:px-6 py-4 md:py-5 text-right">
                           <span className={`text-xs md:text-sm font-bold ${r.difference === 0 ? 'text-slate-500' : r.difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
                               {r.difference > 0 ? '+' : ''}{r.difference}
                           </span>
                        </td>
                        <td className="hidden md:table-cell px-6 py-5 text-right font-mono text-sm text-slate-400">
                           {formatCurrency(r.hrg_beli)}
                        </td>
                      </tr>
                    ))

                  ) : (
                    <tr>
                      <td colSpan={6} className="py-32 text-center">
                         <div className="flex flex-col items-center gap-4">
                            <History size={48} className="text-slate-800" />
                            <p className="text-slate-500 italic">{t('no_results_found')}</p>
                         </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-6 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  {t('showing_page', { current: currentPage, total: totalPages })}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {t('prev')}
                  </button>
                  <div className="flex items-center">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({...alertConfig, isOpen: false})}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.type === 'confirm' ? t('yes_clear_all') : 'OK'}
      />
    </div>

  );
}
