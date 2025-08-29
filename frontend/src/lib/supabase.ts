import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Provide a safe fallback when env vars are not set, so build/prerender doesn't fail
function createSupabaseFallback() {
    console.warn('Supabase URL/Anon Key not configured. Chat persistence is disabled.');
    const noOp = async () => ({ data: null, error: { message: 'Supabase not configured' } });
    const chain = () => ({ select: noOp, order: () => ({ eq: noOp }), insert: noOp, delete: () => ({ eq: noOp }) });
    return {
        from: () => ({ select: noOp, order: () => ({ eq: noOp }), insert: noOp, delete: () => ({ eq: noOp }) })
    } as unknown as ReturnType<typeof createClient>;
}

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createSupabaseFallback();

// Chat message interface
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    session_id: string;
}

// Chat session interface
export interface ChatSession {
    id: string;
    created_at: string;
    last_updated: string;
}
