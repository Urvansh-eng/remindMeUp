import { useState, useMemo, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import CalendarView from './components/CalendarView';
import ResourceVaultView from './components/ResourceVaultView';
import AIAssistantView from './components/AIAssistantView';
import KanbanView from './components/KanbanView';
import QuickAddModal from './components/QuickAddModal';
import LoginView from './components/LoginView';
import { supabase } from './lib/supabaseClient';
import { AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import { parseISO, differenceInDays, format } from 'date-fns';
import SettingsView from './components/SettingsView';

export type ViewState = 'dashboard' | 'calendar' | 'kanban' | 'resources' | 'ai' | 'project' | 'settings';

export interface AppSettings {
  defaultReminderOffset: number;
  notificationSound: boolean;
  dndEnabled: boolean;
  dndFrom: string;
  dndUntil: string;
  reminderRepeat: "once" | "5min" | "10min";
  assistantLanguage: "english" | "hinglish" | "auto";
  voiceSensitivity: "low" | "medium" | "high";
  briefingTime: string;
  geminiStyle: "concise" | "detailed";
  weekStartDay: "sunday" | "monday";
  defaultPriority: "low" | "medium" | "high";
  defaultCategory: "work" | "personal" | "other";
  overdueTaskBehavior: "move" | "leave";
  theme: "light" | "dark" | "system";
  accentColor: "indigo" | "rose" | "emerald" | "amber" | "sky" | "purple";
  sidebarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultReminderOffset: 10,
  notificationSound: true,
  dndEnabled: false,
  dndFrom: "23:00",
  dndUntil: "07:00",
  reminderRepeat: "once",
  assistantLanguage: "auto",
  voiceSensitivity: "medium",
  briefingTime: "08:00",
  geminiStyle: "detailed",
  weekStartDay: "monday",
  defaultPriority: "medium",
  defaultCategory: "work",
  overdueTaskBehavior: "leave",
  theme: "system",
  accentColor: "indigo",
  sidebarCollapsed: false
};

export interface Project {
  id: string;
  title: string;
}

type Priority = 'Critical' | 'Important' | 'Optional';

export interface Task {
  id: number;
  title: string;
  date: string;
  priority: Priority;
  isAIPredicted?: boolean;
  category?: string;
  duration?: string;
  isHighRisk?: boolean;
  isCompleted?: boolean;
  isRescheduled?: boolean;
  isOverdue?: boolean;
  reminder_offset_minutes?: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  read: boolean;
  taskId?: number;
}

const initialTasks: Task[] = [];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const MOCK_TODAY = new Date('2026-06-15');

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialDate, setQuickAddInitialDate] = useState<string | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isRiskHubOpen, setIsRiskHubOpen] = useState(false);

  // Persistent Notification States
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('remindmeup_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [triggeredTaskIds, setTriggeredTaskIds] = useState<number[]>(() => {
    const saved = localStorage.getItem('remindmeup_triggered_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    localStorage.setItem('remindmeup_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('remindmeup_triggered_tasks', JSON.stringify(triggeredTaskIds));
  }, [triggeredTaskIds]);

  // Notification states & hooks
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });
  const [showPermissionWarning, setShowPermissionWarning] = useState(true);

  // Unified AppSettings state loaded from localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('remindmeup_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('remindmeup_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Synthetic notification chime sound generator
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playNote = (time: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + duration);
      };
      
      const now = ctx.currentTime;
      playNote(now, 880, 0.4); // A5
      playNote(now + 0.12, 1318.51, 0.6); // E6
    } catch (e) {
      console.error("Failed to play soft bell chime sound:", e);
    }
  };

  // Do Not Disturb range helper
  const isCurrentTimeInDND = (dndEnabled: boolean, from: string, until: string): boolean => {
    if (!dndEnabled || !from || !until) return false;
    
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    const [fromH, fromM] = from.split(':').map(Number);
    const [untilH, untilM] = until.split(':').map(Number);
    
    const fromTotalMinutes = fromH * 60 + fromM;
    const untilTotalMinutes = untilH * 60 + untilM;
    
    if (fromTotalMinutes <= untilTotalMinutes) {
      return currentTotalMinutes >= fromTotalMinutes && currentTotalMinutes <= untilTotalMinutes;
    } else {
      return currentTotalMinutes >= fromTotalMinutes || currentTotalMinutes <= untilTotalMinutes;
    }
  };

  // Theme Side-Effect
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (settings.theme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(systemDark ? 'dark' : 'light');
      } else {
        root.classList.add(settings.theme);
      }
    };

    applyTheme();

    if (settings.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  // Accent Color Side-Effect
  useEffect(() => {
    const colorMap: Record<string, string> = {
      indigo: '#6366f1',
      rose: '#f43f5e',
      emerald: '#10b981',
      amber: '#f59e0b',
      sky: '#0ea5e9',
      purple: '#a855f7'
    };
    const hex = colorMap[settings.accentColor] || '#6366f1';
    document.documentElement.style.setProperty('--accent-color', hex);
  }, [settings.accentColor]);

  // Sidebar Collapsed Side-Effect
  useEffect(() => {
    setIsSidebarOpen(!settings.sidebarCollapsed);
  }, [settings.sidebarCollapsed]);

  // Daily AI Briefing Scheduler Effect
  useEffect(() => {
    if (!settings.briefingTime) return;
    
    let timerId: number | undefined;
    
    const scheduleNextBriefing = () => {
      const [h, m] = settings.briefingTime.split(':').map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, 0, 0);
      
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      
      const delay = target.getTime() - now.getTime();
      console.log(`⏰ Daily AI briefing scheduled in ${Math.round(delay / 1000 / 60)} minutes (at ${settings.briefingTime}).`);
      
      timerId = window.setTimeout(() => {
        triggerAIBriefing();
        scheduleNextBriefing();
      }, delay);
    };

    const triggerAIBriefing = async () => {
      if (!session) return;
      try {
        console.log("🤖 Auto-generating daily AI briefing...");
        
        const newNotif: AppNotification = {
          id: `brief-${Date.now()}`,
          title: "🤖 Daily AI Briefing Prepared",
          message: "Your personalized schedule strategy is ready! Click to read your daily briefing.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'success',
          read: false
        };
        setNotifications(prev => [newNotif, ...prev]);
        
        if (settings.notificationSound) {
          playNotificationSound();
        }
      } catch (e) {
        console.error("Failed auto briefing trigger:", e);
      }
    };

    scheduleNextBriefing();
    return () => {
      if (timerId) window.clearTimeout(timerId);
    };
  }, [settings.briefingTime, session]);

  // Request browser Notification permissions on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setPermissionState(permission);
        });
      } else {
        setPermissionState(Notification.permission);
      }
    }
  }, []);

  // Listen to PWA navigation messages from service worker
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE_TASK') {
        const url = event.data.url;
        const match = url.match(/\/task\/(\d+)/);
        if (match) {
          setActiveView('dashboard');
          console.log("🚀 Navigating to task:", match[1]);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  // Map of active setTimeout reminder IDs keyed by task ID
  const reminderTimeoutsRef = useRef<Map<number, number>>(new Map());

  const scheduleTaskReminder = (task: Task) => {
    const existingTimeout = reminderTimeoutsRef.current.get(task.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      reminderTimeoutsRef.current.delete(task.id);
    }

    if (task.isCompleted || !task.date) return;

    try {
      const hasTime = task.date.includes('T');
      if (!hasTime) return; 

      const taskDate = parseISO(task.date);
      const now = new Date();

      const offsetMinutes = task.reminder_offset_minutes !== undefined ? task.reminder_offset_minutes : settings.defaultReminderOffset;
      const offsetMs = offsetMinutes * 60 * 1000;

      const reminderTime = taskDate.getTime() - offsetMs;
      const msUntilReminder = reminderTime - now.getTime();

      if (msUntilReminder <= 0) return;

      const timeoutId = window.setTimeout(async () => {
        const isMutedByDND = isCurrentTimeInDND(settings.dndEnabled, settings.dndFrom, settings.dndUntil);
        
        if (!isMutedByDND) {
          if (settings.notificationSound) {
            playNotificationSound();
          }

          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            try {
              const reg = await navigator.serviceWorker.ready;
              
              const options: any = {
                body: task.title,
                tag: `task-${task.id}`,
                requireInteraction: true,
                data: { 
                  taskId: task.id, 
                  url: `/task/${task.id}` 
                },
                actions: [
                  { action: 'open', title: 'Open Meeting' },
                  { action: 'dismiss', title: 'Dismiss' }
                ]
              };

              reg.showNotification('⏰ Meeting Starting Soon', options);
            } catch (e) {
              console.error('Failed to trigger PWA showNotification:', e);
            }
          } else if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏰ Meeting Starting Soon', {
              body: task.title,
              tag: `task-${task.id}`
            });
          }
          
          const notif: AppNotification = {
            id: `notif-${Date.now()}-${task.id}`,
            title: `⏰ Meeting Starting Soon`,
            message: `${task.title} starting in ${offsetMinutes} minutes.`,
            time: new Date().toISOString(),
            type: task.priority === 'Critical' ? 'critical' : 'warning',
            read: false,
            taskId: task.id
          };
          setNotifications(prev => [notif, ...prev].slice(0, 50));
          triggerToast(notif);
        } else {
          console.log(`🔇 Notification for "${task.title}" suppressed silently by Do Not Disturb rules.`);
        }

        // Handle repeat snooze recursive loops
        if (settings.reminderRepeat !== 'once' && !task.isCompleted) {
          const repeatMinutes = settings.reminderRepeat === '5min' ? 5 : 10;
          const repeatMs = repeatMinutes * 60 * 1000;
          
          const repeatTimeoutId = window.setTimeout(async () => {
            if (!task.isCompleted) {
              const stillMuted = isCurrentTimeInDND(settings.dndEnabled, settings.dndFrom, settings.dndUntil);
              if (!stillMuted) {
                if (settings.notificationSound) playNotificationSound();
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('⏰ Snoozed Reminder', { body: `Still pending: ${task.title}` });
                }
              }
            }
          }, repeatMs);
          reminderTimeoutsRef.current.set(task.id, repeatTimeoutId);
        } else {
          reminderTimeoutsRef.current.delete(task.id);
        }
      }, msUntilReminder);

      reminderTimeoutsRef.current.set(task.id, timeoutId);
    } catch (e) {
      console.error('Error scheduling reminder for task:', task.id, e);
    }
  };

  // Re-schedule all task reminders whenever tasks list or default offset is updated
  useEffect(() => {
    if (!session) return;
    
    reminderTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    reminderTimeoutsRef.current.clear();

    tasks.forEach(task => {
      scheduleTaskReminder(task);
    });

    return () => {
      reminderTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      reminderTimeoutsRef.current.clear();
    };
  }, [tasks, settings.defaultReminderOffset, settings.reminderRepeat, settings.dndEnabled, settings.dndFrom, settings.dndUntil, session]);

  const triggerPushNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  };

  const triggerToast = (notif: AppNotification) => {
    setActiveToasts(prev => [...prev, notif]);
    setTimeout(() => {
      setActiveToasts(prev => prev.filter(t => t.id !== notif.id));
    }, 8000);
  };

  // Complete a task from a notification action
  const handleCompleteTask = async (taskId: number) => {
    try {
      const token = session?.access_token;
      await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: true })
      });
      fetchTasks();
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
  };

  // Background Reminder Scheduler Loop
  useEffect(() => {
    if (!session || tasks.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      const newNotifications: AppNotification[] = [];
      const updatedTriggeredIds = [...triggeredTaskIds];
      let hasChanges = false;

      tasks.forEach(task => {
        if (task.isCompleted || updatedTriggeredIds.includes(task.id)) return;

        try {
          if (task.date) {
            const hasTime = task.date.includes('T');
            const taskDate = parseISO(task.date);

            if (hasTime) {
              const diffMs = taskDate.getTime() - now.getTime();
              const diffMins = Math.floor(diffMs / 60000);

              // Alert user if the task is due in the next 10 minutes or past due up to 30 mins
              if (diffMins <= 10 && diffMins >= -30) {
                const formattedTime = taskDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                
                const notif: AppNotification = {
                  id: `notif-${Date.now()}-${task.id}`,
                  title: `Task Alert: ${task.title}`,
                  message: `Task is due today at ${formattedTime}. Priority: ${task.priority}.`,
                  time: now.toISOString(),
                  type: task.priority === 'Critical' ? 'critical' : 'warning',
                  read: false,
                  taskId: task.id
                };

                newNotifications.push(notif);
                updatedTriggeredIds.push(task.id);
                hasChanges = true;

                triggerPushNotification(notif.title, notif.message);
                triggerToast(notif);
              }
            } else {
              // Date-only task: trigger daily alert in morning or when seen today
              const todayStr = format(now, 'yyyy-MM-dd');
              if (task.date.startsWith(todayStr)) {
                const notif: AppNotification = {
                  id: `notif-${Date.now()}-${task.id}`,
                  title: `Today's Task: ${task.title}`,
                  message: `This task is scheduled for today. Priority: ${task.priority}.`,
                  time: now.toISOString(),
                  type: 'info',
                  read: false,
                  taskId: task.id
                };

                newNotifications.push(notif);
                updatedTriggeredIds.push(task.id);
                hasChanges = true;

                triggerPushNotification(notif.title, notif.message);
                triggerToast(notif);
              }
            }
          }
        } catch (e) {
          console.error("Error evaluating notification checks:", e);
        }
      });

      if (hasChanges) {
        setNotifications(prev => [...newNotifications, ...prev].slice(0, 50));
        setTriggeredTaskIds(updatedTriggeredIds);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [tasks, session, triggeredTaskIds]);

  // Fetch tasks from Supabase via the backend API
  const fetchTasks = async () => {
    try {
      const token = session?.access_token;
      const res = await fetch(`${API_BASE}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.map((t: any) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        priority: t.priority || 'Important',
        category: t.category,
        duration: t.duration,
        isCompleted: t.completed,
      })));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  // Load tasks from DB once authenticated
  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session]);

  // Dynamic projects list starts clean
  const [projects, setProjects] = useState<Project[]>([]);

  // Authenticate session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Configure global fetch authorization interceptor
  useEffect(() => {
    if (!session) return;
    const token = session.access_token;
    
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let targetUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
      
      if (targetUrl.startsWith(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api`)) {
        init = init || {};
        const isFormData = init.body instanceof FormData;
        const newHeaders: Record<string, string> = {
          ...((init.headers as Record<string, string>) || {}),
          'Authorization': `Bearer ${token}`
        };
        if (!isFormData) {
          newHeaders['Content-Type'] = 'application/json';
        }
        init.headers = newHeaders;
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleViewChange = (view: ViewState, projectId?: string) => {
    setActiveView(view);
    if (view === 'project' && projectId) {
      setActiveProjectId(projectId);
    } else {
      setActiveProjectId(null);
    }
  };

  // Risk & Overdue Calculation Engine
  const tasksWithRisk = useMemo(() => {
    return tasks.map(task => {
      let isHighRisk = false;
      let isOverdue = false;
      let mappedDate = task.date;
      
      try {
        if (task.date) {
          const taskDate = parseISO(task.date);
          const daysUntilDue = differenceInDays(taskDate, MOCK_TODAY);
          isOverdue = daysUntilDue < 0 && !task.isCompleted;
          
          if (isOverdue && settings.overdueTaskBehavior === 'move') {
            const timePart = task.date.includes('T') ? `T${task.date.split('T')[1]}` : '';
            mappedDate = format(MOCK_TODAY, 'yyyy-MM-dd') + timePart;
          }
          
          let hours = 0;
          if (task.duration?.includes('h')) {
            hours = parseFloat(task.duration.replace('h', ''));
          } else if (task.duration?.includes('m')) {
            hours = parseFloat(task.duration.replace('m', '')) / 60;
          }
          
          if (hours >= 3 && daysUntilDue >= 0 && daysUntilDue < 25) {
            isHighRisk = true;
          }
        }
      } catch (e) {
        console.error("Invalid date for task:", task);
      }
      
      return { ...task, date: mappedDate, isHighRisk, isOverdue };
    });
  }, [tasks, settings.overdueTaskBehavior]);

  const highRiskTasks = tasksWithRisk.filter(t => t.isHighRisk);

  const handleOpenQuickAdd = (date?: string) => {
    setQuickAddInitialDate(date);
    setIsQuickAddOpen(true);
  };

  const handleAddTask = (_newTask: Omit<Task, 'id'>) => {
    // QuickAddModal already POSTs to the backend — just re-fetch from DB to stay in sync
    fetchTasks();
  };

  const handleReoptimize = () => {
    setTasks(prev => prev.map(t => ({...t, duration: t.duration?.includes('h') ? '1.5h' : t.duration })));
    setIsRiskHubOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] text-zinc-400">
        <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans selection:bg-brand-emerald/30">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        activeView={activeView}
        setActiveView={handleViewChange}
        onQuickAdd={() => handleOpenQuickAdd()}
        projects={projects}
        setProjects={setProjects}
        activeProjectId={activeProjectId}
        session={session}
        onLogout={handleLogout}
        onSettingsClick={() => handleViewChange('settings')}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {permissionState === 'denied' && showPermissionWarning && (
          <div className="bg-brand-crimson/10 border-b border-brand-crimson/30 px-6 py-2.5 flex items-center justify-between backdrop-blur-md z-40">
            <div className="flex items-center gap-2 text-xs text-brand-crimson font-semibold">
              <AlertTriangle size={14} />
              <span>Push notifications permission is blocked. Enable browser notifications to receive real-time task alerts and reminders!</span>
            </div>
            <button 
              onClick={() => setShowPermissionWarning(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Risk Analytics Hub Bottom Overlay */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {isRiskHubOpen && highRiskTasks.length > 0 && (
            <div className="mb-3 w-80 bg-zinc-900/95 backdrop-blur-xl border border-brand-crimson/30 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-brand-crimson/5">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-brand-crimson" />
                  Risk Analytics Hub
                </h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-brand-crimson/20 text-brand-crimson">
                  {highRiskTasks.length} issues
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto p-2">
                {highRiskTasks.map(t => (
                  <div key={t.id} className="p-3 mb-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
                    <p className="text-xs font-semibold text-zinc-200 truncate">{t.title}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Due {t.date} • Needs {t.duration}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-zinc-800 bg-zinc-950/50">
                <button
                  onClick={handleReoptimize}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-xs font-semibold transition-colors"
                >
                  <RefreshCw size={12} />
                  AI Re-optimize Schedule
                </button>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setIsRiskHubOpen(!isRiskHubOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all ${
              highRiskTasks.length > 0
                ? 'bg-brand-crimson/10 border-brand-crimson/40 text-brand-crimson hover:bg-brand-crimson/20'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            } backdrop-blur-md`}
          >
            <Activity size={14} />
            {highRiskTasks.length > 0 ? `${highRiskTasks.length} High Risk` : 'Schedule Healthy'}
          </button>
        </div>

        {activeView === 'dashboard' && (
          <DashboardView 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen} 
            notifications={notifications}
            setNotifications={setNotifications}
            onCompleteTask={handleCompleteTask}
          />
        )}
        {activeView === 'resources' && <ResourceVaultView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />}
        {activeView === 'kanban' && <KanbanView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />}
        {activeView === 'ai' && <AIAssistantView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onTaskCreated={fetchTasks} />}
        {activeView === 'calendar' && <CalendarView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onDayClick={handleOpenQuickAdd} tasks={tasksWithRisk} setTasks={setTasks} weekStartDay={settings.weekStartDay} />}
        {activeView === 'project' && activeProjectId && (
          <KanbanView 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen} 
            projectId={activeProjectId}
            projectTitle={projects.find(p => p.id === activeProjectId)?.title} 
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            session={session}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        )}
      </div>

      {/* Dynamic Slide-in Toast Notifications Overlay */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {activeToasts.map(toast => (
          <div 
            key={toast.id} 
            className="pointer-events-auto bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl p-4 flex gap-3 animate-in slide-in-from-left duration-300 w-80"
          >
            <div className={`w-2 rounded-full ${
              toast.type === 'critical' ? 'bg-brand-crimson' : 
              toast.type === 'warning' ? 'bg-brand-amber' : 
              toast.type === 'success' ? 'bg-brand-emerald' : 'bg-blue-500'
            }`} />
            <div className="flex-1 space-y-1">
              <p className="text-xs font-bold text-zinc-100">{toast.title}</p>
              <p className="text-[10px] text-zinc-400 leading-normal">{toast.message}</p>
              <div className="flex gap-2 mt-2 pt-1 border-t border-zinc-850">
                <button 
                  onClick={async () => {
                    if (toast.taskId) {
                      await handleCompleteTask(toast.taskId);
                    }
                    setActiveToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="text-[9px] font-bold text-brand-emerald hover:underline cursor-pointer"
                >
                  Mark Complete
                </button>
                <button 
                  onClick={() => {
                    setActiveToasts(prev => prev.filter(t => t.id !== toast.id));
                  }}
                  className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <QuickAddModal 
        isOpen={isQuickAddOpen} 
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddInitialDate(undefined);
        }} 
        initialDate={quickAddInitialDate}
        onAddTask={handleAddTask}
        defaultReminderOffset={settings.defaultReminderOffset}
        defaultPriority={settings.defaultPriority}
        defaultCategory={settings.defaultCategory}
      />
    </div>
  );
}

export default App;
