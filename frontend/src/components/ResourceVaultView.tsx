import React, { useState, useEffect } from 'react';
import { Menu, ExternalLink, Video, Clock, Code, Plus, Minus, X, Calendar, ChevronDown } from 'lucide-react';

interface ResourceVaultProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
}

interface Certification {
  id: string;
  name: string;
  url: string;
  completedModules: number;
  totalModules: number;
}

interface Meeting {
  id: string;
  title: string;
  platform: string;
  url: string;
  dateTime: string;
}

const ResourceVaultView: React.FC<ResourceVaultProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const [certifications, setCertifications] = useState<Certification[]>(() => {
    try {
      const saved = localStorage.getItem('remindmeup_certifications');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load certifications:", e);
      return [];
    }
  });
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    try {
      const saved = localStorage.getItem('remindmeup_meetings');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load meetings:", e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('remindmeup_certifications', JSON.stringify(certifications));
    } catch (e) {
      console.error("Failed to save certifications:", e);
    }
  }, [certifications]);

  useEffect(() => {
    try {
      localStorage.setItem('remindmeup_meetings', JSON.stringify(meetings));
    } catch (e) {
      console.error("Failed to save meetings:", e);
    }
  }, [meetings]);

  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certForm, setCertForm] = useState({ name: '', url: '', completed: 0, total: 10 });

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', platform: 'Zoom', url: '', day: 'Today', time: '' });

  const handleAddCert = () => {
    if (!certForm.name.trim() || certForm.total <= 0) return;
    setCertifications(prev => [
      ...prev,
      {
        id: `cert-${Date.now()}`,
        name: certForm.name,
        url: certForm.url,
        completedModules: certForm.completed,
        totalModules: certForm.total
      }
    ]);
    setIsCertModalOpen(false);
    setCertForm({ name: '', url: '', completed: 0, total: 10 });
  };

  const handleAddMeeting = () => {
    if (!meetingForm.title.trim()) return;
    
    let formattedDateTime = 'Time TBD';
    if (meetingForm.day && meetingForm.time) {
      formattedDateTime = `${meetingForm.day}, ${meetingForm.time}`;
    } else if (meetingForm.day) {
      formattedDateTime = meetingForm.day;
    } else if (meetingForm.time) {
      formattedDateTime = meetingForm.time;
    }

    setMeetings(prev => [
      ...prev,
      {
        id: `meet-${Date.now()}`,
        title: meetingForm.title,
        platform: meetingForm.platform,
        url: meetingForm.url,
        dateTime: formattedDateTime
      }
    ]);
    setIsMeetingModalOpen(false);
    setMeetingForm({ title: '', platform: 'Zoom', url: '', day: 'Today', time: '' });
  };

  const incrementCertProgress = (id: string) => {
    setCertifications(prev => prev.map(cert => {
      if (cert.id === id && cert.completedModules < cert.totalModules) {
        return { ...cert, completedModules: cert.completedModules + 1 };
      }
      return cert;
    }));
  };

  const decrementCertProgress = (id: string) => {
    setCertifications(prev => prev.map(cert => {
      if (cert.id === id && cert.completedModules > 0) {
        return { ...cert, completedModules: cert.completedModules - 1 };
      }
      return cert;
    }));
  };

  return (
    <div className="flex flex-col h-full w-full relative">
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
          <h1 className="text-xl font-bold text-zinc-100">Resource & Link Vault</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-hide">
        <div className="max-w-5xl mx-auto space-y-12">
          
          {/* Active Certifications & Courses */}
          <section>
            <div className="mb-6 border-b border-zinc-800/50 pb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">Active Certifications & Courses</h2>
              <button 
                onClick={() => setIsCertModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            
            {certifications.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/20">
                <p className="text-zinc-500 text-sm">No active courses. Add one to track your progress.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {certifications.map(cert => {
                  const progressPct = Math.round((cert.completedModules / cert.totalModules) * 100) || 0;
                  return (
                    <div key={cert.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all shadow-sm flex flex-col group relative overflow-hidden">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-brand-emerald/10 text-brand-emerald flex items-center justify-center shrink-0">
                          <Code size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-zinc-100 text-sm leading-tight mb-1 truncate" title={cert.name}>{cert.name}</h3>
                          <p className="text-xs text-zinc-500">Custom Course</p>
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-2 space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-400">Progress</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-300">{cert.completedModules} / {cert.totalModules}</span>
                              <div className="flex items-center bg-zinc-800 rounded-md overflow-hidden">
                                <button onClick={() => decrementCertProgress(cert.id)} className="p-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"><Minus size={12} /></button>
                                <button onClick={() => incrementCertProgress(cert.id)} className="p-0.5 text-zinc-400 hover:text-brand-emerald hover:bg-zinc-700 transition-colors"><Plus size={12} /></button>
                              </div>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
                            <div 
                              className="absolute top-0 left-0 h-full bg-brand-emerald rounded-full transition-all duration-300 ease-out" 
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                        
                        <a 
                          href={cert.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md transition-colors"
                        >
                          Open Course Dashboard <ExternalLink size={14} className="text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick-Access Meeting Hub */}
          <section>
            <div className="mb-6 border-b border-zinc-800/50 pb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">Quick-Access Meeting Hub</h2>
              <button 
                onClick={() => setIsMeetingModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            
            {meetings.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/20">
                <p className="text-zinc-500 text-sm">No meetings scheduled. Add one to keep your links handy.</p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-zinc-800/60">
                  {meetings.map(meeting => (
                    <div key={meeting.id} className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                          <Video size={18} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-100 text-sm">{meeting.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500 font-medium bg-zinc-800 px-2 py-0.5 rounded-sm">{meeting.platform}</span>
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock size={12} /> {meeting.dateTime}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <a 
                        href={meeting.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-4 py-2 bg-brand-emerald/10 hover:bg-brand-emerald/20 text-brand-emerald text-sm font-medium rounded-md border border-brand-emerald/20"
                      >
                        <Video size={14} /> Join Now
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Cert Modal */}
      {isCertModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100">Add Certificate / Course</h3>
              <button onClick={() => setIsCertModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Title Name</label>
                <input 
                  type="text"
                  value={certForm.name}
                  onChange={e => setCertForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand-emerald/50"
                  placeholder="e.g. React Patterns"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">External Hyperlink</label>
                <input 
                  type="url"
                  value={certForm.url}
                  onChange={e => setCertForm(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand-emerald/50"
                  placeholder="https://course.link"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Completed Modules</label>
                  <input 
                    type="number"
                    min="0"
                    value={certForm.completed}
                    onChange={e => setCertForm(prev => ({ ...prev, completed: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand-emerald/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Total Modules</label>
                  <input 
                    type="number"
                    min="1"
                    value={certForm.total}
                    onChange={e => setCertForm(prev => ({ ...prev, total: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand-emerald/50"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleAddCert}
                disabled={!certForm.name.trim()}
                className="px-4 py-2 bg-brand-emerald text-zinc-950 font-bold text-sm rounded-lg hover:bg-brand-emerald/90 transition-colors disabled:opacity-50"
              >
                Save Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100">Add Quick Meeting</h3>
              <button onClick={() => setIsMeetingModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Meeting Title</label>
                <input 
                  type="text"
                  value={meetingForm.title}
                  onChange={e => setMeetingForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. Daily Standup"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Platform</label>
                  <select 
                    value={meetingForm.platform}
                    onChange={e => setMeetingForm(prev => ({ ...prev, platform: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="Zoom">Zoom</option>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Microsoft Teams">Microsoft Teams</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-2">When is the meeting?</label>
                  <div className="grid grid-cols-2 gap-3">
                     {/* Day Selector */}
                     <div className="relative group">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Calendar size={14} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                       </div>
                       <select 
                         value={meetingForm.day}
                         onChange={e => setMeetingForm(prev => ({...prev, day: e.target.value}))}
                         className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-lg pl-9 pr-8 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 appearance-none transition-all cursor-pointer"
                       >
                          <option value="Today">Today</option>
                          <option value="Tomorrow">Tomorrow</option>
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                       </select>
                       <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                         <ChevronDown size={14} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                       </div>
                     </div>

                     {/* Time Selector */}
                     <div className="relative group">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Clock size={14} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                       </div>
                       <input 
                         type="text"
                         placeholder="e.g. 2:00 PM"
                         value={meetingForm.time}
                         onChange={e => setMeetingForm(prev => ({...prev, time: e.target.value}))}
                         className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-600"
                       />
                     </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Meeting Link (Target URL)</label>
                <input 
                  type="url"
                  value={meetingForm.url}
                  onChange={e => setMeetingForm(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleAddMeeting}
                disabled={!meetingForm.title.trim()}
                className="px-4 py-2 bg-blue-500 text-white font-bold text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                Save Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceVaultView;
