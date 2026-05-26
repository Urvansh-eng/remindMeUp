import React, { useState, useEffect } from 'react';
import { X, Mic, Sparkles, Loader2 } from 'lucide-react';
import { Task } from '../App';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onAddTask?: (task: Omit<Task, 'id'>) => void;
  defaultReminderOffset?: number;
  defaultPriority?: "low" | "medium" | "high";
  defaultCategory?: "work" | "personal" | "other";
}

type Priority = 'Critical' | 'Important' | 'Optional';

const getMappedPriority = (p?: string): Priority => {
  if (p === 'low') return 'Optional';
  if (p === 'high') return 'Critical';
  return 'Important';
};

const getMappedCategory = (c?: string): string => {
  if (c === 'work') return 'Work';
  if (c === 'personal') return 'Personal';
  return 'General';
};

const QuickAddModal: React.FC<QuickAddModalProps> = ({ 
  isOpen, onClose, initialDate, onAddTask, defaultReminderOffset, defaultPriority, defaultCategory
}) => {
  const [nlpPrompt, setNlpPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('12:00');
  const [priority, setPriority] = useState<Priority>(getMappedPriority(defaultPriority));
  const [category, setCategory] = useState(getMappedCategory(defaultCategory));
  const [duration] = useState('1h');
  const [reminderOffset, setReminderOffset] = useState(defaultReminderOffset || 10);
  
  // UI states
  const [isParsing, setIsParsing] = useState(false);
  const [aiSuggestionMessage, setAiSuggestionMessage] = useState<string | null>(null);
  const [hasExtracted, setHasExtracted] = useState(false);

  // Sync state if initialDate or defaultReminderOffset changes
  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    if (defaultReminderOffset !== undefined) {
      setReminderOffset(defaultReminderOffset);
    }
  }, [defaultReminderOffset]);

  useEffect(() => {
    if (defaultPriority) {
      setPriority(getMappedPriority(defaultPriority));
    }
  }, [defaultPriority]);

  useEffect(() => {
    if (defaultCategory) {
      setCategory(getMappedCategory(defaultCategory));
    }
  }, [defaultCategory]);

  const handleAIParse = async () => {
    if (!nlpPrompt.trim()) return;

    setIsParsing(true);
    setAiSuggestionMessage(null);
    setHasExtracted(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || 'dev-bypass-user-12345';

      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: nlpPrompt })
      });

      const parsedData = await response.json();

      if (parsedData.error) throw new Error(parsedData.error);

      // Auto-populate all extracted values
      setTitle(parsedData.title || 'Meeting');
      setDate(parsedData.date || format(new Date(), 'yyyy-MM-dd'));
      setTime(parsedData.time || '12:00');
      setAiSuggestionMessage(parsedData.ai_reply);
      setHasExtracted(true);
      setCategory('AI Scheduler');

      // AI Smart Priority mapping
      const lowerTitle = (parsedData.title || '').toLowerCase();
      if (lowerTitle.includes('urgent') || lowerTitle.includes('exam') || lowerTitle.includes('deadline') || lowerTitle.includes('critical')) {
        setPriority('Critical');
      } else {
        setPriority('Important');
      }

    } catch (err) {
      console.error("AI Modal Parse Error:", err);
      setAiSuggestionMessage("Failed to connect to the scheduling assistant. Please adjust the prompt details manually below.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddTask = async () => {
    if (!title.trim()) return;
    
    const mergedDate = time ? `${date}T${time}:00` : date;
    const newTask = {
      title: title.trim(),
      date: mergedDate || format(new Date(), 'yyyy-MM-dd'),
      priority: priority,
      category: category,
      duration: duration,
      completed: false,
      reminder_offset_minutes: reminderOffset
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || 'dev-bypass-user-12345';

      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTask)
      });

      if (!response.ok) throw new Error("Failed to insert task to database");

      const savedTask = await response.json();

      if (onAddTask) {
        onAddTask(savedTask);
      }
    } catch (error) {
      console.error("Error saving task to database:", error);
    }
    
    // Reset state & close
    setNlpPrompt('');
    setTitle('');
    setAiSuggestionMessage(null);
    setHasExtracted(false);
    onClose();
  };

  const priorityColors = {
    Critical: 'bg-brand-crimson/10 text-brand-crimson border-brand-crimson/30 hover:bg-brand-crimson/20',
    Important: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20',
    Optional: 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-700',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/80">
          <h2 className="font-bold text-zinc-100 flex items-center gap-2.5">
            <Sparkles size={18} className="text-indigo-400 animate-pulse" />
            NLP Quick Add Task
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Natural Language Prompt Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Describe your task in English or Hinglish
            </label>
            <div className="relative flex gap-2">
              <input 
                autoFocus
                value={nlpPrompt}
                onChange={(e) => setNlpPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAIParse();
                  }
                }}
                placeholder="e.g., meeting hai 21 tarikh ko sham 5 baje client ke sath..." 
                className="w-full bg-zinc-950/40 border border-zinc-800/80 focus:border-indigo-500/50 rounded-xl px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors"
              />
              <button 
                type="button"
                onClick={handleAIParse}
                disabled={!nlpPrompt.trim() || isParsing}
                className="px-5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/10 transition-colors"
              >
                {isParsing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Extract
              </button>
            </div>
          </div>

          {/* AI Parsing status & suggestions */}
          {isParsing && (
            <div className="p-4 bg-zinc-950/30 border border-zinc-800/50 rounded-xl flex items-center gap-3 animate-pulse">
              <Loader2 size={16} className="text-indigo-400 animate-spin shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-300">Analyzing Hinglish prompt semantics...</p>
                <p className="text-[10px] text-zinc-500">Gemini model is extracting title, date boundaries, and times.</p>
              </div>
            </div>
          )}

          {aiSuggestionMessage && !isParsing && (
            <div className={`p-4 bg-indigo-500/5 border ${hasExtracted ? 'border-emerald-500/30' : 'border-indigo-500/20'} rounded-xl flex items-start gap-3.5 animate-in slide-in-from-top-1 duration-200`}>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-200">{aiSuggestionMessage}</p>
                <p className="text-[10px] text-zinc-500">Verify and adjust the auto-extracted parameters below before saving.</p>
              </div>
            </div>
          )}

          {/* Extracted / Editable Parameters Container */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/50">
            {/* Title Parameter */}
            <div className="grid grid-cols-3 items-center gap-4">
              <label className="text-xs font-semibold text-zinc-400">Extracted Title</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Click 'Extract' or type manually..."
                className="col-span-2 bg-zinc-950/20 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700 font-medium"
              />
            </div>

            {/* Date Parameter */}
            <div className="grid grid-cols-3 items-center gap-4">
              <label className="text-xs font-semibold text-zinc-400">Target Date</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="col-span-2 bg-zinc-950/20 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700 font-medium [color-scheme:dark]"
              />
            </div>

            {/* Time Parameter */}
            <div className="grid grid-cols-3 items-center gap-4">
              <label className="text-xs font-semibold text-zinc-400">Time</label>
              <input 
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="col-span-2 bg-zinc-950/20 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700 font-medium [color-scheme:dark]"
              />
            </div>

            {/* Priority Override Button Group */}
            <div className="grid grid-cols-3 items-start gap-4">
              <label className="text-xs font-semibold text-zinc-400 pt-2">Priority Level</label>
              <div className="col-span-2 flex gap-2">
                {(['Critical', 'Important', 'Optional'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-[11px] font-semibold transition-all ${
                      priority === p ? `${priorityColors[p]} ring-1 ring-white/5` : 'bg-transparent text-zinc-500 border-zinc-800 hover:bg-zinc-800/50'
                    }`}
                  >
                    {p === 'Critical' && <span className="w-1 h-1 rounded-full bg-brand-crimson"></span>}
                    {p === 'Important' && <span className="w-1 h-1 rounded-full bg-indigo-400"></span>}
                    {p === 'Optional' && <span className="w-1 h-1 rounded-full bg-zinc-500"></span>}
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reminder Offset Timing Slider */}
            <div className="grid grid-cols-3 items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-400">Reminder Timing</span>
                <span className="text-[9px] text-zinc-500 font-medium leading-none mt-1">Notify before task starts</span>
              </div>
              <div className="col-span-2 flex flex-col gap-2">
                <input 
                  type="range"
                  min="1"
                  max="60"
                  value={reminderOffset}
                  onChange={(e) => setReminderOffset(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] font-bold text-indigo-400">
                  Notify me {reminderOffset} minutes before
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-zinc-900/80 flex justify-between items-center border-t border-zinc-800/50">
          <button type="button" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Voice input">
            <Mic size={18} />
          </button>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleAddTask}
              disabled={!title.trim()}
              className="px-5 py-2 text-xs font-bold bg-brand-emerald disabled:opacity-40 disabled:hover:bg-brand-emerald text-zinc-950 hover:bg-brand-emerald/90 transition-colors rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={13} className="opacity-70" /> 
              Confirm & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
