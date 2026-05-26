import React, { useState, useEffect } from 'react';
import { Menu, Plus, MoreHorizontal, MessageSquare, Paperclip, Clock, AlignLeft, Edit2, Trash2, X, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { parseISO, differenceInDays, addDays, format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';

const MOCK_TODAY = new Date('2026-06-15');

interface KanbanProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  projectId?: string;
  projectTitle?: string;
}

interface Card {
  id: string;
  title: string;
  priority: 'Critical' | 'Important' | 'Optional';
  comments?: number;
  attachments?: number;
  dueDate?: string;
  isCompleted?: boolean;
  category?: string;
}

interface Column {
  id: string;
  title: string;
  accent: 'amber' | 'emerald' | 'charcoal' | 'custom';
  cards: Card[];
}

const initialColumns: Column[] = [
  {
    id: 'col-1',
    title: 'Today',
    accent: 'amber',
    cards: []
  },
  {
    id: 'col-2',
    title: 'This Week',
    accent: 'emerald',
    cards: []
  },
  {
    id: 'col-3',
    title: 'Later',
    accent: 'charcoal',
    cards: []
  }
];

const accentColors = {
  amber: 'text-brand-amber border-brand-amber/30 bg-brand-amber/10',
  emerald: 'text-brand-emerald border-brand-emerald/30 bg-brand-emerald/10',
  charcoal: 'text-zinc-400 border-zinc-700/50 bg-zinc-800/50',
  custom: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10'
};

const priorityStyles = {
  Critical: 'bg-brand-crimson',
  Important: 'bg-indigo-400',
  Optional: 'bg-zinc-500'
};

const getInitialColumns = (): Column[] => JSON.parse(JSON.stringify(initialColumns));
const getEmptyProjectColumns = (): Column[] => {
  return getInitialColumns().map(col => ({ ...col, cards: [] }));
};

let globalProjectBoards: Record<string, Column[]> = {};
let globalBoard: Column[] = getInitialColumns();

const KanbanView: React.FC<KanbanProps> = ({ isSidebarOpen, setIsSidebarOpen, projectId, projectTitle }) => {
  const [columnsState, setColumnsState] = useState<Column[]>(
    projectId 
      ? (globalProjectBoards[projectId] || getEmptyProjectColumns())
      : globalBoard
  );

  const setColumns = (updater: React.SetStateAction<Column[]>) => {
    setColumnsState(prev => {
      const newCols = typeof updater === 'function' ? updater(prev) : updater;
      if (projectId) {
        globalProjectBoards[projectId] = newCols;
      } else {
        globalBoard = newCols;
      }
      return newCols;
    });
  };

  const loadTasks = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const col1: Card[] = [];
        const col2: Card[] = [];
        const col3: Card[] = [];
        
        data.forEach((task: any) => {
          // Isolate project tasks from global Kanban board tasks
          if (projectId) {
            // Project view: only include tasks created under this project
            if (task.category !== projectTitle) return;
          }

          const card: Card = {
            id: String(task.id),
            title: task.title,
            priority: task.priority || 'Optional',
            dueDate: task.date,
            isCompleted: task.completed,
            category: task.category
          };
          
          if (!task.date) {
            col3.push(card);
            return;
          }
          
          try {
            const taskDate = parseISO(task.date);
            const daysDiff = differenceInDays(taskDate, MOCK_TODAY);
            
            if (daysDiff === 0) {
              col1.push(card);
            } else if (daysDiff > 0 && daysDiff <= 7) {
              col2.push(card);
            } else {
              col3.push(card);
            }
          } catch (e) {
            col3.push(card);
          }
        });
        
        const sortCards = (cards: Card[]) => {
          return cards.sort((a, b) => {
            if (a.isCompleted && !b.isCompleted) return 1;
            if (!a.isCompleted && b.isCompleted) return -1;
            return 0;
          });
        };

        setColumnsState([
          { id: 'col-1', title: 'Today', accent: 'amber', cards: sortCards(col1) },
          { id: 'col-2', title: 'This Week', accent: 'emerald', cards: sortCards(col2) },
          { id: 'col-3', title: 'Later', accent: 'charcoal', cards: sortCards(col3) }
        ]);
      }
    } catch (error) {
      console.error("Failed to load tasks for Kanban:", error);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  const handleAddCard = async (colId: string) => {
    if (!newCardTitle.trim()) {
      setAddingToCol(null);
      return;
    }

    let targetDate = format(MOCK_TODAY, 'yyyy-MM-dd');
    if (colId === 'col-2') {
      targetDate = format(addDays(MOCK_TODAY, 3), 'yyyy-MM-dd');
    } else if (colId === 'col-3') {
      targetDate = format(addDays(MOCK_TODAY, 10), 'yyyy-MM-dd');
    }

    const newTask = {
      title: newCardTitle,
      priority: 'Optional',
      date: targetDate,
      completed: false,
      duration: '1h',
      category: projectTitle || 'General'
    };

    try {
      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTask)
      });
      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error("Failed to add Kanban card:", error);
    }
    
    setNewCardTitle('');
    setAddingToCol(null);
  };

  const handleAddList = () => {
    if (!newListTitle.trim()) {
      setAddingList(false);
      return;
    }
    setColumns(prev => [
      ...prev, 
      { id: `col-${Date.now()}`, title: newListTitle, accent: 'custom', cards: [] }
    ]);
    setNewListTitle('');
    setAddingList(false);
  };

  const toggleCardCompletion = async (colId: string, cardId: string) => {
    let currentCard: Card | null = null;
    columnsState.forEach(col => {
      const card = col.cards.find(c => c.id === cardId);
      if (card) currentCard = card;
    });

    if (!currentCard) return;

    const newCompleted = !(currentCard as Card).isCompleted;

    setColumnsState(prev => prev.map(col => {
      if (col.id === colId) {
        return {
          ...col,
          cards: col.cards.map(c => c.id === cardId ? { ...c, isCompleted: newCompleted } : c)
        };
      }
      return col;
    }));

    try {
      await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks/${cardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ completed: newCompleted })
      });
      loadTasks();
    } catch (error) {
      console.error("Failed to toggle card completion:", error);
      loadTasks();
    }
  };

  const handleKeyDownCard = (e: React.KeyboardEvent, colId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCard(colId);
    } else if (e.key === 'Escape') {
      setAddingToCol(null);
      setNewCardTitle('');
    }
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddList();
    } else if (e.key === 'Escape') {
      setAddingList(false);
      setNewListTitle('');
    }
  };

  const [draggedCard, setDraggedCard] = useState<{ cardId: string, colId: string } | null>(null);
  const [activeMenuColId, setActiveMenuColId] = useState<string | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [clearingColId, setClearingColId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, cardId: string, colId: string) => {
    setDraggedCard({ cardId, colId });
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedCard(null);
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedCard) return;

    const { cardId, colId: sourceColId } = draggedCard;
    if (sourceColId === targetColId) return;

    let newDate = format(MOCK_TODAY, 'yyyy-MM-dd');
    if (targetColId === 'col-2') {
      newDate = format(addDays(MOCK_TODAY, 3), 'yyyy-MM-dd');
    } else if (targetColId === 'col-3') {
      newDate = format(addDays(MOCK_TODAY, 10), 'yyyy-MM-dd');
    }

    try {
      const response = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks/${cardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: newDate })
      });
      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error("Failed to move card:", error);
    }
  };

  const handleClearTasks = async (colId: string) => {
    setClearingColId(colId);
    setActiveMenuColId(null);
    
    const col = columnsState.find(c => c.id === colId);
    if (col) {
      for (const card of col.cards) {
        try {
          await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks/${card.id}`, {
            method: 'DELETE'
          });
        } catch (error) {
          console.error("Failed to delete card:", card.id, error);
        }
      }
    }

    setTimeout(() => {
      loadTasks();
      setClearingColId(null);
    }, 300);
  };

  const [listIdToDelete, setListIdToDelete] = useState<string | null>(null);

  const confirmDeleteColumn = () => {
    if (listIdToDelete) {
      setColumns(prev => prev.filter(c => c.id !== listIdToDelete));
      setListIdToDelete(null);
    }
  };

  const startRenaming = (colId: string, currentTitle: string) => {
    setRenamingColId(colId);
    setRenameValue(currentTitle);
    setActiveMenuColId(null);
  };

  const saveRename = (colId: string) => {
    if (renameValue.trim()) {
      setColumns(prev => prev.map(c => c.id === colId ? { ...c, title: renameValue.trim() } : c));
    }
    setRenamingColId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, colId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename(colId);
    } else if (e.key === 'Escape') {
      setRenamingColId(null);
      setRenameValue('');
    }
  };

  // Close menus when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (activeMenuColId) {
        setActiveMenuColId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenuColId]);

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
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
            {projectTitle ? `${projectTitle}` : 'Kanban Board'}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 pb-8 custom-scrollbar">
        <div className="flex items-start gap-6 h-full min-w-max">
          {columnsState.map(column => (
            <div 
              key={column.id} 
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`w-80 flex flex-col max-h-full bg-zinc-900/40 border ${draggedCard && draggedCard.colId !== column.id ? 'border-zinc-700/80 border-dashed' : 'border-zinc-800/60'} rounded-xl overflow-hidden shadow-lg transition-colors`}
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/20 shrink-0 relative">
                <div className="flex items-center gap-2 flex-1 mr-2">
                  {renamingColId === column.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, column.id)}
                      onBlur={() => saveRename(column.id)}
                      className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border bg-zinc-900 w-full outline-none focus:ring-1 focus:ring-indigo-500/50 ${accentColors[column.accent]}`}
                    />
                  ) : (
                    <div className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${accentColors[column.accent]}`}>
                      {column.title}
                    </div>
                  )}
                  <span className="text-xs font-medium text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full shrink-0">
                    {column.cards.length}
                  </span>
                </div>
                
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuColId(activeMenuColId === column.id ? null : column.id); }}
                    className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-zinc-800 transition-colors"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {/* Context Menu Dropdown */}
                  {activeMenuColId === column.id && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <button 
                        onClick={(e) => { e.stopPropagation(); startRenaming(column.id, column.title); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors text-left"
                      >
                        <Edit2 size={14} />
                        Rename list
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleClearTasks(column.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-brand-amber hover:bg-brand-amber/10 transition-colors text-left border-t border-zinc-800/60"
                      >
                        <Trash2 size={14} />
                        Clear all tasks
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setListIdToDelete(column.id); setActiveMenuColId(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-brand-crimson hover:bg-brand-crimson/10 transition-colors text-left border-t border-zinc-800/60"
                      >
                        <X size={14} />
                        Delete list
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-hide min-h-[100px]">
                {column.cards.map(card => (
                  <div 
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, column.id)}
                    onDragEnd={handleDragEnd}
                    className={`group bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${clearingColId === column.id ? 'opacity-0 scale-95 transition-all duration-300 pointer-events-none' : 'opacity-100'} ${card.isCompleted ? 'bg-zinc-900/50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`flex items-center gap-1.5 mb-1.5 transition-opacity ${card.isCompleted ? 'opacity-40' : ''} min-w-0 flex-1 mr-2`}>
                        <span className={`w-2 h-2 rounded-full ${priorityStyles[card.priority]} shrink-0`} title={`${card.priority} Priority`} />
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide shrink-0">{card.priority}</span>
                        {card.category && card.category !== 'General' && card.category !== 'AI Scheduler' && (
                          <>
                            <span className="text-zinc-700 shrink-0">•</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[9px] font-medium border border-zinc-700/50 truncate max-w-[120px]">{card.category}</span>
                          </>
                        )}
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 transition-opacity cursor-grab shrink-0">
                        <AlignLeft size={14} />
                      </button>
                    </div>
                    
                    <div className="flex items-start gap-2.5 mb-3">
                      <button 
                        onClick={() => toggleCardCompletion(column.id, card.id)}
                        className="mt-0.5 text-zinc-500 hover:text-brand-emerald transition-colors shrink-0 outline-none"
                      >
                        {card.isCompleted ? <CheckSquare size={16} className="text-brand-emerald" /> : <Square size={16} />}
                      </button>
                      <p className={`text-sm font-medium leading-snug pointer-events-none transition-all ${card.isCompleted ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                        {card.title}
                      </p>
                    </div>
                    
                    {(card.dueDate || card.comments || card.attachments) && (
                      <div className={`flex items-center gap-3 text-zinc-500 text-xs pointer-events-none transition-opacity ${card.isCompleted ? 'opacity-40' : ''}`}>
                        {card.dueDate && (
                          <div className={`flex items-center gap-1.5 ${card.dueDate === 'Today' && !card.isCompleted ? 'text-brand-crimson/90' : ''}`}>
                            <Clock size={12} />
                            <span>{card.dueDate}</span>
                          </div>
                        )}
                        {card.comments && (
                          <div className="flex items-center gap-1">
                            <MessageSquare size={12} />
                            <span>{card.comments}</span>
                          </div>
                        )}
                        {card.attachments && (
                          <div className="flex items-center gap-1">
                            <Paperclip size={12} />
                            <span>{card.attachments}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Card Form inline */}
                {addingToCol === column.id && (
                  <div className="bg-zinc-950/50 border border-indigo-500/30 rounded-lg p-2.5 animate-in fade-in duration-200 shadow-inner">
                    <textarea
                      autoFocus
                      placeholder="Enter a title for this card..."
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDownCard(e, column.id)}
                      onBlur={() => handleAddCard(column.id)}
                      className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none resize-none min-h-[60px]"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <button 
                        onMouseDown={(e) => { e.preventDefault(); handleAddCard(column.id); }}
                        className="px-3 py-1.5 bg-brand-emerald text-zinc-950 text-xs font-semibold rounded hover:bg-brand-emerald/90 transition-colors"
                      >
                        Add Card
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Add Card Trigger */}
              <div className="p-2 border-t border-zinc-800/40 bg-zinc-950/20 shrink-0">
                {addingToCol !== column.id && (
                  <button 
                    onClick={() => { setAddingToCol(column.id); setNewCardTitle(''); }}
                    className="w-full flex items-center gap-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    Add a card
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add Another List Block */}
          <div className="w-80 shrink-0">
            {addingList ? (
              <div className="bg-zinc-900 border border-indigo-500/40 rounded-xl p-3 shadow-lg">
                <input
                  autoFocus
                  placeholder="Enter list title..."
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={handleKeyDownList}
                  onBlur={() => handleAddList()}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-colors mb-2"
                />
                <div className="flex items-center gap-2">
                  <button 
                    onMouseDown={(e) => { e.preventDefault(); handleAddList(); }}
                    className="px-3 py-1.5 bg-brand-emerald text-zinc-950 text-xs font-semibold rounded hover:bg-brand-emerald/90 transition-colors"
                  >
                    Add List
                  </button>
                  <button 
                    onMouseDown={(e) => { e.preventDefault(); setAddingList(false); }}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setAddingList(true)}
                className="w-full flex items-center gap-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900/30 hover:bg-zinc-900/60 border border-dashed border-zinc-700/50 hover:border-zinc-600 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              >
                <Plus size={16} />
                Add another list
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {listIdToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-crimson/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-brand-crimson" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Delete List?</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              Are you sure you want to permanently delete this list? This action cannot be undone and all tasks within it will be destroyed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setListIdToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteColumn}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-crimson/90 text-white hover:bg-brand-crimson transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanView;
