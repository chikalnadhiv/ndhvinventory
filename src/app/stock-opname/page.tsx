"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  Search, 
  Save, 
  ScanLine, 
  CheckCircle, 
  X,
  Loader2,
  Package,
  History,
  Barcode,
  ClipboardList,
  Download,
  Trash2,
  User,
  Layers,
  Edit2,
  Eye,
  BarChart3,
  Users
} from "lucide-react";

import { useInventory } from "@/utils/useInventory";
import { useStockOpname, type StockOpnameRecord } from "@/utils/useStockOpname";
import BarcodeScanner from "@/components/BarcodeScanner";
import { InventoryItem } from "@/utils/excelHandler";
import * as XLSX from 'xlsx';
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";


export default function StockOpnamePage() {
  const { data: session } = useSession();
  const { language, t } = useLanguage();
  const { items, isLoaded } = useInventory();
  const { records, addRecord, updateRecord, deleteRecord, isLoading: isRecordsLoading, clearHistory } = useStockOpname();
  
  // Session states
  const [sessionRack, setSessionRack] = useState("");
  const [sessionUser, setSessionUser] = useState("");
  const [sessionDivision, setSessionDivision] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'user' | 'division' | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const lastScannedRef = useRef({ code: "", time: 0 });
  const isAlertOpenRef = useRef(false);

  // Stats for the current session
  const totalVerified = useMemo(() => {
    if (!session?.user?.name) return 0;
    return records.filter(r => r.userName === session.user?.name).length;
  }, [records, session?.user?.name]);

  const refreshScanner = () => {
    setScannerKey(prev => prev + 1);
  };

  // Persist session to localStorage
  useEffect(() => {
    const savedRack = localStorage.getItem('opname_rack');
    const savedUser = localStorage.getItem('opname_user');
    const savedDivision = localStorage.getItem('opname_division');
    const savedActive = localStorage.getItem('opname_active') === 'true';

    if (savedRack) setSessionRack(savedRack);
    if (savedUser) setSessionUser(savedUser);
    else if (session?.user?.name) setSessionUser(session.user.name);
    
    if (savedDivision) setSessionDivision(savedDivision);
    if (savedActive) setIsSessionActive(true);
  }, [session]);

  useEffect(() => {
    localStorage.setItem('opname_rack', sessionRack);
    localStorage.setItem('opname_user', sessionUser);
    localStorage.setItem('opname_division', sessionDivision);
    localStorage.setItem('opname_active', isSessionActive.toString());
  }, [sessionRack, sessionUser, sessionDivision, isSessionActive]);

  const [isScanning, setIsScanning] = useState(true);
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [opnameQty, setOpnameQty] = useState<number>(0);
  const [manualSearch, setManualSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewRack, setPreviewRack] = useState<string | null>(null);
  
  // Browsing state
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const previewMatches = useMemo(() => {
    if (manualSearch.length < 2) return [];
    const query = manualSearch.toLowerCase().trim();
    
    const normalize = (val: string) => {
        const s = val.toLowerCase().trim().replace(/^0+/, '');
        return s || val.toLowerCase().trim();
    };
    const normalizedQuery = normalize(query);

    return items.filter(item => {
      const nm = item.nm_brg.toLowerCase();
      const kd = item.kd_brg.toLowerCase();
      const bc = (item.barcode || "").toLowerCase();

      return nm.includes(query) || 
             kd.includes(query) || 
             bc.includes(query) ||
             normalize(kd) === normalizedQuery ||
             normalize(bc) === normalizedQuery;
    }).slice(0, 10);
  }, [items, manualSearch]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [manualSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (manualSearch.length < 2 || previewMatches.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % previewMatches.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + previewMatches.length) % previewMatches.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectItem(previewMatches[selectedIndex]);
        setManualSearch("");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setManualSearch("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manualSearch, previewMatches, selectedIndex]);

  const [alertConfig, setAlertConfig] = useState<{
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'confirm', 
    isOpen: boolean, 
    onConfirm?: () => void, 
    onClose?: () => void,
    confirmText?: string,
    cancelText?: string
  }>({
    title: '',
    message: '',
    type: 'info',
    isOpen: false
  });


  const selectItem = (item: InventoryItem) => {
    // Check for existing records on the same rack
    const existingRecord = records.find((r: StockOpnameRecord) => 
      r.rackNo === sessionRack && 
      (r.kd_brg === item.kd_brg || (r.barcode && item.barcode && r.barcode === item.barcode))
    );

    if (existingRecord) {
      isAlertOpenRef.current = true;
      setAlertConfig({
        title: t('item_already_verified'),
        message: `"${item.nm_brg}" ${t('duplicate_msg')}`,
        type: 'confirm',
        isOpen: true,
        confirmText: t('edit_qty'),
        cancelText: t('cancel'),
        onConfirm: () => {
          handleEditRecord(existingRecord);
          setAlertConfig((prev) => ({ ...prev, isOpen: false }));
        },
        onClose: () => {
          isAlertOpenRef.current = false;
          refreshScanner();
        }
      });
      return;
    }

    setScannedItem(item);
    setOpnameQty(item.qty);
    setEditingRecordId(null);
    setIsScanning(false);
    setIsBrowsing(false);
  };

  const handleEditRecord = (record: StockOpnameRecord) => {
    // Construct a temporary InventoryItem for the editor
    const mockItem: InventoryItem = {
      id: record.inventoryId,
      kd_brg: record.kd_brg || "",
      barcode: record.barcode || "",
      nm_brg: record.nm_brg,
      qty: record.systemQty,
      satuan: record.satuan || "pcs",
      hrg_beli: record.hrg_beli,
      // Add missing fields for type safety
      gol1: 0,
      golongan: "",
      sub_gol: "",
      qty_min: 0,
      qty_max: 0,
      kode_supl: ""
    };
    setScannedItem(mockItem);
    setOpnameQty(record.physicalQty);
    setEditingRecordId(record.id || null);
    setIsScanning(false);
    setIsBrowsing(false);
  };

  const handleDeleteRecord = (id: string, name: string) => {
    setAlertConfig({
      title: t('delete_record'),
      message: t('delete_record_confirm', { name }),
      type: 'confirm',
      isOpen: true,
      onConfirm: async () => {
        await deleteRecord(id);
      }
    });
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualSearch.trim()) {
      handleScanSuccess(manualSearch);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    // CRITICAL: Ignore scans if an alert is open OR if we are already editing an item OR browsing
    if (isAlertOpenRef.current || scannedItem || isBrowsing) return; 

    const query = decodedText.trim().toLowerCase();
    if (!query) return;

    // Normalization logic same as Price Check
    const normalize = (val: string) => {
        const s = val.toLowerCase().trim().replace(/^0+/, '');
        return s || val.toLowerCase().trim();
    };
    const normalizedQuery = normalize(query);

    const now = Date.now();
    // Compare normalized versions to prevent loops due to leading zeros
    if (normalizedQuery === normalize(lastScannedRef.current.code) && (now - lastScannedRef.current.time) < 3000) {
      return;
    }
    lastScannedRef.current = { code: normalizedQuery, time: now };

    // 1. Try robust match for barcode or kd_brg
    let foundItem = items.find(item => {
        const itemBarcode = (item.barcode || "").toLowerCase().trim();
        const itemKdBrg = (item.kd_brg || "").toLowerCase().trim();
        
        return itemBarcode === query || 
               itemKdBrg === query || 
               normalize(itemBarcode) === normalizedQuery || 
               normalize(itemKdBrg) === normalizedQuery;
    });
    
    // 2. If not found, try partial match for name
    if (!foundItem) {
      const nameMatches = items.filter(item => 
        item.nm_brg.toLowerCase().includes(query)
      );
      
      if (nameMatches.length === 1) {
        foundItem = nameMatches[0];
      } else if (nameMatches.length > 1) {
        setIsScanning(false);
        setIsBrowsing(true);
        setBrowseQuery(decodedText);
        setManualSearch("");
        return;
      }
    }

    if (foundItem) {
      selectItem(foundItem);
      setManualSearch("");
    } else {
      isAlertOpenRef.current = true;
      setAlertConfig({
        title: t('item_not_found'),
        message: `${t('item_not_found_msg')} ${decodedText}`,
        type: "warning",
        isOpen: true,
        onClose: () => {
          isAlertOpenRef.current = false;
          refreshScanner();
        }
      });
    }
  };


  const saveOpname = async () => {
    if (scannedItem) {
      setIsSaving(true);
      
      let success = false;

      if (editingRecordId) {
        success = await updateRecord(editingRecordId, opnameQty);
      } else {
        success = await addRecord({
          inventoryId: scannedItem.id || "",
          kd_brg: scannedItem.kd_brg || null,
          barcode: scannedItem.barcode || null,
          nm_brg: scannedItem.nm_brg,
          systemQty: scannedItem.qty || 0,
          physicalQty: opnameQty,
          difference: opnameQty - (scannedItem.qty || 0),
          satuan: scannedItem.satuan || null,
          hrg_beli: scannedItem.hrg_beli || 0,
          rackNo: sessionRack,
          userName: sessionUser,
          division: sessionDivision
        });
      }
      
      if (success) {
        // Update lastScannedRef with normalized code to prevent immediate re-scan
        const lastCode = scannedItem.barcode || scannedItem.kd_brg || "";
        const normalize = (val: string) => val.toLowerCase().trim().replace(/^0+/, '') || val.toLowerCase().trim();
        
        lastScannedRef.current = { 
          code: normalize(lastCode), 
          time: Date.now() 
        };
        
        setScannedItem(null);
        setEditingRecordId(null);
        
        // Add a slight delay before showing the scanner again to prevent accidental instant scans
        setTimeout(() => {
          setIsScanning(true);
        }, 800);
      } else {
        setAlertConfig({
          title: t('save_failed'),
          message: t('save_failed_msg'),
          type: "warning",
          isOpen: true
        });
      }
      setIsSaving(false);
    }
  };

  const exportToExcel = (specificRack?: string) => {
    const dataToExport = specificRack 
      ? records.filter((r: StockOpnameRecord) => r.rackNo === specificRack)
      : records;

    if (dataToExport.length === 0) {
      setAlertConfig({
        title: t('export_failed'),
        message: t('no_records_to_export'),
        type: "info",
        isOpen: true
      });
      return;
    }
    
    // Format data for export
    const exportData = dataToExport.map((r: StockOpnameRecord) => ({
      [t('item')]: r.nm_brg,
      [t('item_code')]: r.kd_brg,
      [t('barcode')]: r.barcode,
      [t('unit')]: r.satuan,
      [t('rack')]: r.rackNo,
      [t('division')]: r.division || '-',
      [t('inspector')]: r.userName,
      [t('physical')]: r.physicalQty,
      [t('system')]: r.systemQty,
      [t('diff')]: r.difference,
      [t('price')]: r.hrg_beli,
      [t('date')]: r.createdAt ? new Date(r.createdAt).toLocaleString() : ''
    }));


    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Opname");
    
    // Auto-size columns (rough approximation)
    const maxChars = exportData.reduce((acc: Record<string, number>, row: any) => {
      Object.entries(row).forEach(([key, value]) => {
        const val = (value as any)?.toString() || "";
        acc[key] = Math.max(acc[key] || key.length, val.length);
      });
      return acc;
    }, {} as Record<string, number>);
    ws['!cols'] = Object.keys(maxChars).map(key => ({ wch: maxChars[key] + 2 }));

    XLSX.writeFile(wb, `StockOpname_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleClearHistory = () => {
    setAlertConfig({
      title: t('clear_history'),
      message: t('clear_history_confirm'),
      type: "confirm",
      isOpen: true,
      onConfirm: async () => {
        await clearHistory();
      }
    });
  };


  const filteredBrowse = useMemo(() => {
    if (!browseQuery) return items.slice(0, 50);
    return items.filter(item => 
      item.nm_brg.toLowerCase().includes(browseQuery.toLowerCase()) ||
      item.kd_brg.toLowerCase().includes(browseQuery.toLowerCase()) ||
      (item.barcode && item.barcode.includes(browseQuery))
    ).slice(0, 50);
  }, [items, browseQuery]);

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionRack.trim() && sessionUser.trim() && sessionDivision.trim()) {
      setIsSessionActive(true);
    }
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-purple-500" size={48} />
      <p className="text-slate-400 animate-pulse">{t('loading_inventory')}</p>
    </div>
  );

  if (!isSessionActive) {
    const userRecords = records.filter((r: StockOpnameRecord) => 
      !session?.user?.name || r.userName === session.user.name
    );
    const completedRacks = Array.from(new Set(userRecords.map((r: StockOpnameRecord) => r.rackNo))).filter((r: unknown): r is string => Boolean(r));

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4">
        <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/10 blur-[120px] -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] -z-10" />

        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in zoom-in-95 duration-500">
           {/* Left Column: Setup Forum */}
           <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 md:p-12 shadow-2xl">
              <div className="text-center mb-10">
                 <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                    <ScanLine size={40} className="text-blue-400" />
                 </div>
                 <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">{t('session_setup')}</h1>
                 <p className="text-slate-500 text-sm mt-2 font-medium">{t('initialize_session_msg')}</p>
              </div>

              <form onSubmit={handleStartSession} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">{t('shelf_number')}</label>
                    <div className="relative group/input">
                       <Layers className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-blue-500 transition-colors" size={20} />
                       <input 
                         type="text" 
                         required
                         value={sessionRack}
                         onChange={(e) => setSessionRack(e.target.value)}
                         placeholder={t('shelf_number_placeholder')}
                         className="w-full bg-slate-950/40 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/50 transition-all font-bold"
                       />
                    </div>
                 </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">{t('inspector_name')}</label>
                    <div className="relative group/input">
                       <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-blue-500 transition-colors" size={20} />
                       <input 
                         type="text" 
                         required
                         value={sessionUser}
                         onChange={(e) => setSessionUser(e.target.value)}
                         placeholder={t('inspector_name_placeholder')}
                         className="w-full bg-slate-950/40 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/50 transition-all font-bold"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">{t('division_dept')}</label>
                    <div className="relative group/input">
                       <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-blue-500 transition-colors" size={20} />
                       <input 
                         type="text" 
                         required
                         value={sessionDivision}
                         onChange={(e) => setSessionDivision(e.target.value)}
                         placeholder={t('division_dept_placeholder')}
                         className="w-full bg-slate-950/40 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/50 transition-all font-bold"
                       />
                    </div>
                 </div>

                 <button 
                   type="submit"
                   className="w-full py-5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98] uppercase tracking-widest text-sm mt-4"
                 >
                   {t('start_scanning')}
                 </button>
              </form>

                 <div className="flex items-center gap-2">
               <LanguageToggle />
               <Link 
                 href="/"
                 className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest active:scale-95"
               >
                 <ArrowLeft size={16} />
                 {t('dashboard')}
               </Link>
            </div>
           </div>

           {/* Right Column: Completed Racks Summary */}
           <div className="bg-white/[0.02] border border-white/5 rounded-[48px] p-8 md:p-12 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                    <CheckCircle size={20} />
                 </div>
                 <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">{t('rack_overview')}</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{t('verified_locations')}</p>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                 {completedRacks.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                           {completedRacks.map((rack: string) => (
                              <div key={rack} className="group/rack p-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all flex items-center justify-between">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 group-hover/rack:text-emerald-400 transition-all border border-white/[0.05]">
                                       <Layers size={18} />
                                    </div>
                                    <div>
                                       <p className="text-sm font-black text-slate-200 group-hover/rack:text-white transition-colors">{rack}</p>
                                       <p className="text-[9px] text-slate-600 font-bold uppercase mt-0.5">{t('location_id_verified')}</p>
                                    </div>
                                 </div>
                                  <div className="text-right flex items-center gap-2">
                                    <div className="text-right mr-2">
                                      <div className="text-xs font-black text-emerald-500/80">
                                         {userRecords.filter((r: StockOpnameRecord) => r.rackNo === rack).length}
                                      </div>
                                      <div className="text-[8px] font-bold text-slate-700 uppercase">{t('items_label')}</div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        onClick={() => setPreviewRack(rack)}
                                        className="p-2 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 transition-all border border-white/5"
                                        title={t('preview_rack')}
                                      >
                                        <Eye size={14} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setSessionRack(rack);
                                          // Find the first record for this rack to get the user and division
                                          const rackRecord = records.find(r => r.rackNo === rack);
                                          if (rackRecord) {
                                            setSessionUser(rackRecord.userName);
                                            setSessionDivision(rackRecord.division || "");
                                          }
                                          setIsSessionActive(true);
                                        }}
                                        className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all border border-blue-500/20"
                                        title={t('resume_rack')}
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button 
                                        onClick={() => exportToExcel(rack)}
                                        className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                                        title="Export Rack Results"
                                      >
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                       <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-dashed border-white/10 flex items-center justify-center text-slate-800 mb-6">
                          <History size={32} />
                       </div>
                       <p className="text-slate-500 text-sm font-bold uppercase tracking-widest leading-relaxed">No racks have been<br/>verified today</p>
                    </div>
                 )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.05]">
                 <div className="flex items-center justify-between bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                    <span className="text-[10px] text-emerald-400/60 font-black uppercase tracking-widest">Total Verified By You</span>
                    <span className="text-sm font-black text-emerald-400 tabular-nums">{userRecords.length} <span className="text-[8px] opacity-60">SKU</span></span>
                 </div>
              </div>
           </div>
        </div>

        {/* Rack Preview Modal */}
        <Modal
          isOpen={!!previewRack}
          onClose={() => setPreviewRack(null)}
          title={`Preview Rack: ${previewRack}`}
          message={
            <div className="mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {records
                .filter((r: StockOpnameRecord) => r.rackNo === previewRack)
                .map((record: StockOpnameRecord, idx: number) => (
                  <div key={record.id || idx} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white uppercase truncate">{record.nm_brg}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">{record.barcode}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[8px] text-slate-600 font-bold uppercase">Physical</p>
                        <p className={`text-xs font-black ${record.difference === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {record.physicalQty}
                        </p>
                      </div>
                      <div className="text-right border-l border-white/5 pl-3">
                        <p className={`text-[9px] font-black ${record.difference === 0 ? 'text-slate-700' : 'text-red-400/50'}`}>
                          {record.difference > 0 ? `+${record.difference}` : record.difference}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          }
          type="info"
          confirmText="Close"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Background Gradients */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/10 blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] -z-10" />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-2">
                 <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <img 
                      src="/ndhvinventory.png" 
                      alt="ndhvInventory Logo" 
                      className="relative w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    />
                 </div>
                 <h1 className="text-2xl md:text-3xl font-black tracking-tighter italic leading-none">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">ndhv</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-indigo-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">Inventory</span>
                  <span className="ml-2 text-blue-500/50 not-italic font-bold text-lg md:text-xl">Opname</span>
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500 text-[10px] md:text-xs font-medium uppercase tracking-widest">Active Session: </span>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest">{sessionRack}</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-black uppercase tracking-widest">User: {sessionUser}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest">Divisi: {sessionDivision}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              onClick={() => setIsBrowsing(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-bold hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest"
            >
              <Package size={18} />
              Browse
            </button>
            <Link 
              href="/stock-opname/results"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-bold hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest"
            >
              <ClipboardList size={18} />
              Results
            </Link>
            {(session?.user as any)?.role === "ADMIN" && (
              <Link 
                href="/stock-opname/manage"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all uppercase tracking-widest"
              >
                <BarChart3 size={18} />
                Manage
              </Link>
            )}
            <button 
              onClick={() => setIsSessionActive(false)}
              className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-600 hover:text-red-400 transition-all"
              title="Change Session"
            >
              <CheckCircle size={18} />
            </button>
          </div>
        </header>
    
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Interaction Column */}
          <div className="lg:col-span-8 space-y-8 relative z-20">
            
            {/* Unified Interaction Card - Removed overflow-hidden to allow search dropdown to float */}
            <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[48px] shadow-2xl min-h-[500px] flex flex-col relative group">
              
              {/* Conditional Content */}
              <div className="flex-1 flex flex-col">
                
                {/* 1. Scanning State */}
                {isScanning && !isBrowsing && !scannedItem && (
                   <div className="p-4 md:p-12 flex flex-col h-full animate-in fade-in duration-500">
                      <div className="flex items-center justify-between mb-4 md:mb-8">
                        <div>
                          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Scanner <span className="text-blue-500">Ready</span></h2>
                          <p className="text-slate-500 text-[10px] font-medium mt-0.5 uppercase tracking-widest leading-relaxed">Place barcode in the frame</p>
                        </div>
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-[0.2em]">
                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                           Active
                        </div>
                      </div>

                      <div className="relative aspect-square md:aspect-video md:flex-1 min-h-[300px] md:min-h-[400px] bg-black/60 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group-hover:border-blue-500/30 transition-all">
                         <BarcodeScanner key={scannerKey} onScanSuccess={handleScanSuccess} />
                      </div>

                      <div className="mt-6 flex flex-col items-center gap-4 relative">
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full">
                          <div className="flex-1 relative w-full group/input">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-blue-500 transition-colors" size={18} />
                            <input 
                              type="text" 
                              placeholder="Manual search..."
                              value={manualSearch}
                              onChange={(e) => setManualSearch(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualSearch)}
                              className="w-full bg-slate-950/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-blue-500/50 transition-all font-bold"
                            />
                          </div>
                          <button 
                            onClick={() => setIsBrowsing(true)}
                            className="w-full md:w-auto px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-300 font-bold hover:text-white hover:bg-white/10 transition-all text-[10px] uppercase tracking-widest whitespace-nowrap"
                          >
                            Browse All
                          </button>
                        </div>

                        {/* Search Preview Dropdown - Ultra Premium UI */}
                        {manualSearch.length >= 2 && (
                          <div className="absolute top-[calc(100%+12px)] inset-x-0 z-50 bg-slate-950/90 backdrop-blur-[40px] border border-white/10 rounded-[32px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] max-h-[420px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                            {/* Header */}
                            <div className="px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.03] flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                  <span className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Preview Matches</span>
                               </div>
                               <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-400 font-black tracking-widest uppercase">
                                {previewMatches.length} items
                               </span>
                            </div>
                            
                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar max-h-[300px]">
                              {previewMatches.length > 0 ? (
                                  previewMatches.map((item, idx) => (
                                    <button
                                      key={item.id}
                                      onClick={() => {
                                        selectItem(item);
                                        setManualSearch("");
                                        setSelectedIndex(-1);
                                      }}
                                      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group/result text-left border relative overflow-hidden active:scale-[0.99] ${
                                        selectedIndex === idx 
                                          ? "bg-blue-500/10 border-blue-500/40" 
                                          : "bg-transparent border-white/[0.05] hover:bg-white/[0.05] hover:border-blue-500/30"
                                      }`}
                                    >
                                      {/* Hover Glow Effect */}
                                      <div className={`absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/0 transition-all ${
                                        selectedIndex === idx ? "from-blue-600/[0.05]" : "group-hover/result:from-blue-600/[0.03]"
                                      }`} />
                                      
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shrink-0 ${
                                        selectedIndex === idx 
                                          ? "text-blue-400 bg-blue-500/10 border-blue-500/20" 
                                          : "text-slate-500 bg-white/[0.03] border-white/[0.05] group-hover/result:text-blue-400 group-hover/result:bg-blue-500/10 group-hover/result:border-blue-500/20"
                                      }`}>
                                        <Package size={22} strokeWidth={2.5} />
                                      </div>
                                      
                                      <div className="flex-1 min-w-0 z-10">
                                        <div className={`text-sm font-bold transition-colors truncate uppercase tracking-tight ${
                                          selectedIndex === idx ? "text-white" : "text-slate-100 group-hover/result:text-white"
                                        }`}>
                                           {item.nm_brg}
                                        </div>
                                        <div className="flex items-center gap-2.5 mt-2">
                                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/5 rounded-md border border-blue-500/10 max-w-[140px] truncate">
                                            <Barcode size={10} className="text-blue-500/50" />
                                            <span className="text-[10px] font-mono font-bold text-blue-400/80 tracking-tight">{item.barcode || 'N/A'}</span>
                                          </div>
                                          <span className="text-[10px] font-mono text-slate-500 tracking-tighter truncate">{item.kd_brg}</span>
                                        </div>
                                      </div>
                                      
                                      <div className="text-right shrink-0 z-10">
                                        <div className={`text-lg font-black transition-colors tabular-nums ${
                                          selectedIndex === idx ? "text-blue-400" : "text-white group-hover/result:text-blue-400"
                                        }`}>{item.qty}</div>
                                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{item.satuan}</div>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="py-16 flex flex-col items-center gap-4 text-center">
                                    <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-800 border border-dashed border-white/[0.08]">
                                      <Search size={32} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                      <p className="text-slate-200 text-xs font-black uppercase tracking-[0.2em] mb-1">No matches found</p>
                                      <p className="text-slate-600 text-[10px] font-medium">Try searching by different keywords</p>
                                    </div>
                                  </div>
                                )}
                            </div>
                            
                            {/* Footer */}
                             <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.08] flex items-center justify-between">
                                <div className="hidden md:flex items-center gap-4">
                                   <div className="flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-bold text-slate-400 border border-white/5 uppercase">Enter</span>
                                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-[8px]">Select</span>
                                   </div>
                                   <div className="flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-bold text-slate-400 border border-white/5 uppercase">Esc</span>
                                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-[8px]">Close</span>
                                   </div>
                                </div>
                                <p className="text-[8px] text-slate-700 font-black uppercase tracking-[0.2em] ml-auto">Inventory Preview v2.0</p>
                             </div>
                          </div>
                        )}
                      </div>
                   </div>
                )}

                {/* 2. Browsing State */}
                {isBrowsing && !scannedItem && (
                  <div className="p-8 md:p-12 flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
                     <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Pilih <span className="text-purple-500">Barang</span></h2>
                        <button 
                          onClick={() => setIsBrowsing(false)}
                          className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl transition-all"
                        >
                          <X size={20} />
                        </button>
                     </div>

                     <div className="relative mb-8 group/search">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-purple-500 transition-colors" size={20} />
                        <input 
                          type="text" 
                          value={browseQuery}
                          onChange={(e) => setBrowseQuery(e.target.value)}
                          placeholder="Search name, code or barcode..."
                          className="w-full bg-slate-900/60 border border-white/10 rounded-2xl pl-14 pr-4 py-4.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-all font-medium"
                        />
                     </div>

                     <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {filteredBrowse.map((item) => (
                             <button 
                               key={item.id}
                               onClick={() => selectItem(item)}
                               className="p-5 bg-white/5 border border-white/5 rounded-3xl text-left hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group/item shadow-lg"
                             >
                                <div className="text-[10px] font-black text-slate-600 mb-1.5 group-hover/item:text-purple-400 transition-colors uppercase tracking-[0.2em]">{item.kd_brg}</div>
                                <div className="text-base font-bold text-slate-200 line-clamp-1 group-hover/item:text-white transition-colors">{item.nm_brg}</div>
                                <div className="mt-4 flex items-center justify-between">
                                   <div className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                      {item.qty} {item.satuan}
                                   </div>
                                   <span className="text-[10px] text-slate-700 font-mono tracking-tighter">{item.barcode}</span>
                                </div>
                             </button>
                           ))}
                           {filteredBrowse.length === 0 && (
                             <div className="col-span-full py-32 flex flex-col items-center gap-4 text-slate-700 italic">
                                <Search size={48} className="opacity-20" />
                                <p>No items match your search criteria</p>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                )}

                {/* 3. Editor View */}
                {scannedItem && (
                  <div className="p-5 md:p-12 animate-in zoom-in-95 duration-500 h-full flex flex-col">
                     <div className="flex items-start justify-between mb-6 pb-6 border-b border-white/5">
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner">
                              <Package size={32} />
                           </div>
                           <div>
                              <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight leading-tight">{scannedItem.nm_brg}</h2>
                              <div className="flex items-center gap-2 mt-2">
                                 <div className="flex items-center gap-1.5 px-2 py-0.5 font-mono text-blue-500 font-bold bg-blue-500/5 rounded-lg border border-blue-500/10">
                                   <Barcode size={10} className="text-blue-500/50" />
                                   <span className="text-[10px]">{scannedItem.barcode || 'N/A'}</span>
                                 </div>
                                 <span className="text-[10px] font-mono text-slate-600 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                   {scannedItem.kd_brg}
                                 </span>
                              </div>
                           </div>
                        </div>
                        <button 
                          onClick={() => { setScannedItem(null); setIsScanning(true); }}
                          className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                        >
                          <X size={20} />
                        </button>
                     </div>

                     <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
                        <div className="space-y-6">
                           <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] ml-2 text-center block">Update Physical Stock Verification</label>
                           
                           <div className="flex items-center gap-3 md:gap-6">
                             <button 
                               onClick={() => setOpnameQty(Math.max(0, opnameQty - 1))}
                               className="w-14 h-14 md:w-24 md:h-24 flex items-center justify-center rounded-2xl md:rounded-[32px] bg-white/5 border border-white/10 hover:bg-white/10 text-white text-2xl md:text-4xl transition-all active:scale-90 shadow-xl"
                             >
                               -
                             </button>
                             <div className="flex-1 bg-slate-950/60 border-2 border-blue-500/20 rounded-[32px] md:rounded-[40px] p-6 md:p-10 text-center shadow-inner focus-within:border-blue-500/50 transition-all group/stock relative">
                               <input 
                                 type="number" 
                                 value={opnameQty}
                                 autoFocus
                                 onFocus={(e) => e.target.select()}
                                 onChange={(e) => setOpnameQty(Number(e.target.value))}
                                 className="w-full bg-transparent text-center text-5xl md:text-8xl font-black text-white focus:outline-none selection:bg-blue-500/30"
                               />
                               <div className="mt-2 text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-[0.3em]">{scannedItem.satuan}</div>
                               
                               {/* Quick action buttons inside input */}
                               <div className="absolute right-4 bottom-4 flex flex-col gap-2">
                                  <button 
                                    onClick={() => setOpnameQty(0)}
                                    className="p-2 transition-all hover:bg-white/5 rounded-lg text-slate-800 hover:text-red-500 font-black text-[10px] uppercase tracking-tighter"
                                  >
                                    {t('set_0')}
                                  </button>
                                  <button 
                                    onClick={() => setOpnameQty(scannedItem.qty)}
                                    className="p-2 transition-all hover:bg-white/5 rounded-lg text-slate-800 hover:text-blue-500 font-black text-[10px] uppercase tracking-tighter"
                                  >
                                    {t('reset')}
                                  </button>
                               </div>
                             </div>
                             <button 
                               onClick={() => setOpnameQty(opnameQty + 1)}
                               className="w-14 h-14 md:w-24 md:h-24 flex items-center justify-center rounded-2xl md:rounded-[32px] bg-white/5 border border-white/10 hover:bg-white/10 text-white text-2xl md:text-4xl transition-all active:scale-90 shadow-xl"
                             >
                               +
                             </button>
                           </div>

                           <div className="flex justify-between px-6 pt-4">
                              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                                {t('system_label')} <span className="text-slate-400">{scannedItem.qty} {scannedItem.satuan}</span>
                              </div>
                              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                                {t('plus_minus_label')} <span className={`font-black ${opnameQty - scannedItem.qty >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {opnameQty - scannedItem.qty > 0 ? '+' : ''}{opnameQty - scannedItem.qty}
                                </span>
                              </div>
                           </div>
                        </div>

                         <div className="mt-10 flex flex-col md:flex-row gap-3 md:gap-4">
                            <button 
                              onClick={saveOpname}
                              disabled={isSaving}
                              className="flex-[2] py-4.5 md:py-6 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl md:rounded-[24px] shadow-2xl shadow-blue-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-base md:text-lg"
                            >
                              {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                              {t('save_btn')}
                            </button>
                            <button 
                               onClick={() => { setScannedItem(null); setIsScanning(true); }}
                               className="flex-1 py-4.5 text-slate-500 hover:text-white font-bold text-xs md:text-sm transition-colors border border-white/5 rounded-2xl md:rounded-[24px] hover:bg-white/5"
                            >
                               {t('cancel')}
                            </button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar (Right) */}
          <div className="lg:col-span-4 space-y-6 relative z-10">
             
             {/* History Card (Session Specific) */}
             <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                         <History size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">{t('rack')}: {sessionRack}</h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{sessionUser}</p>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] text-blue-500 font-black tracking-widest uppercase mb-0.5">{t('session_log')}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] text-slate-400 font-black tracking-widest uppercase border border-white/5">
                        {t('items_count', { count: records.filter((r: StockOpnameRecord) => r.rackNo === sessionRack && r.userName === sessionUser).length })}
                      </span>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                  {isRecordsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-purple-500/50" />
                    </div>
                  ) : (
                    (() => {
                      const sessionRecords = records.filter((r: StockOpnameRecord) => r.rackNo === sessionRack && r.userName === sessionUser);
                      return sessionRecords.length > 0 ? (
                        sessionRecords.map((record: StockOpnameRecord, idx: number) => (
                          <div key={record.id || idx} className="p-4 bg-slate-900/40 rounded-2xl border border-white/5 flex items-center gap-4 animate-in slide-in-from-right-4 duration-300 group/record-item">
                             <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate uppercase tracking-tight">{record.nm_brg}</p>
                                <div className="flex items-center justify-between mt-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                   <span>{record.barcode}</span>
                                   <div className="flex items-center gap-2">
                                      <span className="text-slate-700 line-through decoration-slate-700/30">{record.systemQty}</span>
                                      <span className={`px-2 py-0.5 rounded-md ${record.difference === 0 ? 'text-slate-400 bg-white/5' : 'text-red-400 bg-red-500/10 font-black'}`}>
                                        {record.physicalQty} {record.satuan}
                                      </span>
                                   </div>
                                </div>
                             </div>
                             
                             {/* Actions - Always Visible */}
                             <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => handleEditRecord(record)}
                                  className="p-2 hover:bg-blue-500/20 rounded-xl text-slate-500 hover:text-blue-400 transition-all active:scale-95"
                                  title={t('edit_label')}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteRecord(record.id!, record.nm_brg)}
                                  className="p-2 hover:bg-red-500/20 rounded-xl text-slate-500 hover:text-red-400 transition-all active:scale-95"
                                  title={t('delete_label')}
                                >
                                  <Trash2 size={16} />
                                </button>
                             </div>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                          <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center text-slate-700 mb-4 border border-white/5">
                            <Barcode size={32} />
                          </div>
                          <p className="text-slate-500 text-sm font-medium italic">{t('empty_log')}</p>
                          <p className="text-slate-800 text-[9px] uppercase tracking-tighter mt-2">{t('start_scanning_prompt')}</p>
                        </div>
                      );
                    })()
                  )}
                </div>
                
                <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                   {records.filter((r: StockOpnameRecord) => r.rackNo === sessionRack && r.userName === sessionUser).length > 0 && (
                     <>
                        <button 
                          onClick={async () => {
                            // Log session closure activity
                            try {
                              await fetch('/api/activities', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  type: 'SESSION_CLOSED',
                                  user: sessionUser,
                                  rack: sessionRack,
                                  message: `Closed session for rack ${sessionRack}`
                                })
                              });
                            } catch (e) {
                              console.error("Failed to log session closure", e);
                            }

                            setSessionRack("");
                            setSessionUser("");
                            setIsSessionActive(false);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-4 text-xs font-black text-white uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-900/10"
                        >
                          <Save size={16} />
                          {t('save_close_session')}
                        </button>
                        <button 
                          onClick={handleClearHistory}
                          className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                          {t('force_reset')}
                        </button>
                     </>
                   )}
                   <Link 
                     href="/"
                     className="w-full py-4 text-center block text-xs font-black text-slate-400 hover:text-white uppercase tracking-widest bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/10"
                   >
                     {t('back_to_dashboard')}
                   </Link>
                </div>
             </div>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={alertConfig.isOpen}
        onClose={() => {
          setAlertConfig({...alertConfig, isOpen: false});
          if (alertConfig.onClose) alertConfig.onClose();
        }}
        onConfirm={alertConfig.onConfirm}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText || (alertConfig.type === 'confirm' ? 'Yes, Delete' : 'OK')}
        cancelText={alertConfig.cancelText}
      />
    </div>
  );
}
