import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
    const { messages, excludedSources, topK, backendUrl: overrideBackend } = await req.json();
    const lastMessage = messages[messages.length - 1];

    try {
        // Call our backend API
        const backendUrl = overrideBackend || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const response = await axios.post(`${backendUrl.replace(/\/$/, '')}/api/query`, {
            question: lastMessage.content,
            excludedSources: excludedSources || [],
            topK: typeof topK === 'number' ? topK : undefined,
        });

        const answer = response.data.answer?.response || response.data.answer || response.data.response || 'No answer returned.';
        const sources = response.data.answer?.sources || response.data.sources || [];

        console.log('Backend response:', response.data);
        console.log('Sending answer:', answer);
        console.log('Sources:', sources);

        // Return response with answer and sources
        const responseData = {
            answer,
            sources
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json({ error: 'Error processing request' }, { status: 500 });
    }
}
