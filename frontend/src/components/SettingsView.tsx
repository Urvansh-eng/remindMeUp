import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Bot, 
  Calendar, 
  Palette, 
  User, 
  Database, 
  Save, 
  ShieldAlert, 
  Download, 
  Loader2, 
  Check,
  AlertTriangle,
  Menu
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AppSettings } from '../App';

interface SettingsViewProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  session: any;
}

const ACCENT_PRESETS = [
  { name: 'Indigo', key: 'indigo', color: '#6366f1' },
  { name: 'Rose', key: 'rose', color: '#f43f5e' },
  { name: 'Emerald', key: 'emerald', color: '#10b981' },
  { name: 'Amber', key: 'amber', color: '#f59e0b' },
  { name: 'Sky', key: 'sky', color: '#0ea5e9' },
  { name: 'Purple', key: 'purple', color: '#a855f7' }
];

const SettingsView: React.FC<SettingsViewProps> = ({ 
  isSidebarOpen, 
  setIsSidebarOpen, 
  settings: _settings, 
  onUpdateSettings,
  session 
}) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const user = session?.user;
  const initialName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const initialAvatar = user?.user_metadata?.avatar_url || '';

  const defaultUnifiedSettings = {
    defaultReminderTiming: 10,
    notificationSound: true,
    dndHours: false,
    dndFrom: "23:00",
    dndUntil: "07:00",
    reminderRepeatInterval: "once",
    defaultPromptLanguage: "auto",
    voiceInputSensitivity: "medium",
    aiDailyBriefingTime: "08:00",
    geminiStyle: "detailed",
    weekStartDay: "monday",
    defaultPriority: "medium",
    defaultCategory: "work",
    overdueTaskBehavior: "leave",
    theme: "system",
    accentColor: "indigo",
    sidebarCollapsed: false,
    displayName: initialName,
    avatarUrl: initialAvatar,
    newPassword: '',
    confirmPassword: '',
    deleteConfirmText: ''
  };

  const [unifiedSettings, setUnifiedSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('remindmeup-settings');
      if (saved) {
        return { ...defaultUnifiedSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return defaultUnifiedSettings;
  });

  useEffect(() => {
    localStorage.setItem('remindmeup-settings', JSON.stringify(unifiedSettings));
    
    onUpdateSettings({
      defaultReminderOffset: unifiedSettings.defaultReminderTiming,
      notificationSound: unifiedSettings.notificationSound,
      dndEnabled: unifiedSettings.dndHours,
      dndFrom: unifiedSettings.dndFrom,
      dndUntil: unifiedSettings.dndUntil,
      reminderRepeat: unifiedSettings.reminderRepeatInterval as any,
      assistantLanguage: unifiedSettings.defaultPromptLanguage as any,
      voiceSensitivity: unifiedSettings.voiceInputSensitivity as any,
      briefingTime: unifiedSettings.aiDailyBriefingTime,
      geminiStyle: unifiedSettings.geminiStyle as any,
      weekStartDay: unifiedSettings.weekStartDay as any,
      defaultPriority: unifiedSettings.defaultPriority as any,
      defaultCategory: unifiedSettings.defaultCategory as any,
      overdueTaskBehavior: unifiedSettings.overdueTaskBehavior as any,
      theme: unifiedSettings.theme as any,
      accentColor: unifiedSettings.accentColor as any,
      sidebarCollapsed: unifiedSettings.sidebarCollapsed
    });
  }, [unifiedSettings, onUpdateSettings]);

  const handleSettingChange = (key: string, value: any) => {
    setUnifiedSettings((prev: any) => ({ ...prev, [key]: value }));
    triggerSaveToast('Settings saved successfully!');
  };

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearingTasks, setIsClearingTasks] = useState(false);
  const [supabaseRowCount, setSupabaseRowCount] = useState<number | null>(null);
  const [localStorageSizeKB, setLocalStorageSizeKB] = useState(0);

  useEffect(() => {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += (localStorage[key] || '').length * 2;
      }
    }
    setLocalStorageSizeKB(Math.round((total / 1024) * 10) / 10);

    const fetchSupabaseCount = async () => {
      try {
        const token = session?.access_token || 'dev-bypass-user-12345';
        const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) setSupabaseRowCount(data.length);
        }
      } catch (e) {
        console.error("Failed to fetch task count:", e);
      }
    };
    fetchSupabaseCount();
  }, [session]);

  const triggerSaveToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Profile Save handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: unifiedSettings.displayName, avatar_url: unifiedSettings.avatarUrl }
      });
      if (error) throw error;
      triggerSaveToast('Profile details updated successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Profile update failed: ${err.message}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Password Save handler
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (unifiedSettings.newPassword !== unifiedSettings.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (unifiedSettings.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: unifiedSettings.newPassword });
      if (error) throw error;
      triggerSaveToast('Password updated successfully!');
      handleSettingChange('newPassword', '');
      handleSettingChange('confirmPassword', '');
    } catch (err: any) {
      console.error(err);
      setPasswordError(err.message || 'Password update failed');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Delete Account execution
  const handleDeleteAccount = async () => {
    if (unifiedSettings.deleteConfirmText !== 'DELETE') return;
    
    setIsDeletingAccount(true);
    try {
      const token = session?.access_token || 'dev-bypass-user-12345';
      
      // Clear SQLite database tasks
      await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks/clear-all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Sign out
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error("Failed to delete account completely:", err);
      alert("Error deleting tasks from SQLite. Logging out directly.");
      await supabase.auth.signOut();
      window.location.reload();
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  // Task Clear handler
  const handleClearCompletedTasks = async () => {
    setIsClearingTasks(true);
    try {
      const token = session?.access_token || 'dev-bypass-user-12345';
      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks/completed`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        triggerSaveToast('Cleared all completed tasks successfully!');
        window.location.reload(); // Refresh to catch changes
      } else {
        throw new Error("Failed to clear tasks");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to clear completed tasks.");
    } finally {
      setIsClearingTasks(false);
      setShowClearConfirmModal(false);
    }
  };

  // Tasks Export engine
  const handleExportTasks = async (format: 'csv' | 'json') => {
    try {
      const token = session?.access_token || 'dev-bypass-user-12345';
      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to retrieve tasks");
      
      const tasks = await response.json();
      let blob: Blob;
      let filename = `remindmeup_tasks_${Date.now()}`;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
        filename += '.json';
      } else {
        // CSV convert
        const headers = ['ID', 'Title', 'Date', 'Priority', 'Category', 'Duration', 'Completed', 'Reminder Offset'];
        const rows = tasks.map((t: any) => [
          t.id,
          `"${t.title.replace(/"/g, '""')}"`,
          t.date || '',
          t.priority || '',
          t.category || '',
          t.duration || '',
          t.completed ? 'TRUE' : 'FALSE',
          t.reminder_offset_minutes !== undefined ? t.reminder_offset_minutes : ''
        ]);
        const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename += '.csv';
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to export tasks:", e);
      alert("Error exporting tasks.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#09090b]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-950/20 flex items-center gap-3">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-md hover:bg-zinc-800/60 transition-colors mr-2 cursor-pointer"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Palette className="text-accent w-4 h-4" />
          Settings
        </h1>
        <p className="text-xs text-zinc-500 font-medium hidden md:inline">• Customize your workspace, AI assistant, and layouts</p>
      </header>

      {/* Main Settings Form Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-12 max-w-4xl scrollbar-hide">
        
        {/* SECTION 1: NOTIFICATIONS */}
        <section className="space-y-6">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Bell className="text-accent w-4 h-4" />
              Notifications
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Configure your real-time timing offsets, chime alerts, and DND parameters.</p>
          </div>

          <div className="space-y-6">
            {/* Setting 1: Default Reminder Time Slider */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-zinc-200 block">Default Reminder Timing</label>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">Pre-fills the reminder timing offset slider when creating tasks.</span>
                </div>
                <span className="text-xs font-bold text-accent">{unifiedSettings.defaultReminderTiming} mins before</span>
              </div>
              <input 
                type="range"
                min="1"
                max="60"
                value={unifiedSettings.defaultReminderTiming}
                onChange={(e) => handleSettingChange('defaultReminderTiming', parseInt(e.target.value, 10))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none"
              />
            </div>

            {/* Setting 2: Notification Sound Toggle */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Notification Sound</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Play a sweet, high-pitched chime synth when task alerts trigger.</span>
              </div>
              <button 
                onClick={() => handleSettingChange('notificationSound', !unifiedSettings.notificationSound)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 cursor-pointer focus:outline-none ${unifiedSettings.notificationSound ? 'bg-accent' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-zinc-950 transition-transform duration-200 ${unifiedSettings.notificationSound ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Setting 3: Do Not Disturb time range pickers */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-zinc-200 block">Do Not Disturb (DND) Hours</label>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">Silence all operating system and sound push reminders during this range.</span>
                </div>
                <button 
                  onClick={() => handleSettingChange('dndHours', !unifiedSettings.dndHours)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 cursor-pointer focus:outline-none ${unifiedSettings.dndHours ? 'bg-accent' : 'bg-zinc-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-zinc-950 transition-transform duration-200 ${unifiedSettings.dndHours ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              
              {unifiedSettings.dndHours && (
                <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">From</span>
                    <input 
                      type="time"
                      value={unifiedSettings.dndFrom}
                      onChange={(e) => handleSettingChange('dndFrom', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-semibold text-zinc-200 outline-none focus:border-zinc-700 [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">Until</span>
                    <input 
                      type="time"
                      value={unifiedSettings.dndUntil}
                      onChange={(e) => handleSettingChange('dndUntil', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-semibold text-zinc-200 outline-none focus:border-zinc-700 [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Setting 4: Reminder Repeat */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Reminder Repeat intervals</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Snooze / re-schedule notifications until the task is clicked or completed.</span>
              </div>
              <div className="flex gap-2">
                {(['once', '5min', '10min'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleSettingChange('reminderRepeatInterval', r)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.reminderRepeatInterval === r 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {r === 'once' ? 'Notify once' : r === '5min' ? 'Every 5 min' : 'Every 10 min'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: AI ASSISTANT */}
        <section className="space-y-6">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Bot className="text-accent w-4 h-4" />
              AI Assistant & Speech
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Refine Gemini parsing heuristics, daily automated briefings, and speech parameters.</p>
          </div>

          <div className="space-y-6">
            {/* Setting 5: Default Heuristic Language */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Default Prompt Language Heuristic</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Instructs the AI voice processor and scheduler to align to this system.</span>
              </div>
              <div className="flex gap-2">
                {(['english', 'hinglish', 'auto'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleSettingChange('defaultPromptLanguage', l)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.defaultPromptLanguage === l 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {l === 'auto' ? 'Auto-detect' : l}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 6: Voice sensitivity */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Voice Input Sensitivity</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Adjust noise filtering sensitivity boundaries inside AIAssistantView.</span>
              </div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSettingChange('voiceInputSensitivity', s)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.voiceInputSensitivity === s 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 7: AI Daily Briefing Time */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">AI Daily Briefing Time</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Automate schedules to build your summary briefing checklist daily at this hour.</span>
              </div>
              <input 
                type="time"
                value={unifiedSettings.aiDailyBriefingTime}
                onChange={(e) => handleSettingChange('aiDailyBriefingTime', e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs font-semibold text-zinc-200 outline-none focus:border-zinc-700 w-32 [color-scheme:dark]"
              />
            </div>

            {/* Setting 8: Gemini Response Style */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Gemini AI response output style</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Appends thorough structure formats or limits lines to less than 3 sentences.</span>
              </div>
              <div className="flex gap-2">
                {(['concise', 'detailed'] as const).map((sty) => (
                  <button
                    key={sty}
                    onClick={() => handleSettingChange('geminiStyle', sty)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.geminiStyle === sty 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {sty}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: CALENDAR & TASKS */}
        <section className="space-y-6">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Calendar className="text-accent w-4 h-4" />
              Calendar & Task Behavior
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Configure default category types, starting days, and overdue task movements.</p>
          </div>

          <div className="space-y-6">
            {/* Setting 9: Week Start Day */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Week Start Day</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Shifts the grid columns in CalendarView corresponding to your choice.</span>
              </div>
              <div className="flex gap-2">
                {(['sunday', 'monday'] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => handleSettingChange('weekStartDay', w)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.weekStartDay === w 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 10: Default Task Priority */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Default Task Priority</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Pre-selects this standard priority value in QuickAddModal.</span>
              </div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSettingChange('defaultPriority', p)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.defaultPriority === p 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 11: Default Task Category */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Default Task Category</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Auto-fills the workspace category when adding tasks manually.</span>
              </div>
              <div className="flex gap-2">
                {(['work', 'personal', 'other'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleSettingChange('defaultCategory', cat)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.defaultCategory === cat 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 12: Overdue Task Behavior */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Overdue Task Behavior</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Decide whether uncompleted past tasks automatically move to Today.</span>
              </div>
              <div className="flex gap-2">
                {(['move', 'leave'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => handleSettingChange('overdueTaskBehavior', b)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.overdueTaskBehavior === b 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {b === 'move' ? 'Auto-move to today' : 'Leave in original date'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: APPEARANCE */}
        <section className="space-y-6">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Palette className="text-accent w-4 h-4" />
              Appearance & Styles
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Design theme toggles, custom accent color presets, and initial collapsed views.</p>
          </div>

          <div className="space-y-6">
            {/* Setting 13: Theme */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">App Visual Theme</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Toggle light or dark modes, or adapt to the native system configuration.</span>
              </div>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleSettingChange('theme', t)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all capitalize cursor-pointer ${
                      unifiedSettings.theme === t 
                        ? 'bg-accent-translucent border-accent text-accent' 
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 14: Accent ColorPresets */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Accent Color highlights</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Adjust all interactive states, buttons, glow rings, and tags to match your choice.</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handleSettingChange('accentColor', preset.key as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                      unifiedSettings.accentColor === preset.key 
                        ? 'bg-zinc-900 border-zinc-700 shadow-md scale-105' 
                        : 'bg-zinc-950/40 border-zinc-800/40 text-zinc-400 hover:bg-zinc-800/40'
                    }`}
                  >
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-zinc-700/50" 
                      style={{ backgroundColor: preset.color }}
                    />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Setting 15: Sidebar Collapsed By Default */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Sidebar Collapsed on Load</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Launches the workspace with a space-saving sidebar panel.</span>
              </div>
              <button 
                onClick={() => handleSettingChange('sidebarCollapsed', !unifiedSettings.sidebarCollapsed)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 cursor-pointer focus:outline-none ${unifiedSettings.sidebarCollapsed ? 'bg-accent' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-zinc-950 transition-transform duration-200 ${unifiedSettings.sidebarCollapsed ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 5: ACCOUNT */}
        <section className="space-y-6">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <User className="text-accent w-4 h-4" />
              Account & Profile
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Manage Supabase Cloud authorization details, credentials, and user data fields.</p>
          </div>

          <div className="space-y-6">
            {/* Setting 16: Profile updates */}
            <form onSubmit={handleUpdateProfile} className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-4">
              <div className="text-xs font-bold text-zinc-200 block border-b border-zinc-850 pb-2">Profile Information</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Display Name</span>
                  <input 
                    type="text"
                    value={unifiedSettings.displayName}
                    onChange={(e) => handleSettingChange('displayName', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                    placeholder="E.g., Urvansh"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Avatar URL</span>
                  <input 
                    type="text"
                    value={unifiedSettings.avatarUrl}
                    onChange={(e) => handleSettingChange('avatarUrl', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                    placeholder="HTTPS image address..."
                  />
                </div>
              </div>
              <div className="text-right">
                <button 
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 py-2 bg-accent text-zinc-950 hover:opacity-90 disabled:opacity-50 transition-all rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 ml-auto"
                >
                  {isUpdatingProfile ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Profile Changes
                </button>
              </div>
            </form>

            {/* Setting 17: Change Password */}
            <form onSubmit={handleUpdatePassword} className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-4">
              <div className="text-xs font-bold text-zinc-200 block border-b border-zinc-850 pb-2">Change Account Password</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">New Password</span>
                  <input 
                    type="password"
                    value={unifiedSettings.newPassword}
                    onChange={(e) => handleSettingChange('newPassword', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                    placeholder="Min 6 characters..."
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Confirm Password</span>
                  <input 
                    type="password"
                    value={unifiedSettings.confirmPassword}
                    onChange={(e) => handleSettingChange('confirmPassword', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                    placeholder="Retype password..."
                  />
                </div>
              </div>
              {passwordError && <p className="text-[10px] text-brand-crimson font-bold">{passwordError}</p>}
              <div className="text-right">
                <button 
                  type="submit"
                  disabled={isUpdatingPassword || !unifiedSettings.newPassword}
                  className="px-4 py-2 bg-accent text-zinc-950 hover:opacity-90 disabled:opacity-50 transition-all rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 ml-auto"
                >
                  {isUpdatingPassword ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Update Password
                </button>
              </div>
            </form>

            {/* Setting 18: Delete Account (Danger Zone) */}
            <div className="bg-brand-crimson/5 border border-brand-crimson/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-crimson border-b border-brand-crimson/20 pb-2">
                <ShieldAlert size={14} />
                Danger Zone: Terminate Account
              </div>
              <p className="text-[10px] text-zinc-400 leading-normal">
                This action is permanent. Deleting your account will securely wipe all tasks from your SQLite local database, terminate Supabase cloud sessions, and clear configurations.
              </p>
              <button 
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-brand-crimson/10 border border-brand-crimson/40 hover:bg-brand-crimson/25 text-brand-crimson rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Delete My Account
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 6: DATA */}
        <section className="space-y-6">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Database className="text-accent w-4 h-4" />
              Data & Storage Diagnostics
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Export your structured list backups, clear local completed cache, and check quota limits.</p>
          </div>

          <div className="space-y-6">
            {/* Setting 19: Export Tasks */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Export Tasks Backups</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Download a fully formatted CSV or structured JSON checklist package.</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleExportTasks('csv')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-colors shadow-sm cursor-pointer"
                >
                  <Download size={13} />
                  Export as CSV
                </button>
                <button 
                  onClick={() => handleExportTasks('json')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-colors shadow-sm cursor-pointer"
                >
                  <Download size={13} />
                  Export as JSON
                </button>
              </div>
            </div>

            {/* Setting 20: Clear Completed Tasks */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">Clear Completed Tasks</label>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Securely scrub finished task entries from your SQLite local cache.</span>
              </div>
              <button 
                onClick={() => setShowClearConfirmModal(true)}
                className="px-4 py-2 bg-brand-crimson/10 border border-brand-crimson/35 hover:bg-brand-crimson/20 text-brand-crimson rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Clear Completed Tasks
              </button>
            </div>

            {/* Setting 21: Storage Diagnostics */}
            <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-5 space-y-4">
              <label className="text-xs font-bold text-zinc-200 block">Workspace Diagnostics & Row Counts</label>
              
              <div className="space-y-3">
                {/* LocalStorage quota */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                    <span>Browser Local Storage Allocation</span>
                    <span className="text-accent">{localStorageSizeKB} KB / 5120 KB</span>
                  </div>
                  <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-accent h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((localStorageSizeKB / 5120) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* SQLite / Supabase quota row counts */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                    <span>Active SQLite / Supabase Synced Task Rows</span>
                    <span className="text-indigo-400">{supabaseRowCount !== null ? `${supabaseRowCount} items` : 'Measuring...'}</span>
                  </div>
                  <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(((supabaseRowCount || 0) / 100) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* POPUP: Global Save confirmation Snackbar */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-brand-emerald/40 text-brand-emerald rounded-full px-5 py-2 flex items-center gap-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Check size={14} className="bg-brand-emerald/10 p-0.5 rounded-full" />
          <span className="text-xs font-bold text-zinc-200">{toastMessage}</span>
        </div>
      )}

      {/* MODAL: Clear completed tasks confirmation */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="text-brand-amber w-4 h-4" />
              Clear Completed Tasks?
            </h3>
            <p className="text-xs text-zinc-400 leading-normal">
              Are you sure you want to permanently delete all completed tasks from SQLite? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button 
                onClick={() => setShowClearConfirmModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 text-xs font-medium hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearCompletedTasks}
                disabled={isClearingTasks}
                className="px-4 py-1.5 rounded-lg bg-brand-crimson text-white text-xs font-bold hover:bg-brand-crimson/90 transition-colors cursor-pointer flex items-center gap-1"
              >
                {isClearingTasks && <Loader2 size={12} className="animate-spin" />}
                Delete Permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Account validation confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-brand-crimson/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-sm font-bold text-brand-crimson flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Terminate Account Forever?
            </h3>
            <p className="text-[11px] text-zinc-400 leading-normal">
              This action is permanent and deletes all your tasks from local storage and SQLite. To confirm, please type <strong className="text-zinc-200">DELETE</strong> in the box below:
            </p>
            <input 
              type="text"
              value={unifiedSettings.deleteConfirmText}
              onChange={(e) => handleSettingChange('deleteConfirmText', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-none text-center font-bold tracking-wider"
              placeholder="Type DELETE..."
            />
            <div className="flex gap-2 justify-end pt-2">
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  handleSettingChange('deleteConfirmText', '');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 text-xs font-medium hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={unifiedSettings.deleteConfirmText !== 'DELETE' || isDeletingAccount}
                className="px-4 py-1.5 rounded-lg bg-brand-crimson disabled:opacity-40 text-white text-xs font-bold hover:bg-brand-crimson/90 transition-colors cursor-pointer flex items-center gap-1"
              >
                {isDeletingAccount && <Loader2 size={12} className="animate-spin" />}
                Confirm Terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
