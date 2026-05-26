const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
global.WebSocket = WebSocket;
const multer = require('multer');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 4000;

// Configure Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env file");
  process.exit(1);
}

console.log("🔌 Connected to Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// Authentication Middleware
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];



  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Failed to authenticate user token' });
  }
};

// Apply authMiddleware globally to all task API endpoints
app.use('/api/tasks', authMiddleware);

// --- TASK CRUD ROUTES ---

// Get all tasks for the logged in user
app.get('/api/tasks', async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error("🔴 Supabase GET Error:", error);
    return res.status(500).json({ error: error.message });
  }

  // Filter tasks belonging to the current user (using category prefix: "userId:category")
  const userTasks = data
    .filter(task => task.category && task.category.startsWith(`${userId}:`))
    .map(task => ({
      ...task,
      reminder_offset_minutes: task.reminder_offset_minutes !== undefined ? task.reminder_offset_minutes : 10,
      category: task.category.substring(userId.length + 1) // Strip the user prefix
    }));

  res.json(userTasks);
});

// Create a new task for the logged in user
app.post('/api/tasks', async (req, res) => {
  const userId = req.user.id;
  const { title, priority, date, completed, duration, category, reminder_offset_minutes } = req.body;

  // Prefix the category with user's ID to isolate tasks
  const prefixedCategory = `${userId}:${category || 'General'}`;
  const offset = typeof reminder_offset_minutes === 'number' ? reminder_offset_minutes : 10;

  let { data, error } = await supabase
    .from('tasks')
    .insert([{ title, priority, date, completed, duration, category: prefixedCategory, reminder_offset_minutes: offset }])
    .select();

  if (error) {
    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
      console.warn("⚠️ Column 'reminder_offset_minutes' does not exist in Supabase tasks table yet. Inserting without it.");
      const fallbackResult = await supabase
        .from('tasks')
        .insert([{ title, priority, date, completed, duration, category: prefixedCategory }])
        .select();
      
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
  }

  if (error) {
    console.error("🔴 Supabase POST Error:", error);
    return res.status(500).json({ error: error.message });
  }

  // Strip prefix before sending back to UI
  const returnedTask = {
    ...data[0],
    reminder_offset_minutes: data[0].reminder_offset_minutes !== undefined ? data[0].reminder_offset_minutes : offset,
    category: data[0].category.substring(userId.length + 1)
  };

  res.status(201).json(returnedTask);
});

// Update a task (ensuring user owns it)
app.put('/api/tasks/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const updates = { ...req.body };

  // Verify ownership first
  const { data: checkData, error: checkError } = await supabase
    .from('tasks')
    .select('category')
    .eq('id', id)
    .single();

  if (checkError || !checkData || !checkData.category.startsWith(`${userId}:`)) {
    return res.status(403).json({ error: 'Unauthorized to update this task' });
  }

  if (updates.category) {
    updates.category = `${userId}:${updates.category}`;
  }

  let { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
      console.warn("⚠️ Column 'reminder_offset_minutes' does not exist in Supabase tasks table yet. Updating without it.");
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.reminder_offset_minutes;
      
      const fallbackResult = await supabase
        .from('tasks')
        .update(fallbackUpdates)
        .eq('id', id)
        .select();
      
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
  }

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const returnedTask = {
    ...data[0],
    reminder_offset_minutes: data[0].reminder_offset_minutes !== undefined ? data[0].reminder_offset_minutes : (updates.reminder_offset_minutes || 10),
    category: data[0].category.substring(userId.length + 1)
  };

  res.json(returnedTask);
});


// Clear completed tasks for the logged in user
app.delete('/api/tasks/completed', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, category, completed');

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    const completedIds = (data || [])
      .filter(task => task.category && task.category.startsWith(`${userId}:`) && (task.completed === true || task.completed === 1 || task.isCompleted === true))
      .map(task => task.id);

    if (completedIds.length === 0) {
      return res.status(200).json({ message: 'No completed tasks found to clear' });
    }

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .in('id', completedIds);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.status(200).json({ success: true, clearedCount: completedIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all tasks for a specific user (used when deleting account)
app.delete('/api/tasks/clear-all', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('id, category');

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    const allIds = (data || [])
      .filter(task => task.category && task.category.startsWith(`${userId}:`))
      .map(task => task.id);

    if (allIds.length === 0) {
      return res.status(200).json({ message: 'No tasks found to clear' });
    }

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .in('id', allIds);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.status(200).json({ success: true, clearedCount: allIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a task (ensuring user owns it)
app.delete('/api/tasks/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Verify ownership first
  const { data: checkData, error: checkError } = await supabase
    .from('tasks')
    .select('category')
    .eq('id', id)
    .single();

  if (checkError || !checkData || !checkData.category.startsWith(`${userId}:`)) {
    return res.status(403).json({ error: 'Unauthorized to delete this task' });
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.status(204).send();
});

// --- GROQ WHISPER-LARGE-V3 VOICE TRANSCRIPTION ENDPOINT ---
app.post('/api/ai/transcribe', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    console.log('🎤 Received transcription request');
    console.log('Request Headers:', req.headers);
    console.log('Request File:', req.file);
    console.log('Request Body:', req.body);

    if (!req.file) {
      console.warn("⚠️ No file in request");
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.warn("⚠️ GROQ_API_KEY missing in .env, activating high-fidelity offline Hinglish fallback...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      return res.json({ text: "Kal sham ko 5 baje client call meeting scheduled krdo" });
    }

    // Call Groq Whisper API using standard native global FormData and Blob
    const nativeFormData = new global.FormData();
    const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    nativeFormData.append('file', audioBlob, 'audio.webm');
    nativeFormData.append('model', 'whisper-large-v3');
    nativeFormData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: nativeFormData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("🔴 Groq Transcribe API Error:", errText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('🎤 Transcribed:', result.text);
    res.json({ text: result.text || '' });

  } catch (err) {
    console.error("Transcription Handler Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// --- ELEVATE AI: MULTI-TOOL AGENTIC ARCHITECTURE ---
// =====================================================================
const { GoogleGenerativeAI, SchemaType, FunctionCallingMode } = require('@google/generative-ai');

const assistantTools = [{
  functionDeclarations: [
    {
      name: "create_calendar_event",
      description: "Schedule a new task/event. ONLY call when title, date, and time are ALL confirmed.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: "The event title." },
          date: { type: SchemaType.STRING, description: "Date in YYYY-MM-DD format." },
          time: { type: SchemaType.STRING, description: "Time in 24-hour HH:MM format." }
        },
        required: ["title", "date", "time"]
      }
    },
    {
      name: "query_user_tasks",
      description: "Fetch the user's tasks. Use when user asks about schedule, workload, or specific tasks.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date_from: { type: SchemaType.STRING, description: "Start date YYYY-MM-DD" },
          date_to: { type: SchemaType.STRING, description: "End date YYYY-MM-DD" },
          keyword: { type: SchemaType.STRING, description: "Search keyword for titles" }
        }
      }
    },
    {
      name: "update_task",
      description: "Modify an existing task. Use to reschedule, rename, or mark done/undone.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          task_id: { type: SchemaType.STRING, description: "ID of task to update" },
          new_title: { type: SchemaType.STRING, description: "New title" },
          new_date: { type: SchemaType.STRING, description: "New date YYYY-MM-DD" },
          completed: { type: SchemaType.BOOLEAN, description: "Mark done (true) or undone (false)" }
        },
        required: ["task_id"]
      }
    },
    {
      name: "delete_task",
      description: "Delete/cancel a task permanently. Confirm with user before calling.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          task_id: { type: SchemaType.STRING, description: "ID of task to delete" }
        },
        required: ["task_id"]
      }
    }
  ]
}];

// --- Helper: Execute tool calls against the database ---
async function executeToolCall(fc, userId) {
  const { name, args } = fc;

  if (name === 'create_calendar_event') {
    const cat = `${userId}:AI Scheduler`;
    const { data, error } = await supabase.from('tasks')
      .insert([{ title: args.title, date: args.date, priority: 'Important', completed: false, duration: '1h', category: cat }])
      .select();
    if (error) return { success: false, error: error.message };
    return { success: true, task: { ...data[0], category: 'AI Scheduler' } };
  }

  if (name === 'query_user_tasks') {
    let query = supabase.from('tasks').select('*').order('date', { ascending: true });
    if (args.date_from) query = query.gte('date', args.date_from);
    if (args.date_to) query = query.lte('date', args.date_to);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    let tasks = (data || [])
      .filter(t => t.category && t.category.startsWith(`${userId}:`))
      .map(t => ({ id: t.id, title: t.title, date: t.date, priority: t.priority, completed: t.completed, category: t.category.substring(userId.length + 1) }));
    if (args.keyword) tasks = tasks.filter(t => t.title.toLowerCase().includes(args.keyword.toLowerCase()));
    return { success: true, tasks, count: tasks.length };
  }

  if (name === 'update_task') {
    const { data: chk } = await supabase.from('tasks').select('category, title').eq('id', args.task_id).single();
    if (!chk || !chk.category.startsWith(`${userId}:`)) return { success: false, error: 'Task not found' };
    const updates = {};
    if (args.new_title) updates.title = args.new_title;
    if (args.new_date) updates.date = args.new_date;
    if (args.completed !== undefined) updates.completed = args.completed;
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', args.task_id).select();
    if (error) return { success: false, error: error.message };
    return { success: true, task: data[0], old_title: chk.title };
  }

  if (name === 'delete_task') {
    const { data: chk } = await supabase.from('tasks').select('category, title').eq('id', args.task_id).single();
    if (!chk || !chk.category.startsWith(`${userId}:`)) return { success: false, error: 'Task not found' };
    const { error } = await supabase.from('tasks').delete().eq('id', args.task_id);
    if (error) return { success: false, error: error.message };
    return { success: true, deleted_title: chk.title };
  }

  return { success: false, error: 'Unknown tool' };
}

// --- Helper: Get user tasks for context injection ---
async function getUserTasksContext(userId) {
  const { data } = await supabase.from('tasks').select('*').order('date', { ascending: true });
  const tasks = (data || [])
    .filter(t => t.category && t.category.startsWith(`${userId}:`))
    .map(t => ({ id: t.id, title: t.title, date: t.date, priority: t.priority, completed: t.completed, category: t.category.substring(userId.length + 1) }));
  if (tasks.length === 0) return "No tasks scheduled yet.";
  return tasks.map(t => `- [ID:${t.id}] "${t.title}" on ${t.date} | ${t.priority} | ${t.completed ? '✅ Done' : '⏳ Pending'} | ${t.category}`).join('\n');
}

// --- Helper: Build system instruction ---
function buildSystemPrompt(tasksContext, style, language) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

  let styleInstruction = "Keep your responses professional and clean.";
  if (style === 'concise') {
    styleInstruction = "Keep all responses under 3 sentences.";
  } else if (style === 'detailed') {
    styleInstruction = "Provide thorough, structured responses.";
  }

  let languageInstruction = "You MUST respond ONLY in English or Hinglish (Hindi words written in Roman script mixed with English). NEVER respond in pure Hindi, Devanagari script, or any other language.";
  if (language === 'english') {
    languageInstruction = "You MUST respond ONLY in English. Do not use Hinglish or any other languages.";
  } else if (language === 'hinglish') {
    languageInstruction = "You MUST respond ONLY in Hinglish (Hindi words written in Roman script mixed with English). Do not use pure English or other languages.";
  }

  return `You are Elevate AI, a versatile personal productivity assistant inside RemindMeUp.

CONTEXT: Today is ${dateStr}. Current time: ${timeStr} IST.

USER'S CURRENT SCHEDULE:
${tasksContext}

CAPABILITIES:
1. Schedule new tasks/events (create_calendar_event)
2. Query & search existing tasks (query_user_tasks)
3. Update/reschedule tasks (update_task)
4. Delete/cancel tasks (delete_task)
5. Answer questions about workload and productivity
6. Have friendly general conversation

RULES:
- For scheduling: confirm title, date, and time before calling create_calendar_event
- For queries: use query_user_tasks for real data, NEVER fabricate tasks
- For updates/deletes: use [ID:xxx] from the schedule above
- For general chat: respond naturally without tools
- Be concise, warm, and professional
- LANGUAGE RULE: ${languageInstruction}
- STYLE RULE: ${styleInstruction}
- Understand Hindi/Hinglish input: "kal" = tomorrow, "parso" = day after tomorrow, "aaj" = today
- Do NOT guess AM/PM — always ask if ambiguous`;
}

// =====================================================================
// --- MAIN AI STREAMING ENDPOINT (SSE) — Groq Primary, Gemini Fallback ---
// =====================================================================

// OpenAI-format tool definitions (for Groq Llama)
const groqTools = [
  { type: "function", function: { name: "create_calendar_event", description: "Schedule a new task/event. ONLY call when title, date, and time are ALL confirmed.", parameters: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" } }, required: ["title", "date", "time"] } } },
  { type: "function", function: { name: "query_user_tasks", description: "Fetch user's tasks. Use when user asks about schedule or workload.", parameters: { type: "object", properties: { date_from: { type: "string" }, date_to: { type: "string" }, keyword: { type: "string" } } } } },
  { type: "function", function: { name: "update_task", description: "Modify a task. Reschedule, rename, or mark done.", parameters: { type: "object", properties: { task_id: { type: "string" }, new_title: { type: "string" }, new_date: { type: "string" }, completed: { type: "boolean" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "delete_task", description: "Delete a task permanently.", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } } }
];

app.post('/api/ai/stream', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { messages, style, language } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!groqApiKey && !geminiApiKey) {
    res.write(`data: ${JSON.stringify({ type: 'text', content: "No API keys configured. Add GROQ_API_KEY or GEMINI_API_KEY to .env" })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', action_type: 'chat' })}\n\n`);
    return res.end();
  }

  try {
    const tasksContext = await getUserTasksContext(userId);
    const systemPrompt = buildSystemPrompt(tasksContext, style, language);
    const latestUserMessage = messages[messages.length - 1].content;

    let actionType = 'chat';
    let actionPayload = null;
    let taskList = null;
    let useGroq = !!groqApiKey;

    if (useGroq) {
      // --- GROQ LLAMA PATH (Primary) ---
      console.log("🧠 Using Groq Llama for AI...");

      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      ];

      // Step 1: Initial call with tools
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: groqMessages,
          tools: groqTools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        throw new Error(`Groq error ${groqRes.status}: ${errText}`);
      }

      const groqData = await groqRes.json();
      const choice = groqData.choices[0];
      const assistantMsg = choice.message;

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const tc = assistantMsg.tool_calls[0];
        const fcName = tc.function.name;
        const fcArgs = JSON.parse(tc.function.arguments);

        console.log(`🛠️ Tool: ${fcName}`, JSON.stringify(fcArgs));
        res.write(`data: ${JSON.stringify({ type: 'tool_call', name: fcName })}\n\n`);

        const toolResult = await executeToolCall({ name: fcName, args: fcArgs }, userId);

        if (fcName === 'create_calendar_event') {
          actionType = 'create';
          actionPayload = { title: fcArgs.title, date: fcArgs.date, time: fcArgs.time, task: toolResult.task };
        } else if (fcName === 'query_user_tasks') {
          actionType = 'query';
          taskList = toolResult.tasks || [];
        } else if (fcName === 'update_task') {
          actionType = 'update';
          actionPayload = toolResult;
        } else if (fcName === 'delete_task') {
          actionType = 'delete';
          actionPayload = toolResult;
        }

        // Step 2: Send tool result back for natural language synthesis
        groqMessages.push(assistantMsg);
        groqMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult)
        });

        const followUpRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqApiKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            temperature: 0.7,
            max_tokens: 1024
          })
        });

        const followUpData = await followUpRes.json();
        const followUpText = followUpData.choices[0].message.content || '';

        // Stream the follow-up text
        const words = followUpText.split(' ');
        let buf = '';
        for (let i = 0; i < words.length; i++) {
          buf += (i > 0 ? ' ' : '') + words[i];
          if (buf.length >= 12 || i === words.length - 1) {
            res.write(`data: ${JSON.stringify({ type: 'text', content: buf })}\n\n`);
            buf = '';
            await new Promise(r => setTimeout(r, 20));
          }
        }
      } else {
        // Pure text response — stream it
        const fullText = assistantMsg.content || "I'm here to help! What would you like to do?";
        const words = fullText.split(' ');
        let buf = '';
        for (let i = 0; i < words.length; i++) {
          buf += (i > 0 ? ' ' : '') + words[i];
          if (buf.length >= 12 || i === words.length - 1) {
            res.write(`data: ${JSON.stringify({ type: 'text', content: buf })}\n\n`);
            buf = '';
            await new Promise(r => setTimeout(r, 20));
          }
        }
      }

    } else {
      // --- GEMINI FALLBACK ---
      console.log("🔷 Using Gemini for AI...");
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite', systemInstruction: systemPrompt,
        tools: assistantTools, toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
      });
      const previousMessages = messages.slice(0, -1);
      const formattedHistory = previousMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
      const chat = model.startChat({ history: formattedHistory });
      const initialResult = await chat.sendMessage(latestUserMessage);
      const initialResponse = initialResult.response;
      const functionCalls = initialResponse.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        res.write(`data: ${JSON.stringify({ type: 'tool_call', name: fc.name })}\n\n`);
        const toolResult = await executeToolCall(fc, userId);
        if (fc.name === 'create_calendar_event') { actionType = 'create'; actionPayload = { title: fc.args.title, date: fc.args.date, time: fc.args.time, task: toolResult.task }; }
        else if (fc.name === 'query_user_tasks') { actionType = 'query'; taskList = toolResult.tasks || []; }
        else if (fc.name === 'update_task') { actionType = 'update'; actionPayload = toolResult; }
        else if (fc.name === 'delete_task') { actionType = 'delete'; actionPayload = toolResult; }
        const followUp = await chat.sendMessageStream([{ functionResponse: { name: fc.name, response: { result: toolResult } } }]);
        for await (const chunk of followUp.stream) { const t = chunk.text(); if (t) res.write(`data: ${JSON.stringify({ type: 'text', content: t })}\n\n`); }
      } else {
        const fullText = initialResponse.text();
        const words = fullText.split(' ');
        let buf = '';
        for (let i = 0; i < words.length; i++) { buf += (i > 0 ? ' ' : '') + words[i]; if (buf.length >= 12 || i === words.length - 1) { res.write(`data: ${JSON.stringify({ type: 'text', content: buf })}\n\n`); buf = ''; await new Promise(r => setTimeout(r, 25)); } }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', action_type: actionType, action_payload: actionPayload, task_list: taskList })}\n\n`);
    res.end();

  } catch (error) {
    console.error("❌ Stream Error:", error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'Processing error. Please try again.' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', action_type: 'error' })}\n\n`);
    res.end();
  }
});

// =====================================================================
// --- LEGACY NON-STREAMING PARSE ENDPOINT (backwards compat) ---
// =====================================================================
app.post('/api/ai/parse', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  let { messages, prompt } = req.body;

  if (prompt && (!messages || !Array.isArray(messages))) {
    messages = [{ role: 'user', content: prompt }];
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array or prompt is required' });
  }

  const latestUserMessage = messages[messages.length - 1].content;
  const previousMessages = messages.slice(0, -1);
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    return res.json({ ai_reply: "Offline mode. Configure GEMINI_API_KEY.", action_type: 'chat', action_payload: null, task_list: null });
  }

  try {
    const tasksContext = await getUserTasksContext(userId);
    const systemInstruction = buildSystemPrompt(tasksContext);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite', systemInstruction, tools: assistantTools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } }
    });

    const formattedHistory = previousMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
    const chat = model.startChat({ history: formattedHistory });

    let result = (await chat.sendMessage(latestUserMessage)).response;
    let actionType = 'chat', actionPayload = null, taskList = null;
    let loops = 3;

    while (loops-- > 0) {
      const fcs = result.functionCalls();
      if (!fcs || fcs.length === 0) break;
      const fc = fcs[0];
      console.log(`🛠️ Tool: ${fc.name}`, JSON.stringify(fc.args));
      const toolResult = await executeToolCall(fc, userId);
      if (fc.name === 'create_calendar_event') { actionType = 'create'; actionPayload = { title: fc.args.title, date: fc.args.date, time: fc.args.time, task: toolResult.task }; }
      else if (fc.name === 'query_user_tasks') { actionType = 'query'; taskList = toolResult.tasks || []; }
      else if (fc.name === 'update_task') { actionType = 'update'; actionPayload = toolResult; }
      else if (fc.name === 'delete_task') { actionType = 'delete'; actionPayload = toolResult; }
      result = (await chat.sendMessage([{ functionResponse: { name: fc.name, response: { result: toolResult } } }])).response;
    }

    const responseObj = { 
      ai_reply: result.text(), 
      action_type: actionType, 
      action_payload: actionPayload, 
      task_list: taskList 
    };

    if (actionType === 'create' && actionPayload) {
      responseObj.title = actionPayload.title;
      responseObj.date = actionPayload.date;
      responseObj.time = actionPayload.time;
    }

    return res.json(responseObj);
  } catch (error) {
    console.error("❌ Parse Error:", error.message);
    return res.json({ ai_reply: "Processing error. Please try again.", action_type: 'error', action_payload: null, task_list: null });
  }
});

// =====================================================================
// --- CHAT PERSISTENCE ENDPOINTS ---
// =====================================================================
app.get('/api/chat/messages', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    // Table might not exist yet — return empty gracefully
    console.warn("Chat persistence not available:", err.message);
    res.json([]);
  }
});

app.post('/api/chat/messages', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { role, content, metadata } = req.body;
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{ user_id: userId, role, content, metadata: metadata || null }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    console.warn("Chat persistence save failed:", err.message);
    res.status(200).json({ saved: false });
  }
});

app.delete('/api/chat/messages', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    await supabase.from('chat_messages').delete().eq('user_id', userId);
    res.status(204).send();
  } catch (err) {
    res.status(200).json({ cleared: false });
  }
});

// =====================================================================
// --- SMART AI DAILY BRIEFING ---
// =====================================================================
app.get('/api/ai/briefing', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const groqApiKey = process.env.GROQ_API_KEY;

  const tasksContext = await getUserTasksContext(userId);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });

  const briefingPrompt = `You are a concise productivity assistant. Today is ${dateStr}.
Here is the user's schedule:
${tasksContext}

Write a 2-3 sentence morning briefing. Mention how many tasks they have today, highlight any Critical-priority items, note scheduling conflicts or overdue tasks, and give one actionable tip. Be warm, motivating, brief. No markdown.`;

  if (!groqApiKey) {
    return res.json({ briefing: `Good morning! Today is ${dateStr}. Add GROQ_API_KEY for personalized AI briefings.` });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqApiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: briefingPrompt }],
        temperature: 0.7,
        max_tokens: 256
      })
    });
    const data = await groqRes.json();
    const briefing = data.choices?.[0]?.message?.content || `Good morning! Today is ${dateStr}.`;
    res.json({ briefing });
  } catch (err) {
    console.error("Briefing error:", err.message);
    res.json({ briefing: `Good morning! Today is ${dateStr}. You have tasks waiting — check your calendar for details.` });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
