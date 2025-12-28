"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  UserPlus, 
  Trash2, 
  Edit2, 
  Shield, 
  User, 
  Mail,
  Loader2,
  X,
  Check
} from "lucide-react";
import Modal from "../../../components/Modal";
import { useLanguage } from "@/context/LanguageContext";

interface UserData {

  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function ManageUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [alertConfig, setAlertConfig] = useState<{title: string, message: string, type: 'info' | 'success' | 'warning' | 'confirm', isOpen: boolean, onConfirm?: () => void}>({
    title: '',
    message: '',
    type: 'info',
    isOpen: false
  });

  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER"
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormData({ name: "", email: "", password: "", role: "USER" });
        fetchUsers();
      } else {
        const err = await res.json();
        setAlertConfig({
          title: "Operation Failed",
          message: err.error || "Could not save user data. Please check your input.",
          type: "warning",
          isOpen: true
        });
      }
    } catch (e) {
      setAlertConfig({
        title: "Network Error",
        message: "Failed to connect to the server. Please try again later.",
        type: "warning",
        isOpen: true
      });
    }
  };

  const handleDelete = (id: string) => {
    setAlertConfig({
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action is permanent and will remove all their access.",
      type: "confirm",
      isOpen: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
          if (res.ok) {
            fetchUsers();
          } else {
            const err = await res.json();
            setAlertConfig({
              title: "Delete Failed",
              message: err.error || "Could not delete user.",
              type: "warning",
              isOpen: true
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  };


  const openEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "", // leave blank if not changing
      role: user.role
    });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8">
      <div className="fixed top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-600/10 blur-[120px] -z-10" />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-10 pb-6 border-b border-white/5 gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link 
              href="/"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter italic">
                {t('manage_users').split(' ')[0]} <span className="text-purple-500">{t('manage_users').split(' ')[1]}</span>
              </h1>
              <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-0.5 truncate">{t('accounts_permissions')}</p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              setEditingUser(null);
              setFormData({ name: "", email: "", password: "", role: "USER" });
              setIsModalOpen(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-900/20 active:scale-95"
          >
            <UserPlus size={16} />
            {t('add_new_user')}
          </button>
        </header>

        {/* User Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            <div className="col-span-full py-32 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-purple-500" size={40} />
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{t('loading_accounts')}</p>
            </div>
          ) : users.length > 0 ? (
            users.map(user => (
              <div key={user.id} className="p-5 bg-white/5 border border-white/10 rounded-[28px] hover:border-purple-500/30 transition-all group overflow-hidden relative">
                <div className="flex items-center justify-between mb-5">
                   <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 border border-white/5 group-hover:bg-purple-500/10 group-hover:text-purple-400 transition-all shrink-0">
                      <User size={20} />
                   </div>
                   <div className={`px-2.5 py-1 text-[8px] font-black rounded-lg border ${user.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'} uppercase tracking-widest`}>
                      {user.role}
                   </div>
                </div>
                
                <div className="mb-5">
                  <h3 className="text-base font-black text-white group-hover:text-purple-400 transition-colors truncate mb-0.5">{user.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-2 truncate">
                    <Mail size={12} className="text-slate-600" />
                    {user.email}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                   <div className="flex flex-col leading-none">
                      <span className="text-[7px] text-slate-600 font-black uppercase tracking-widest mb-1">{t('created_at_label')}</span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => openEdit(user)}
                        className="p-2.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/5"
                        title={t('edit_user')}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all border border-transparent hover:border-red-400/10"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-32 text-center bg-white/5 border border-dashed border-white/10 rounded-[32px]">
               <div className="flex flex-col items-center gap-4">
                  <User size={48} className="text-slate-800" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t('no_users_found')}</p>
               </div>
            </div>
          )}
        </div>

        {/* Manage User Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-8">
                 <h2 className="text-2xl font-bold text-white tracking-tight">{editingUser ? t('edit_user') : t('new_user_account')}</h2>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-all">
                    <X size={24} />
                 </button>
              </div>
              
               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('full_name')}</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-purple-500 transition-all font-medium"
                      placeholder="e.g. John Doe"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('email_address')}</label>
                    <input 
                      required
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-purple-500 transition-all font-medium"
                      placeholder="john@example.com"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('password_label')} {editingUser && '(Leave blank to keep)'}</label>
                    <input 
                      required={!editingUser}
                      type="password" 
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-purple-500 transition-all font-medium"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('role_label')}</label>
                    <select 
                      value={formData.role}
                       onChange={e => setFormData({...formData, role: e.target.value})}
                       className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-purple-500 transition-all font-medium appearance-none"
                    >
                       <option value="USER">{t('standard_user')}</option>
                       <option value="ADMIN">{t('system_admin')}</option>
                    </select>
                 </div>
                 
                  <button 
                    type="submit"
                    className="w-full py-5 mt-4 bg-gradient-to-tr from-purple-600 to-pink-600 text-white font-black rounded-2xl shadow-xl shadow-purple-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Check size={20} />
                    {editingUser ? t('update_account') : t('create_account')}
                  </button>
              </form>
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
        confirmText={alertConfig.type === 'confirm' ? t('confirm_delete') : 'OK'}
      />
    </div>

  );
}
