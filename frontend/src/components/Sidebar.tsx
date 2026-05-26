import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Settings, 
  PlusCircle, 
  LayoutDashboard, 
  Calendar,
  Bot,
  Library,
  Plus,
  LogOut
} from 'lucide-react';
import { ViewState, Project } from '../App';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeView: ViewState;
  setActiveView: (view: ViewState, projectId?: string) => void;
  onQuickAdd: () => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeProjectId: string | null;
  session: any;
  onLogout: () => void;
  onSettingsClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, setIsOpen, activeView, setActiveView, onQuickAdd, 
  projects, setProjects, activeProjectId, session, onLogout,
  onSettingsClick
}) => {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  if (!isOpen) return null;

  const handleAddProjectSubmit = () => {
    if (newProjectTitle.trim()) {
      const newProject: Project = {
        id: `p-${Date.now()}`,
        title: newProjectTitle.trim()
      };
      setProjects(prev => [...prev, newProject]);
      setNewProjectTitle('');
      setIsAddingProject(false);
    } else {
      setIsAddingProject(false);
    }
  };

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddProjectSubmit();
    } else if (e.key === 'Escape') {
      setIsAddingProject(false);
      setNewProjectTitle('');
    }
  };

  const user = session?.user;
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const rawAvatar = user?.user_metadata?.avatar_url;
  
  const avatarUrl = rawAvatar 
    ? (rawAvatar.includes('dicebear') ? rawAvatar : `https://wsrv.nl/?url=${encodeURIComponent(rawAvatar)}&w=150&h=150&fit=cover`) 
    : `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`;

  return (
    <aside className="w-[260px] flex-shrink-0 bg-zinc-900/50 border-r border-zinc-800/60 flex flex-col transition-all duration-300">
      <div className="p-4 flex items-center justify-between group">
        <span className="font-semibold text-sm text-zinc-100">Navigation</span>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 p-1.5 rounded-md transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="px-3 pb-4">
        <button 
          onClick={onQuickAdd}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-brand-emerald/10 text-brand-emerald hover:bg-brand-emerald/20 border border-brand-emerald/20 rounded-lg text-sm font-medium transition-all shadow-sm group"
        >
          <PlusCircle size={16} className="group-hover:scale-110 transition-transform" />
          Quick Add Task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 flex flex-col gap-6">
        <div>
          <div className="text-xs font-semibold text-zinc-500 px-3 mb-2 uppercase tracking-wider">Workspace</div>
          <nav className="flex flex-col gap-1">
            <button 
              onClick={() => setActiveView('dashboard')}
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={16} className={activeView === 'dashboard' ? 'text-zinc-100' : 'text-zinc-500'} />
              Today
            </button>
            <button 
              onClick={() => setActiveView('calendar')}
              className={`nav-item ${activeView === 'calendar' ? 'active' : ''}`}
            >
              <Calendar size={16} className={activeView === 'calendar' ? 'text-zinc-100' : 'text-zinc-500'} />
              Calendar
            </button>
            <button 
              onClick={() => setActiveView('kanban')}
              className={`nav-item ${activeView === 'kanban' ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeView === 'kanban' ? 'text-zinc-100' : 'text-zinc-500'}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
              Kanban Board
            </button>
            <button 
              onClick={() => setActiveView('resources')}
              className={`nav-item ${activeView === 'resources' ? 'active' : ''}`}
            >
              <Library size={16} className={activeView === 'resources' ? 'text-zinc-100' : 'text-zinc-500'} />
              Resource Vault
            </button>
            <button 
              onClick={() => setActiveView('ai')}
              className={`nav-item ${activeView === 'ai' ? 'active' : ''}`}
            >
              <Bot size={16} className={activeView === 'ai' ? 'text-blue-400' : 'text-zinc-500'} />
              AI Assistant
            </button>
            <button 
              onClick={() => setActiveView('settings')}
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            >
              <Settings size={16} className={activeView === 'settings' ? 'text-zinc-100' : 'text-zinc-500'} />
              Settings
            </button>
          </nav>
        </div>

        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Projects</div>
            <button 
              onClick={() => setIsAddingProject(true)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          
          <nav className="flex flex-col gap-1">
            {projects.map(project => (
              <button 
                key={project.id}
                onClick={() => setActiveView('project', project.id)}
                className={`nav-item group ${activeView === 'project' && activeProjectId === project.id ? 'active' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full transition-shadow ${activeView === 'project' && activeProjectId === project.id ? 'bg-brand-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600 group-hover:bg-zinc-400'}`}></span>
                <span className="truncate">{project.title}</span>
              </button>
            ))}
            
            {isAddingProject && (
              <div className="px-3 py-1">
                <input
                  autoFocus
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  onKeyDown={handleProjectKeyDown}
                  onBlur={handleAddProjectSubmit}
                  placeholder="Project name..."
                  className="w-full bg-zinc-900 border border-brand-emerald/50 rounded px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-brand-emerald/50"
                />
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Logged in User Profile Footer */}
      <div className="p-4 border-t border-zinc-800/60 mt-auto flex flex-col gap-3.5 bg-zinc-950/20">
        <div className="flex items-center gap-3">
          <img 
            src={avatarUrl} 
            alt={fullName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`;
            }}
            className="w-9 h-9 rounded-xl border border-zinc-700/80 object-cover shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-200 truncate leading-none mb-1">{fullName}</p>
            <p className="text-[10px] font-semibold text-zinc-500 truncate leading-none">{user?.email}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onSettingsClick}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 text-[11px] font-bold text-zinc-400 hover:text-zinc-100 transition-colors shadow-sm cursor-pointer"
          >
            <Settings size={13} />
            Settings
          </button>
          <button 
            onClick={onLogout}
            className="flex items-center justify-center p-2 rounded-lg border border-brand-crimson/20 bg-brand-crimson/5 hover:bg-brand-crimson/15 text-brand-crimson transition-colors shadow-sm cursor-pointer"
            title="Log Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
