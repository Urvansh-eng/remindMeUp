import React, { useState } from 'react';
import { Menu, ChevronLeft, ChevronRight, Trash2, Sparkles, CheckCircle2, AlertTriangle, Clock, Bot, RefreshCw, X } from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  parseISO,
  addDays
} from 'date-fns';

import { Task } from '../App';
type Priority = 'Critical' | 'Important' | 'Optional';

interface CalendarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDayClick?: (date: string) => void;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  weekStartDay?: 'sunday' | 'monday';
}

const CalendarView: React.FC<CalendarProps> = ({ 
  isSidebarOpen, setIsSidebarOpen, onDayClick, tasks, setTasks, weekStartDay = 'sunday' 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTaskText, setEditTaskText] = useState('');

  const weekStartsOn = weekStartDay === 'monday' ? 1 : 0;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn });
  const endDate = endOfWeek(monthEnd, { weekStartsOn });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = weekStartDay === 'monday'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleCellClick = (day: Date) => {
    if (onDayClick && !isOptimizing) {
      onDayClick(format(day, 'yyyy-MM-dd'));
    }
  };

  const handleTaskClick = (e: React.MouseEvent, taskId: number, title: string) => {
    e.stopPropagation();
    if (!isOptimizing) {
      setSelectedTask(taskId);
      setEditTaskText(title);
      setIsEditModalOpen(true);
    }
  };

  const handleModifyTask = () => {
    if (selectedTask !== null && editTaskText.trim()) {
      setTasks(prev => prev.map(t => t.id === selectedTask ? { ...t, title: editTaskText } : t));
      setIsEditModalOpen(false);
    }
  };

  const handleClearTask = () => {
    setEditTaskText('');
  };

  const handleDeleteTask = () => {
    if (selectedTask !== null) {
      setTasks(prev => prev.filter(t => t.id !== selectedTask));
      setIsEditModalOpen(false);
    }
  };

  const handlePriorityChange = (taskId: number, newPriority: Priority) => {
    setTasks(prevTasks => prevTasks.map(t => 
      t.id === taskId ? { ...t, priority: newPriority, isAIPredicted: false } : t
    ));
    setSelectedTask(null);
  };

  const handleOptimizeOverdue = () => {
    const overdueTasks = tasks.filter(t => t.isOverdue);
    if (overdueTasks.length === 0) return;

    setIsOptimizing(true);
    
    setTimeout(() => {
      setTasks(prevTasks => {
        let criticalOffset = 1;
        let importantOffset = 2;
        let optionalOffset = 3;

        return prevTasks.map(t => {
          if (t.isOverdue) {
            let newDateOffset = 1;
            if (t.priority === 'Critical') {
              newDateOffset = criticalOffset++;
            } else if (t.priority === 'Important') {
              newDateOffset = importantOffset++;
            } else {
              newDateOffset = optionalOffset++;
            }
            
            return {
              ...t,
              date: format(addDays(new Date(), newDateOffset), 'yyyy-MM-dd'),
              isOverdue: false,
              isRescheduled: true
            };
          }
          return t;
        });
      });
      setIsOptimizing(false);
      setToastMessage(`AI Balance Complete: ${overdueTasks.length} overdue tasks rescheduled. Workload distributed evenly across the next 48 hours to prevent fatigue.`);
      setTimeout(() => setToastMessage(null), 5000);
    }, 1500);
  };

  const priorityStyles = {
    Critical: {
      bg: 'bg-brand-crimson/10 border-brand-crimson/30 hover:border-brand-crimson/50 text-brand-crimson',
      dot: 'bg-brand-crimson',
      stripe: 'border-l-brand-crimson'
    },
    Important: {
      bg: 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400',
      dot: 'bg-indigo-400',
      stripe: 'border-l-indigo-400'
    },
    Optional: {
      bg: 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600 text-zinc-400',
      dot: 'bg-zinc-500',
      stripe: 'border-l-zinc-500'
    }
  };

  const hasOverdue = tasks.some(t => t.isOverdue);

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in duration-300 relative">
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
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
            Monthly Calendar
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {hasOverdue && (
            <button 
              onClick={handleOptimizeOverdue}
              disabled={isOptimizing}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-sm border ${
                isOptimizing 
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/40 text-indigo-300 hover:from-indigo-500/30 hover:to-purple-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              }`}
            >
              <Bot size={16} className={isOptimizing ? 'animate-pulse' : ''} />
              {isOptimizing ? 'Optimizing...' : 'Optimize Overdue Tasks'}
            </button>
          )}
          <div className="flex items-center gap-4 bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-1 shadow-sm">
            <button onClick={prevMonth} disabled={isOptimizing} className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium text-zinc-200 min-w-[120px] text-center">{format(currentDate, dateFormat)}</span>
            <button onClick={nextMonth} disabled={isOptimizing} className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"><ChevronRight size={18} /></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
        {/* Loading Overlay */}
        {isOptimizing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="flex flex-col items-center gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-indigo-500/30 shadow-2xl">
              <RefreshCw size={32} className="text-indigo-400 animate-spin" />
              <p className="text-sm font-semibold text-zinc-200">AI Recalculating Workload...</p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto w-full h-full flex flex-col bg-zinc-900/30 border border-zinc-800/60 rounded-xl overflow-hidden shadow-lg">
          
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b border-zinc-800/60 bg-zinc-900/50">
            {weekDays.map(day => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
            {days.map((day, idx) => {
              const cloneDay = day;
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDate = isSameDay(day, new Date());
              
              // Find tasks for this day
              const dayTasks = tasks.filter(task => isSameDay(parseISO(task.date), day));

              return (
                <div 
                  key={day.toString()}
                  onClick={() => handleCellClick(cloneDay)}
                  className={`
                    border-r border-b border-zinc-800/40 p-2 min-h-[100px] flex flex-col gap-1 cursor-pointer transition-colors group relative
                    ${!isCurrentMonth ? 'bg-zinc-950/40 opacity-60' : 'hover:bg-zinc-800/30'}
                    ${idx % 7 === 6 ? 'border-r-0' : ''}
                    ${isOptimizing ? 'animate-pulse opacity-80' : ''}
                  `}
                >
                  <div className="flex justify-end mb-1">
                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isTodayDate 
                        ? 'bg-brand-emerald text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                        : 'text-zinc-400 group-hover:text-zinc-200'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 overflow-y-auto scrollbar-hide z-10">
                    {dayTasks.map(task => {
                      const isSelected = selectedTask === task.id;
                      const style = priorityStyles[task.priority];
                      const isHighRisk = task.isHighRisk;
                      const isOverdue = task.isOverdue;
                      const isRescheduled = task.isRescheduled;

                      // Overdue Styles override
                      const finalStyle = isOverdue 
                        ? { bg: 'bg-red-950/30 border-red-900/50 text-red-300/80', stripe: 'border-l-red-900/50' }
                        : style;

                      return (
                        <div key={task.id} className="relative group/task">
                          <button
                            onClick={(e) => handleTaskClick(e, task.id, task.title)}
                            className={`w-full flex flex-col gap-1 text-left px-2 py-1.5 rounded-md border border-l-[3px] text-[10px] font-medium leading-tight transition-all ${finalStyle.bg} ${finalStyle.stripe} ${isSelected ? 'ring-1 ring-white/20 shadow-md' : ''} ${isHighRisk ? 'ring-1 ring-brand-crimson/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : ''}`}
                            title={isHighRisk ? '' : task.title}
                          >
                            <div className="flex items-start justify-between w-full">
                              <span className="truncate pr-1 flex-1 text-zinc-100 flex items-center gap-1">
                                {isOverdue && <Clock size={10} className="text-red-400 shrink-0" />}
                                {isHighRisk && !isOverdue && <AlertTriangle size={10} className="text-brand-crimson animate-pulse shrink-0" />}
                                {isRescheduled && !isOverdue && <RefreshCw size={10} className="text-indigo-400 shrink-0" />}
                                {task.title}
                              </span>
                              {task.isAIPredicted && !isHighRisk && !isOverdue && (
                                <span className="flex items-center gap-0.5 opacity-80 shrink-0 bg-black/20 px-1 py-0.5 rounded text-[8px] text-indigo-300">
                                  <Sparkles size={8} /> Auto
                                </span>
                              )}
                            </div>
                            {(task.category || task.duration) && (
                              <div className="flex items-center gap-2 text-[9px] opacity-70">
                                {task.category && <span className="truncate">{task.category}</span>}
                                {task.category && task.duration && <span>•</span>}
                                {task.duration && <span>{task.duration}</span>}
                              </div>
                            )}
                          </button>

                          {/* Hover Tooltips */}
                          {!isSelected && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/task:block z-30 w-56 pointer-events-none">
                              {isHighRisk && (
                                <div className="bg-zinc-900 border border-brand-crimson/30 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                  <div className="px-3 py-2 bg-brand-crimson/5 border-b border-brand-crimson/20">
                                    <span className="text-[10px] font-bold text-brand-crimson flex items-center gap-1.5">
                                      <AlertTriangle size={12} /> AI Pace Warning
                                    </span>
                                  </div>
                                  <div className="p-3 text-[10px] text-zinc-300 leading-relaxed">
                                    At your current pace and schedule density, you are projected to miss this deadline. Consider rescheduling or time-blocking open slots.
                                  </div>
                                </div>
                              )}
                              
                              {isRescheduled && !isOverdue && (
                                <div className="bg-zinc-900 border border-indigo-500/30 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 px-3 py-2">
                                  <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5">
                                    <RefreshCw size={12} /> Rescheduled by AI
                                  </span>
                                </div>
                              )}

                              {isOverdue && (
                                <div className="bg-zinc-900 border border-red-900/50 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 px-3 py-2">
                                  <span className="text-[10px] font-bold text-red-400 flex items-center gap-1.5">
                                    <Clock size={12} /> Task Overdue
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Edit/Delete & Priority Override Popover */}
                          {isSelected && (
                            <div 
                              className="absolute top-full left-0 mt-2 z-20 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-950/50">
                                Priority Level
                              </div>
                              <div className="p-1.5 space-y-0.5 border-b border-zinc-800">
                                {(['Critical', 'Important', 'Optional'] as Priority[]).map(p => (
                                  <button
                                    key={p}
                                    onClick={() => handlePriorityChange(task.id, p)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${task.priority === p ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full ${priorityStyles[p].dot}`} />
                                      {p}
                                    </div>
                                    {task.priority === p && <CheckCircle2 size={12} className="text-zinc-500" />}
                                  </button>
                                ))}
                              </div>

                              <div className="p-1">
                                <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-brand-crimson hover:bg-brand-crimson/10 transition-colors">
                                  <Trash2 size={12} /> Delete Task
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-6 right-6 z-50 bg-zinc-900 border border-indigo-500/30 text-zinc-200 px-5 py-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
          <CheckCircle2 className="text-indigo-400 shrink-0 mt-0.5" size={18} />
          <p className="text-xs font-medium leading-relaxed">{toastMessage}</p>
          <button onClick={() => setToastMessage(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      {/* Click outside popover to close */}
      {selectedTask && !isEditModalOpen && (
        <div className="absolute inset-0 z-10" onClick={() => setSelectedTask(null)} />
      )}

      {/* Edit/Manage Event Modal */}
      {isEditModalOpen && selectedTask !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100">Edit/Manage Event</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Task Title</label>
                <input 
                  type="text"
                  value={editTaskText}
                  onChange={(e) => setEditTaskText(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Task Description"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleModifyTask}
                className="w-full px-4 py-2 bg-indigo-500 text-white font-bold text-sm rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Save Changes
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleClearTask}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-sm rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Clear Text
                </button>
                <button 
                  onClick={handleDeleteTask}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-crimson/10 text-brand-crimson border border-brand-crimson/20 font-bold text-sm rounded-lg hover:bg-brand-crimson hover:text-white transition-colors"
                >
                  <Trash2 size={16} /> Delete Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
