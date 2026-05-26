import React, { useState, useEffect } from 'react';
import { Menu, Sun, Bell, Settings2, CheckCircle, Circle, Info, Sparkles, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';

import { AppNotification } from '../App';

interface DashboardProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  onCompleteTask: (taskId: number) => Promise<void>;
}

const DashboardView: React.FC<DashboardProps> = ({ 
  isSidebarOpen, 
  setIsSidebarOpen,
  notifications,
  setNotifications,
  onCompleteTask
}) => {
  const today = new Date();
  const headerDate = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const bannerDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const [weatherString, setWeatherString] = useState('Fetching weather data...');
  const [todaysTasks, setTodaysTasks] = useState<any[]>([]);
  const [aiBriefing, setAiBriefing] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    // 0. Fetch tasks from our new Supabase backend
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
        
        // Ensure we always set an array, even if the backend returns an error object
        if (Array.isArray(data)) {
          const todayStr = format(today, 'yyyy-MM-dd');
          const filtered = data.filter((task: any) => task.date && task.date.startsWith(todayStr));
          setTodaysTasks(filtered);
        } else {
          console.error("Backend did not return an array:", data);
          setTodaysTasks([]);
        }
      } catch (error) {
        console.error("Failed to fetch tasks from backend", error);
        setTodaysTasks([]);
      }
    };
    loadTasks();

    // 1.5 Fetch AI-powered daily briefing
    const loadBriefing = async () => {
      try {
        setBriefingLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/briefing`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.briefing) setAiBriefing(data.briefing);
      } catch (err) {
        setAiBriefing('Good morning! Check your calendar for today\'s tasks.');
      } finally {
        setBriefingLoading(false);
      }
    };
    loadBriefing();

    // 2. Weather Fetch function
    const fetchWeather = async (lat: number, lon: number, fallbackCity: string | null = null) => {
      try {
        let locationName = fallbackCity;
        // If no fallback city provided, try to reverse geocode
        if (!locationName) {
          try {
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const geoData = await geoRes.json();
            locationName = geoData.city || geoData.locality || 'Local';
          } catch (e) {
            locationName = 'Local';
          }
        }

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const weatherData = await weatherRes.json();
        const temp = Math.round(weatherData.current_weather.temperature);
        const code = weatherData.current_weather.weathercode;
        
        let condition = 'Clear Sky';
        if (code === 1 || code === 2) condition = 'Partly Cloudy';
        else if (code === 3) condition = 'Overcast';
        else if (code >= 45 && code <= 48) condition = 'Fog';
        else if (code >= 51 && code <= 67) condition = 'Rain';
        else if (code >= 71 && code <= 77) condition = 'Snow';
        else if (code >= 95) condition = 'Thunderstorm';

        setWeatherString(`${temp}°C · ${condition} · ${locationName}`);
      } catch (err) {
        setWeatherString(`Weather unavailable · ${fallbackCity || 'Local'}`);
      }
    };

    // 3. Geolocation initialization with New Delhi fallback
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Fallback to New Delhi if permission denied
          fetchWeather(28.6139, 77.2090, 'New Delhi');
        },
        { timeout: 5000 }
      );
    } else {
      // Fallback if geolocation completely unsupported
      fetchWeather(28.6139, 77.2090, 'New Delhi');
    }
  }, []);

  const handleToggleComplete = async (task: any) => {
    const updatedCompleted = !task.completed;
    
    // Optimistically update UI
    setTodaysTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: updatedCompleted } : t));

    try {
      await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ completed: updatedCompleted })
      });
    } catch (error) {
      console.error("Failed to update task completion in database:", error);
      // Revert if database save fails
      setTodaysTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !updatedCompleted } : t));
    }
  };

  return (
    <div className="flex h-full w-full animate-in fade-in duration-300">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto scrollbar-hide">
        <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Menu size={20} />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-zinc-100">{headerDate}</h1>
              <div className="flex items-center gap-2 text-sm text-zinc-500 mt-0.5">
                <Sun size={14} className="text-brand-amber" />
                <span>{weatherString}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="btn btn-ghost p-2 rounded-full hover:bg-zinc-800 relative cursor-pointer"
              >
                <Bell size={18} className={notifications.filter(n => !n.read).length > 0 ? "text-indigo-400 animate-pulse" : "text-zinc-400"} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-crimson rounded-full border border-zinc-950 animate-ping"></span>
                )}
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-crimson rounded-full border border-zinc-950"></span>
                )}
              </button>

              {/* Sleek Premium Notification Center Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
                    <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Bell size={12} className="text-indigo-400" />
                      Notifications
                    </h3>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <button 
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        }}
                        className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/40">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-zinc-500 text-xs">
                        No recent notifications.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => {
                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                          }}
                          className={`p-3 transition-colors cursor-pointer hover:bg-zinc-800/30 flex gap-2.5 ${!notif.read ? 'bg-indigo-500/[0.02]' : ''}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                            !notif.read ? 'bg-indigo-500' : 'bg-transparent'
                          }`} />
                          
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start gap-1">
                              <p className="text-[11px] font-semibold text-zinc-200 truncate">{notif.title}</p>
                              <span className="text-[9px] text-zinc-500 whitespace-nowrap">
                                {new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-normal">{notif.message}</p>
                            
                            {!notif.read && notif.taskId && (
                              <div className="flex gap-2 pt-1.5">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (notif.taskId !== undefined) {
                                      await onCompleteTask(notif.taskId);
                                    }
                                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                  }}
                                  className="text-[9px] font-bold text-brand-emerald hover:underline cursor-pointer"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                  }}
                                  className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-2 border-t border-zinc-800 bg-zinc-950/40 text-center">
                      <button 
                        onClick={() => {
                          setNotifications([]);
                        }}
                        className="text-[10px] font-bold text-brand-crimson hover:underline cursor-pointer"
                      >
                        Clear All History
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button className="btn btn-ghost p-2 rounded-full hover:bg-zinc-800 cursor-pointer"><Settings2 size={18} /></button>
          </div>
        </header>

        <div className="p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
          {/* AI Daily Briefing Banner — Gemini Powered */}
          <div className="glass-panel p-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-emerald-500"></div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0 border border-indigo-500/20">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    AI Daily Briefing
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">GEMINI</span>
                  </h3>
                  <button
                    onClick={async () => {
                      setBriefingLoading(true);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        const res = await fetch(`\${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/briefing`, { headers: { 'Authorization': `Bearer ${token}` } });
                        const data = await res.json();
                        if (data.briefing) setAiBriefing(data.briefing);
                      } catch (e) {} finally { setBriefingLoading(false); }
                    }}
                    className="text-zinc-500 hover:text-indigo-400 transition-colors cursor-pointer"
                    title="Refresh briefing"
                  >
                    <RefreshCw size={13} className={briefingLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                {briefingLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-zinc-800 rounded w-full"></div>
                    <div className="h-3 bg-zinc-800 rounded w-4/5"></div>
                    <div className="h-3 bg-zinc-800 rounded w-3/5"></div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 leading-relaxed">{aiBriefing}</p>
                )}
              </div>
            </div>
          </div>

          {/* Date-Locked To-Do List */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl overflow-hidden mt-4 flex flex-col flex-1 shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-800/60 bg-zinc-900/50 flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">Today's To-Do</h2>
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-2 rounded-md border border-indigo-500/20">
                <Info size={14} className="shrink-0" />
                <span>Showing tasks for Today <strong>[{bannerDate}]</strong> only. Future scheduled items (e.g. June 15th Client Call) are hidden until their respective dates.</span>
              </div>
            </div>
            
            <div className="p-2 flex-1">
              {todaysTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 hover:bg-zinc-800/30 rounded-lg transition-colors group border border-transparent hover:border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleComplete(task)}
                      className="text-zinc-500 hover:text-brand-emerald transition-colors shrink-0"
                    >
                      {task.completed ? <CheckCircle size={20} className="text-brand-emerald fill-brand-emerald/20" /> : <Circle size={20} />}
                    </button>
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${task.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                        {task.title}
                      </span>
                      <span className="text-xs text-zinc-500">{task.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] uppercase font-bold tracking-wider ${
                      task.priority === 'Critical' ? 'bg-brand-crimson/10 text-brand-crimson border border-brand-crimson/20' : 
                      task.priority === 'Important' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 
                      'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardView;
