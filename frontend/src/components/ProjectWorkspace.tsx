import React, { useState } from 'react';
import { Menu, Plus, CheckCircle2, Circle, Trash2, Layout } from 'lucide-react';
import { Project } from '../App';

interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  completed: boolean;
}

interface ProjectWorkspaceProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  project: Project;
}

// Simulated persistent state for all project tasks in this mock environment
let globalProjectTasks: ProjectTask[] = [
  { id: 't1', projectId: 'p1', title: 'Setup Tailwind configuration', completed: true },
  { id: 't2', projectId: 'p1', title: 'Design component library', completed: false }
];

const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ isSidebarOpen, setIsSidebarOpen, project }) => {
  const [tasks, setTasks] = useState<ProjectTask[]>(
    globalProjectTasks.filter(t => t.projectId === project.id)
  );
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const syncGlobalTasks = (newTasks: ProjectTask[]) => {
    setTasks(newTasks);
    // Update global reference mock
    const otherTasks = globalProjectTasks.filter(t => t.projectId !== project.id);
    globalProjectTasks = [...otherTasks, ...newTasks];
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: ProjectTask = {
      id: `pt-${Date.now()}`,
      projectId: project.id,
      title: newTaskTitle.trim(),
      completed: false
    };

    syncGlobalTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const toggleTask = (taskId: string) => {
    syncGlobalTasks(
      tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    );
  };

  const deleteTask = (taskId: string) => {
    syncGlobalTasks(tasks.filter(t => t.id !== taskId));
  };

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in duration-300 relative bg-[#09090b]">
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center bg-zinc-900 border border-zinc-800`}>
              <Layout size={16} className={`text-zinc-400`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                {project.title}
              </h1>
              <p className="text-xs text-zinc-500 font-medium">Project Workspace</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar flex justify-center">
        <div className="w-full max-w-3xl">
          {/* Add Task Input */}
          <form onSubmit={handleAddTask} className="mb-8 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Plus size={18} className="text-zinc-500 group-focus-within:text-brand-emerald transition-colors" />
            </div>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a new task to this project... (Press Enter)"
              className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl py-3.5 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-brand-emerald/50 focus:bg-zinc-900 transition-all shadow-sm"
            />
          </form>

          {/* Task List */}
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-12 px-4 border border-zinc-800/40 border-dashed rounded-xl bg-zinc-900/20">
                <Layout size={32} className="mx-auto text-zinc-600 mb-3" />
                <h3 className="text-zinc-300 font-medium text-sm mb-1">No tasks yet</h3>
                <p className="text-zinc-500 text-xs">Start building your project by adding some tasks above.</p>
              </div>
            ) : (
              tasks.map(task => (
                <div 
                  key={task.id}
                  className="group flex items-center justify-between p-3.5 bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/50 hover:border-zinc-700/80 rounded-lg transition-all animate-in slide-in-from-bottom-2 duration-200"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <button 
                      onClick={() => toggleTask(task.id)}
                      className="text-zinc-500 hover:text-brand-emerald transition-colors shrink-0 focus:outline-none"
                    >
                      {task.completed ? (
                        <CheckCircle2 size={18} className="text-brand-emerald" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                    <span className={`text-sm truncate transition-colors ${task.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                      {task.title}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-brand-crimson hover:bg-brand-crimson/10 rounded-md transition-all shrink-0"
                    title="Delete task"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectWorkspace;
