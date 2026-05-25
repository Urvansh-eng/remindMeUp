import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://cjzogmgrnqyatupwbyxf.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqem9nbWdybnF5YXR1cHdieXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzQwNDksImV4cCI6MjA5NTIxMDA0OX0.lq3bgKLNUZMyD0w0sUttyEZgexBmdyMb5S3smOysoJM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
