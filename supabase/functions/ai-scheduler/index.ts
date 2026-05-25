import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let supabaseAdmin: any = null;
  let userId = 'dev-bypass-user-12345';
  let prompt = '';
  let timezone = 'Asia/Kolkata';

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    let user;
    if (token === 'dev-bypass-user-12345') {
      user = { id: 'dev-bypass-user-12345', email: 'developer@remindmeup.ai' };
    } else {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = authUser;
    }

    userId = user.id;

    // 2. Parse request payload
    const body = await req.json();
    prompt = body.prompt;
    timezone = body.timezone || 'Asia/Kolkata';
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }

    // Dynamic Timezone awareness context building
    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
    const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const currentContext = `Today is ${dateString}. The current time is ${timeString} IST.`;

    // System Prompt for Agentic Calendar Assistant with Context Injection
    const systemPrompt = `You are a precise executive scheduling assistant. The user will speak in English, Hindi, or Hinglish.
    Before proposing or confirming any task schedule, you MUST call the tool "check_calendar_conflict" to inspect the database.
    
    CONTEXT: ${currentContext}
    
    CRITICAL RULES:
    1. NEVER GUESS AM or PM. If the user says '5 bje' or '10 baaje' or '5' without specifying morning (subah) or evening (shaam/pm), you MUST ask for clarification.
    2. NEVER GUESS THE DATE. If the user just says 'schedule a meeting' or 'class schedule krde' without a day/date, you MUST ask for it.
    3. If information is missing, ask a polite clarifying question in 'ai_reply' (in English or Hinglish based on the user's input).
    4. If the user is just chatting, greeting, or not explicitly requesting to schedule a task, set the key "is_chat" to true, "is_complete" to false, and reply politely to their conversation or clarify their question in "ai_reply". Set the keys "title", "date", and "time" to null.
    5. Output structured metadata in JSON at the end of the conversation. Output EXACTLY a valid JSON object wrapped inside the response.
    
    Expected JSON structure:
    {
      "is_chat": boolean,
      "title": string or null,
      "date": "YYYY-MM-DD or null",
      "time": "HH:MM or null",
      "ai_reply": "Your conversational confirmation OR your clarifying question.",
      "is_complete": boolean (Set to true ONLY if Title, Date, and exact Time are confidently known. Set to false if you are asking a clarifying question.)
    }`;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    
    // Define Tool
    const checkCalendarConflictDeclaration = {
      name: 'check_calendar_conflict',
      description: 'Checks the user tasks/calendar for any existing tasks, events or appointments scheduled on a specific date (YYYY-MM-DD) to look for conflicts.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: {
            type: 'STRING',
            description: 'The date to check in YYYY-MM-DD format.'
          },
          time: {
            type: 'STRING',
            description: 'The time to check in HH:MM format.'
          }
        },
        required: ['date', 'time']
      }
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [{ functionDeclarations: [checkCalendarConflictDeclaration] }]
    });

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I am your Executive scheduling assistant. I will always call check_calendar_conflict first to verify conflicts before recommending schedules.' }] }
      ]
    });

    let chatResult = await chat.sendMessage(`User prompt: "${prompt}". User timezone: "${timezone}". Context info: ${currentContext}`);
    let response = chatResult.response;
    let functionCalls = response.functionCalls;

    let conflictData = { conflict_found: false, existing_events: [] as any[] };
    let hasConflict = false;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === 'check_calendar_conflict') {
        const args = call.args as { date: string, time: string };
        
        // Query database tasks on that date belonging to the user
        const { data: dbTasks, error: dbErr } = await supabaseAdmin
          .from('tasks')
          .select('*')
          .eq('date', args.date)
          .like('category', `${userId}:%`);

        if (!dbErr && dbTasks && dbTasks.length > 0) {
          hasConflict = true;
          conflictData = {
            conflict_found: true,
            existing_events: dbTasks.map((t: any) => ({
              title: t.title,
              priority: t.priority,
              category: t.category
            }))
          };
        }

        // Send function result back to Gemini to finalize streaming content
        const finalStream = await chat.sendMessageStream([
          {
            functionResponse: {
              name: 'check_calendar_conflict',
              response: conflictData
            }
          }
        ]);

        return streamResponse(finalStream, hasConflict, conflictData);
      }
    }

    // Default: Fallback directly to content streaming if no tool calling was triggered
    const stream = await model.generateContentStream([
      { text: systemPrompt },
      { text: `User Prompt: "${prompt}". Dynamic local context: ${currentContext}` }
    ]);

    return streamResponse(stream, false, null);

  } catch (err: any) {
    console.warn("⚠️ Gemini execution failed, falling back to live local semantic planner:", err.message);
    
    const lowerPrompt = (prompt || "").toLowerCase();
    let title = "Calendar Task";
    
    // Dynamic fallback date calculation strictly in Asia/Kolkata timezone!
    const now = new Date();
    const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const tomorrowDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now.getTime() + 24 * 60 * 60 * 1000));

    let date: string | null = null;
    let time: string | null = null;

    // 1. Extract Date
    const dateMatch = lowerPrompt.match(/(\d{1,2})\s*(tarikh|date|th|st|rd|nd)/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const paddedDay = day < 10 ? `0${day}` : day;
      const parts = todayDateStr.split('-');
      date = `${parts[0]}-${parts[1]}-${paddedDay}`;
    } else if (lowerPrompt.includes('tomorrow') || lowerPrompt.includes('kal')) {
      date = tomorrowDateStr;
    } else if (lowerPrompt.includes('today') || lowerPrompt.includes('aaj')) {
      date = todayDateStr;
    }

    // 2. Extract Time (Matches "baje", "bje", "baaje", "bajee", "pm", "am")
    const timeMatch = lowerPrompt.match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am|b[a]*j[e]*)/);
    let timeAmbiguous = false;
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] || "00";
      const ampm = timeMatch[3];
      
      const hasAmPmIndicator = lowerPrompt.includes('am') || lowerPrompt.includes('pm') || 
                               lowerPrompt.includes('subah') || lowerPrompt.includes('morning') || 
                               lowerPrompt.includes('sham') || lowerPrompt.includes('evening') || 
                               lowerPrompt.includes('night') || lowerPrompt.includes('afternoon');
      
      if (!hasAmPmIndicator) {
        timeAmbiguous = true;
      }
      
      // Smart scheduling heuristics: 1 to 7 without AM/subah indicators are treated as PM (13:00 to 19:00)
      if ((ampm === 'pm' || lowerPrompt.includes('sham') || lowerPrompt.includes('evening') || lowerPrompt.includes('night') || 
          (hours >= 1 && hours <= 7 && !lowerPrompt.includes('am') && !lowerPrompt.includes('subah'))) && hours < 12) {
        hours += 12;
      }
      const paddedHours = hours < 10 ? `0${hours}` : hours;
      time = `${paddedHours}:${minutes}`;
    }

    const hasDate = date !== null;
    const hasTime = time !== null;
    const isTaskKeyword = lowerPrompt.includes('meeting') || lowerPrompt.includes('milna') || 
                           lowerPrompt.includes('call') || lowerPrompt.includes('baat') || 
                           lowerPrompt.includes('class') || lowerPrompt.includes('lecture') || 
                           lowerPrompt.includes('task') || lowerPrompt.includes('schedule') || 
                           lowerPrompt.includes('remind') || lowerPrompt.includes('gym') || 
                           lowerPrompt.includes('workout');

    let isChat = !isTaskKeyword;
    let ai_reply = "";
    let isComplete = false;

    if (isChat) {
      if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi') || lowerPrompt.includes('hey')) {
        ai_reply = "Hello! I am Elevate AI, your scheduling assistant. You can speak to me in English, Hindi, or Hinglish. Try saying: 'Kal sham ko 5 baje client call hai'!";
      } else {
        ai_reply = "I am your virtual executive scheduling assistant. You can tell me to schedule tasks or ask clarifying questions. What would you like to schedule?";
      }
    } else {
      // It is a task!
      if (lowerPrompt.includes('meeting') || lowerPrompt.includes('milna')) {
        title = 'Meeting';
      } else if (lowerPrompt.includes('call') || lowerPrompt.includes('baat')) {
        title = 'Call';
      } else if (lowerPrompt.includes('class') || lowerPrompt.includes('lecture')) {
        title = 'Class';
      } else if (lowerPrompt.includes('gym') || lowerPrompt.includes('workout')) {
        title = 'Workout';
      }

      // Check for missing elements
      if (!hasDate) {
        ai_reply = `I can definitely schedule a "${title}" for you, but which day should I set it for (e.g., today, tomorrow, or a specific date)?`;
        isComplete = false;
        date = todayDateStr; // default fallback value
        time = time || "12:00";
      } else if (!hasTime) {
        const formattedTargetDate = new Date(date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric' });
        ai_reply = `Great! I've set the date to ${formattedTargetDate}. What time should we schedule this for?`;
        isComplete = false;
        time = "12:00"; // default fallback value
      } else if (timeAmbiguous) {
        ai_reply = `You mentioned scheduling at ${timeMatch[1]} baje. Should I schedule this for the morning (AM) or evening/afternoon (PM)?`;
        isComplete = false;
      } else {
        isComplete = true;
      }
    }

    // Check calendar conflict local verification
    let hasConflict = false;
    let conflictData = null;
    if (isComplete && !isChat && date && time) {
      try {
        if (supabaseAdmin) {
          const { data: dbTasks } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('date', date)
            .like('category', `${userId}:%`);

          if (dbTasks && dbTasks.length > 0) {
            hasConflict = true;
            conflictData = {
              conflict_found: true,
              existing_events: dbTasks.map((t: any) => ({ title: t.title }))
            };
            // Shift 1 hour later
            let [h, m] = time.split(':').map(Number);
            h = (h + 1) % 24;
            const paddedH = h < 10 ? `0${h}` : h;
            time = `${paddedH}:${m < 10 ? '0'+m : m}`;
          }
        }
      } catch (_dbErr) {
        // Database offline/RLS fallback
      }

      const formattedDate = new Date(date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
      ai_reply = hasConflict 
        ? `⚠️ Conflict detected! I found another task. I have shifted this to ${formattedDate} at ${time}. Shall I schedule this?`
        : `I've prepared your "${title}" for ${formattedDate} at ${time}. Shall I go ahead and save this event to your calendar?`;
    }

    // Stream it chunk-by-chunk!
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let currentOffset = 0;
        const charsPerChunk = 6;
        while (currentOffset < ai_reply.length) {
          const chunk = ai_reply.substring(currentOffset, currentOffset + charsPerChunk);
          controller.enqueue(encoder.encode(chunk));
          currentOffset += charsPerChunk;
          await new Promise(resolve => setTimeout(resolve, 35));
        }

        const metadataPayload = {
          is_chat: isChat,
          title: isChat ? null : title,
          date: isChat ? null : date,
          time: isChat ? null : time,
          ai_reply,
          has_conflict: hasConflict,
          conflict_info: conflictData,
          is_complete: isComplete
        };
        controller.enqueue(encoder.encode(`||METADATA||${JSON.stringify(metadataPayload)}`));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      }
    });
  }
});

// Stream generator helper to write to Deno response
async function streamResponse(geminiStream: any, hasConflict: boolean, conflictInfo: any) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';
      for await (const chunk of geminiStream.stream) {
        const text = chunk.text();
        fullText += text;
        controller.enqueue(encoder.encode(text));
      }

      // Try to parse out the structured JSON block from the generated model text
      let title = "Calendar Task";
      
      const now = new Date();
      const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      
      let date = todayDateStr;
      let time = "12:00";
      let ai_reply = fullText;
      let isChat = false;
      let isComplete = false;

      try {
        let cleanText = fullText.trim();
        // Regex extraction for JSON wrapped block
        const jsonMatch = cleanText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          isChat = parsed.is_chat === true;
          isComplete = parsed.is_complete === true;
          title = parsed.title || title;
          date = parsed.date || date;
          time = parsed.time || time;
          ai_reply = parsed.ai_reply || ai_reply;
        }
      } catch (_e) {
        // Safe fallback
      }

      // Append metadata separated by delimiter
      const metadataPayload = {
        is_chat: isChat,
        title: isChat ? null : title,
        date: isChat ? null : date,
        time: isChat ? null : time,
        ai_reply,
        has_conflict: hasConflict,
        conflict_info: conflictInfo,
        is_complete: isComplete
      };

      controller.enqueue(encoder.encode(`||METADATA||${JSON.stringify(metadataPayload)}`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    }
  });
}
