"use client";

import { useState, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Search, 
  Package, 
  Edit3, 
  Image as ImageIcon, 
  Save, 
  X, 
  Upload,
  AlertCircle
} from "lucide-react";
import { useInventory } from "@/utils/useInventory";
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

export default function MasterItemPage() {
  const { data: session } = useSession();
  const { language, t } = useLanguage();
  const { items, isLoaded, refreshItems } = useInventory();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Edit State
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.nm_brg.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.kd_brg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.barcode && item.barcode.includes(searchQuery))
    );
  }, [items, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const handleEditClick = (item: any) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log("Saving item:", editingItem.id);
      console.log("Has image:", !!editingItem.imageUrl);
      console.log("Image type:", editingItem.imageUrl?.substring(0, 30));

      const response = await fetch(`/api/inventory/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nm_brg: editingItem.nm_brg,
          kd_brg: editingItem.kd_brg,
          barcode: editingItem.barcode,
          gol1: editingItem.gol1,
          qty: editingItem.qty,
          satuan: editingItem.satuan,
          golongan: editingItem.golongan,
          imageUrl: editingItem.imageUrl
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || "Failed to update item");
      }

      const updated = await response.json();
      console.log("Update successful:", updated.id);

      await refreshItems();
      setIsEditModalOpen(false);
      setError(null);
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic validation
      if (!file.type.startsWith('image/')) {
        setError("Please upload an image file.");
        return;
      }

      // Check file size (max 5MB original)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image too large. Please use an image smaller than 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // More aggressive compression
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;  // Reduced from 800
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Lower quality for smaller size
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          // Check compressed size (Base64 is ~33% larger than binary)
          const sizeInBytes = (compressedBase64.length * 3) / 4;
          const sizeInKB = Math.round(sizeInBytes / 1024);
          
          console.log(`Compressed image: ${width}x${height}, ${sizeInKB}KB`);
          
          if (sizeInBytes > 500 * 1024) { // Max 500KB
            setError(`Compressed image still too large (${sizeInKB}KB). Try a simpler image.`);
            return;
          }
          
          setEditingItem({ ...editingItem, imageUrl: compressedBase64 });
          setError(null);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="group p-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
                {t('master_item')}
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                <Package size={12} className="text-blue-400" />
                {t('product_gallery_management')}
              </p>
            </div>
          </div>

          <div className="relative flex-1 md:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors z-10" size={18} />
            <input 
              type="text" 
              placeholder={t('search_products')} 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all duration-300 focus:shadow-lg focus:shadow-blue-500/10 placeholder:text-slate-600"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
          </div>
        </header>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentItems.map((item) => (
            <div 
              key={item.id} 
              className="group bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 rounded-3xl p-5 hover:border-blue-500/30 transition-all duration-500 relative overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"></div>
              
              <div className="relative">
                <div className="aspect-square rounded-2xl overflow-hidden flex items-center justify-center relative group/img shadow-xl border border-white/5">
                  {/* Base gradient background - ALWAYS VISIBLE */}
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
                  
                  {item.imageUrl ? (
                    <>
                      {/* Glow effect behind image */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-2xl scale-95 opacity-0 group-hover/img:opacity-100 transition-opacity duration-700"></div>
                      
                      {/* Main image with black background removal */}
                      <img 
                        src={item.imageUrl} 
                        alt={item.nm_brg} 
                        className="w-full h-full object-contain p-4 group-hover/img:scale-110 transition-transform duration-700 relative z-10 drop-shadow-2xl"
                        style={{
                          mixBlendMode: 'lighten',
                          filter: 'contrast(1.1) brightness(1.05)'
                        }}
                      />
                      
                      {/* Bottom reflection effect */}
                      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-[5]"></div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 relative z-10">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700/50 via-slate-800/50 to-slate-700/50 flex items-center justify-center border border-white/5 shadow-xl relative overflow-hidden">
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/img:translate-x-full transition-transform duration-1000"></div>
                        <Package size={32} className="text-slate-600 relative z-10" />
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">{t('no_image')}</span>
                        <span className="text-[8px] text-slate-700 mt-1 block">{t('upload_to_display')}</span>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleEditClick(item)}
                    className="absolute inset-0 bg-gradient-to-br from-blue-600/80 via-blue-500/80 to-purple-600/80 opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-widest backdrop-blur-sm z-20"
                  >
                    <Edit3 size={18} className="animate-pulse" />
                    <span className="drop-shadow-lg">{t('edit_product')}</span>
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-black text-sm text-white line-clamp-2 uppercase leading-tight group-hover:text-blue-300 transition-colors">
                      {item.nm_brg}
                    </h3>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-xs font-mono text-slate-500">{item.kd_brg}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">{item.qty} {item.satuan}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <span className="inline-block px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 text-xs font-black tabular-nums shadow-lg shadow-blue-500/10">
                      {formatCurrency(item.gol1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mx-auto text-slate-700 mb-6 border border-white/10">
              <Package size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-400 mb-2">{t('no_products_found')}</h3>
            <p className="text-slate-600 text-sm">{t('adjust_search')}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-16 flex justify-center items-center gap-4">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-5 py-2.5 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all text-xs font-bold uppercase tracking-wider"
            >
              Previous
            </button>
            <div className="px-6 py-2.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl">
              <span className="text-xs font-bold text-slate-400">
                {t('page_label')} <span className="text-blue-300 text-base mx-1">{currentPage}</span> {t('of_label')} <span className="text-slate-300">{totalPages}</span>
              </span>
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-5 py-2.5 bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all text-xs font-bold uppercase tracking-wider"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => !isSaving && setIsEditModalOpen(false)}></div>
           <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <form onSubmit={handleSave}>
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                   <div>
                      <h2 className="text-xl font-black text-white">{t('edit_product')}</h2>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">{t('item_id')}: {editingItem.id}</p>
                   </div>
                   <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors"
                   >
                     <X size={24} />
                   </button>
                </div>

                <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                   {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm">
                         <AlertCircle size={18} />
                         {error}
                      </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Image Section */}
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">{t('product_image')}</label>
                          <div className="aspect-square rounded-3xl bg-slate-950 border border-white/10 flex items-center justify-center relative overflow-hidden group">
                             {editingItem.imageUrl ? (
                               <img src={editingItem.imageUrl} className="w-full h-full object-cover" />
                             ) : (
                               <ImageIcon size={48} className="text-slate-800" />
                             )}
                             <label className="absolute inset-0 bg-blue-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 cursor-pointer text-white text-[10px] font-black uppercase">
                                <Upload size={24} />
                                {t('change_image')}
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                             </label>
                          </div>
                       </div>

                       {/* Info Section */}
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('product_name')}</label>
                            <input 
                              type="text"
                              value={editingItem.nm_brg}
                              onChange={(e) => setEditingItem({ ...editingItem, nm_brg: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                              required
                            />
                         </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('internal_code')}</label>
                                <input 
                                  type="text"
                                  value={editingItem.kd_brg}
                                  onChange={(e) => setEditingItem({ ...editingItem, kd_brg: e.target.value })}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                                />
                            </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('barcode')}</label>
                                <input 
                                  type="text"
                                  value={editingItem.barcode || ''}
                                  onChange={(e) => setEditingItem({ ...editingItem, barcode: e.target.value })}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                                />
                            </div>
                         </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('sell_price')}</label>
                                <input 
                                  type="number"
                                  value={editingItem.gol1}
                                  onChange={(e) => setEditingItem({ ...editingItem, gol1: parseFloat(e.target.value) })}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('current_stock')}</label>
                                <input 
                                  type="number"
                                  value={editingItem.qty}
                                  onChange={(e) => setEditingItem({ ...editingItem, qty: parseInt(e.target.value) })}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="p-8 bg-black/20 flex gap-4">
                   <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={isSaving}
                    className="flex-1 px-6 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-all disabled:opacity-50"
                   >
                     {t('discard_changes')}
                   </button>
                   <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase shadow-xl shadow-blue-500/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                     {t('save_changes')}
                   </button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
