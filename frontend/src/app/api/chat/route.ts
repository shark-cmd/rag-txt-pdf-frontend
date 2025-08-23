import axios from 'axios';

export async function POST(req: Request) {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    try {
        // Call our backend API
        const response = await axios.post('http://backend:3000/api/query', {
            question: lastMessage.content
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

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response('Error processing request', { status: 500 });
    }
}
