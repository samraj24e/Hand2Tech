import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build',
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing text to translate' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: 'You are a translation assistant. If the following text is in English, translate it to Tamil. If it is in Tamil, translate it to English. Return ONLY a JSON object with the key "translated_text". Do not include any other text or explanation.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    let translated_text = null;
    const content = completion.choices[0]?.message?.content;
    
    if (content) {
       try {
           const parsed = JSON.parse(content);
           if (parsed.translated_text) translated_text = parsed.translated_text;
       } catch (e) {
           console.error("Failed to parse JSON from Groq:", content);
       }
    }

    return NextResponse.json({ translated_text: translated_text || text });
  } catch (error) {
    console.error('Error translating text:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
