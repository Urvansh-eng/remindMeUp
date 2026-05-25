import { useState, useMemo, useEffect } from 'react';
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
import { parseISO, differenceInDays } from 'date-fns';

export type ViewState = 'dashboard' | 'calendar' | 'kanban' | 'resources' | 'ai' | 'project';

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
}

const initialTasks: Task[] = [];
const API_BASE = 'http://localhost:4000';

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

  // Fetch tasks from Supabase via the backend API
  const fetchTasks = async () => {
    try {
      const token = session?.access_token || 'dev-bypass-user-12345';
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
    const token = session.access_token || 'dev-bypass-user-12345';
    
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let targetUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
      
      if (targetUrl.startsWith('http://localhost:4000/api')) {
        init = init || {};
        init.headers = {
          ...init.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
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
      
      try {
        if (task.date) {
          const taskDate = parseISO(task.date);
          const daysUntilDue = differenceInDays(taskDate, MOCK_TODAY);
          isOverdue = daysUntilDue < 0 && !task.isCompleted;
          
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
      
      return { ...task, isHighRisk, isOverdue };
    });
  }, [tasks]);

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
    return <LoginView onBypass={(mockUser) => setSession({ user: mockUser })} />;
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
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
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

        {activeView === 'dashboard' && <DashboardView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />}
        {activeView === 'resources' && <ResourceVaultView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />}
        {activeView === 'kanban' && <KanbanView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />}
        {activeView === 'ai' && <AIAssistantView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onTaskCreated={fetchTasks} />}
        {activeView === 'calendar' && <CalendarView isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} onDayClick={handleOpenQuickAdd} tasks={tasksWithRisk} setTasks={setTasks} />}
        {activeView === 'project' && activeProjectId && (
          <KanbanView 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen} 
            projectId={activeProjectId}
            projectTitle={projects.find(p => p.id === activeProjectId)?.title} 
          />
        )}
      </div>

      <QuickAddModal 
        isOpen={isQuickAddOpen} 
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddInitialDate(undefined);
        }} 
        initialDate={quickAddInitialDate}
        onAddTask={handleAddTask}
      />
    </div>
  );
}

export default App;
