import React, { useState, useRef, useEffect } from 'react';
import { Menu, Mic, Send, Bot, User, Sparkles, Check, X, Loader2, Volume2, Trash2, Search, CheckSquare, Square, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface AIProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onTaskCreated?: () => void;
  assistantLanguage?: "english" | "hinglish" | "auto";
  voiceSensitivity?: "low" | "medium" | "high";
  geminiStyle?: "concise" | "detailed";
}

interface TaskItem {
  id: number;
  title: string;
  date: string;
  priority: string;
  completed: boolean;
  category: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isStreaming?: boolean;
  actionType?: 'chat' | 'create' | 'query' | 'update' | 'delete' | 'error';
  actionPayload?: any;
  taskList?: TaskItem[];
  toolName?: string;
  isPendingConfirmation?: boolean;
  isComplete?: boolean;
  parsedTask?: { title: string; date: string; time: string };
}

const AIAssistantView: React.FC<AIProps> = ({ 
  isSidebarOpen, 
  setIsSidebarOpen, 
  onTaskCreated,
  assistantLanguage = "auto",
  voiceSensitivity = "medium",
  geminiStyle = "detailed"
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hey there! 👋 I'm Elevate AI — your personal productivity copilot. I can schedule, search, update, or delete your tasks. I also chat! Try:\n• \"What's on my plate this week?\"\n• \"Schedule a team meeting tomorrow at 3pm\"\n• \"Mark my gym session as done\"\n• \"Kal sham ko 5 baje client call hai\""
    }
  ]);
  const [input, setInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isParsing]);

  // Load persisted chat on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_BASE}/api/chat/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const loaded: Message[] = data.map((m: any, i: number) => ({
            id: `persisted-${i}`,
            sender: m.role === 'user' ? 'user' as const : 'ai' as const,
            text: m.content,
            taskList: m.metadata?.task_list || undefined,
            actionType: m.metadata?.action_type || 'chat'
          }));
          setMessages([messages[0], ...loaded]);
        }
      } catch (e) {
        // Chat persistence not available — silent fallback
      }
    };
    loadChat();
  }, []);

  // Persist a message to backend
  const persistMessage = async (role: string, content: string, metadata?: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      fetch(`${API_BASE}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role, content, metadata })
      });
    } catch (e) { /* silent */ }
  };

  // Voice recording with premium dynamic gain Web Audio API routing
  const startVoiceRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Route through Web Audio API Gain Node to apply settings sensitivity
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      
      let gainVal = 1.0;
      if (voiceSensitivity === 'low') gainVal = 0.5;
      if (voiceSensitivity === 'high') gainVal = 2.0;
      
      gainNode.gain.setValueAtTime(gainVal, audioContext.currentTime);
      
      const destination = audioContext.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(destination);
      
      const mediaRecorder = new MediaRecorder(destination.stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudioForTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => isRecording ? stopVoiceRecording() : startVoiceRecording();

  const uploadAudioForTranscription = async (blob: Blob) => {
    try {
      setIsTranscribing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      
      // Pass configurations to assist downstream offline/fallback transcriptions
      const response = await fetch(`${API_BASE}/api/ai/transcribe?sensitivity=${voiceSensitivity}&language=${assistantLanguage}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!response.ok) throw new Error("Transcription failed");
      const result = await response.json();
      if (result.text) setInput(result.text);
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ================================================================
  // MAIN: Send message with SSE streaming
  // ================================================================
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userText = input.trim();
    if (!userText || isParsing) return;

    setInput('');
    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text: userText },
      { id: aiMsgId, sender: 'ai', text: '', isStreaming: true }
    ]);
    setIsParsing(true);

    // Persist user message
    persistMessage('user', userText);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Build chat history
      const chatHistory = messages
        .filter(msg => msg.id !== 'welcome' && !msg.isStreaming)
        .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));
      chatHistory.push({ role: 'user', content: userText });

      // SSE streaming request - now integrates style and language options
      const response = await fetch(`${API_BASE}/api/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          messages: chatHistory,
          style: geminiStyle,
          language: assistantLanguage
        })
      });

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let finalActionType: string = 'chat';
      let finalActionPayload: any = null;
      let finalTaskList: TaskItem[] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.substring(6));

            if (parsed.type === 'text') {
              accumulated += parsed.content;
              setMessages(prev => prev.map(msg =>
                msg.id === aiMsgId ? { ...msg, text: accumulated, isStreaming: true } : msg
              ));
            } else if (parsed.type === 'tool_call') {
              setMessages(prev => prev.map(msg =>
                msg.id === aiMsgId ? { ...msg, toolName: parsed.name } : msg
              ));
            } else if (parsed.type === 'done') {
              finalActionType = parsed.action_type || 'chat';
              finalActionPayload = parsed.action_payload;
              finalTaskList = parsed.task_list;
            } else if (parsed.type === 'error') {
              accumulated += parsed.content;
            }
          } catch (e) { /* skip malformed SSE lines */ }
        }
      }

      // Finalize the AI message
      const isCreateAction = finalActionType === 'create' && finalActionPayload;
      setMessages(prev => prev.map(msg => {
        if (msg.id === aiMsgId) {
          return {
            ...msg,
            text: accumulated || "I'm here to help! What would you like to do?",
            isStreaming: false,
            actionType: finalActionType as any,
            actionPayload: finalActionPayload,
            taskList: finalTaskList || undefined,
            isPendingConfirmation: isCreateAction,
            isComplete: isCreateAction,
            parsedTask: isCreateAction ? {
              title: finalActionPayload.title,
              date: finalActionPayload.date,
              time: finalActionPayload.time
            } : undefined
          };
        }
        return msg;
      }));

      // Persist AI response
      persistMessage('assistant', accumulated, {
        action_type: finalActionType,
        task_list: finalTaskList
      });

      // Auto-refresh tasks for update/delete actions
      if (['update', 'delete'].includes(finalActionType)) {
        onTaskCreated?.();
      }

    } catch (err: any) {
      console.error("AI Error:", err);
      setMessages(prev => prev.map(msg =>
        msg.id === aiMsgId ? { ...msg, text: "Connection error. Please check your backend and try again.", isStreaming: false } : msg
      ));
    } finally {
      setIsParsing(false);
    }
  };

  // Confirm scheduling (create action)
  const handleConfirmAdd = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.parsedTask) return;

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPendingConfirmation: false } : m));

    // Task was already created by the agentic loop — just confirm in UI
    setMessages(prev => [...prev, {
      id: `success-${Date.now()}`,
      sender: 'ai',
      text: `✅ Done! "${msg.parsedTask!.title}" has been saved to your calendar for ${msg.parsedTask!.date} at ${msg.parsedTask!.time}.`
    }]);

    onTaskCreated?.();
  };

  const handleCancelAdd = (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPendingConfirmation: false } : m));

    // If the task was already created by the tool, delete it
    if (msg?.actionPayload?.task?.id) {
      const deleteTask = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          await fetch(`${API_BASE}/api/tasks/${msg.actionPayload.task.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          onTaskCreated?.();
        } catch (e) { console.error("Delete failed:", e); }
      };
      deleteTask();
    }

    setMessages(prev => [...prev, {
      id: `cancelled-${Date.now()}`,
      sender: 'ai',
      text: "❌ No problem, I've cancelled that. What else can I help with?"
    }]);
  };

  // Clear chat
  const handleClearChat = async () => {
    setMessages([messages[0]]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      fetch(`${API_BASE}/api/chat/messages`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) { /* silent */ }
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 relative">
      <header className="absolute top-0 w-full z-10 bg-gradient-to-b from-zinc-950/90 to-transparent pt-4 px-6 pb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400 animate-pulse" />
            <h1 className="text-xl font-black text-zinc-100 tracking-tight">Elevate AI</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest bg-zinc-900/80 px-2.5 py-1 border border-zinc-800 rounded-full backdrop-blur hover:border-zinc-700 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={10} />
            Clear
          </button>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/80 px-2.5 py-1 border border-zinc-800 rounded-full backdrop-blur">
            Multi-Tool Agent
          </div>
        </div>
      </header>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 md:px-20 lg:px-40 pt-24 pb-36 scrollbar-hide flex flex-col gap-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'ai' && (
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/5">
                <Bot size={16} />
              </div>
            )}

            <div className="max-w-[80%] flex flex-col gap-2">
              <div className={`rounded-2xl p-4 text-sm leading-relaxed shadow-sm relative ${
                msg.sender === 'user'
                  ? 'bg-zinc-900 border border-zinc-800/80 rounded-tr-sm text-zinc-200'
                  : 'bg-zinc-900/40 border border-zinc-800/60 rounded-tl-sm text-zinc-300 backdrop-blur-sm'
              }`}>
                {/* Tool execution indicator */}
                {msg.isStreaming && msg.toolName && !msg.text && (
                  <span className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-2">
                    <Loader2 size={12} className="animate-spin" />
                    {msg.toolName === 'query_user_tasks' && '🔍 Searching your tasks...'}
                    {msg.toolName === 'create_calendar_event' && '📅 Creating event...'}
                    {msg.toolName === 'update_task' && '✏️ Updating task...'}
                    {msg.toolName === 'delete_task' && '🗑️ Deleting task...'}
                    {!['query_user_tasks', 'create_calendar_event', 'update_task', 'delete_task'].includes(msg.toolName || '') && '⚙️ Processing...'}
                  </span>
                )}

                {/* Message text with whitespace preserved */}
                {msg.text ? (
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                ) : (msg.isStreaming && !msg.toolName && (
                  <span className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                    Thinking...
                  </span>
                ))}

                {/* Streaming cursor */}
                {msg.isStreaming && msg.text && (
                  <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-1 animate-pulse" />
                )}

                {/* Parsed task details badge */}
                {msg.parsedTask && msg.isComplete && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/50 flex flex-wrap gap-2 animate-in fade-in zoom-in duration-300">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      📅 {msg.parsedTask.date}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      ⏰ {msg.parsedTask.time}
                    </span>
                  </div>
                )}

                {/* ====== RICH INLINE TASK CARDS ====== */}
                {msg.taskList && msg.taskList.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/50 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <Search size={12} className="text-indigo-400" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{msg.taskList.length} tasks found</span>
                    </div>
                    {msg.taskList.slice(0, 8).map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-2.5 bg-zinc-800/40 border border-zinc-700/40 rounded-lg hover:border-zinc-600/60 transition-colors group">
                        {task.completed ? (
                          <CheckSquare size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <Square size={14} className="text-zinc-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${task.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                              <Calendar size={9} />
                              {task.date}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0 rounded ${
                              task.priority === 'Critical' ? 'bg-red-500/15 text-red-400' :
                              task.priority === 'Important' ? 'bg-indigo-500/15 text-indigo-400' :
                              'bg-zinc-700/50 text-zinc-400'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono shrink-0">#{task.id}</span>
                      </div>
                    ))}
                    {msg.taskList.length > 8 && (
                      <p className="text-[10px] text-zinc-500 text-center pt-1">
                        +{msg.taskList.length - 8} more tasks
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm/Cancel for create actions */}
              {msg.sender === 'ai' && msg.isPendingConfirmation && msg.isComplete && (
                <div className="flex items-center gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-300 delay-100">
                  <button
                    onClick={() => handleConfirmAdd(msg.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                  >
                    <Check size={13} />
                    Confirm & Save
                  </button>
                  <button
                    onClick={() => handleCancelAdd(msg.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <X size={13} />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 text-zinc-400 shadow-md">
                <User size={16} />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="absolute bottom-0 w-full bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-10 pb-6 px-4 md:px-20 lg:px-40">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/20 via-emerald-500/20 to-indigo-500/20 rounded-2xl blur opacity-30 group-focus-within:opacity-60 transition duration-500"></div>
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex items-end p-2 transition-colors focus-within:border-zinc-700">

            <button
              type="button"
              onClick={toggleRecording}
              className={`p-3 rounded-xl transition-all group/mic shrink-0 cursor-pointer ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30'
                  : 'text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10'
              }`}
            >
              {isRecording ? <Volume2 size={20} className="scale-110" /> : <Mic size={20} className="group-hover/mic:scale-110 transition-transform" />}
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isRecording ? "Recording... tap mic to stop & transcribe!"
                : isTranscribing ? "Transcribing voice..."
                : "Ask anything — schedule, search, update, or just chat..."
              }
              disabled={isTranscribing}
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none px-2 py-3 min-h-[44px] max-h-[120px] scrollbar-hide font-medium"
              rows={1}
            />

            <button
              type="submit"
              disabled={!input.trim() || isParsing || isTranscribing}
              className="p-3 text-zinc-500 hover:text-zinc-100 disabled:hover:text-zinc-500 disabled:opacity-40 bg-zinc-800/50 hover:bg-zinc-700 rounded-xl transition-all shrink-0 ml-2 cursor-pointer"
            >
              {isTranscribing ? (
                <Loader2 size={18} className="animate-spin text-indigo-400" />
              ) : (
                <Send size={18} className="translate-x-[1px] translate-y-[1px]" />
              )}
            </button>
          </div>
          <div className="text-center mt-3 text-[10px] text-zinc-600 font-bold tracking-widest uppercase">
            ELEVATE AI — MULTI-TOOL AGENT · VERIFY CRITICAL SCHEDULES
          </div>
        </div>
      </form>
    </div>
  );
};

export default AIAssistantView;
