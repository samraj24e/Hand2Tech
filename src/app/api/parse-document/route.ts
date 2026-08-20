import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build',
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(request: Request) {
  try {
    const { documentText, userId } = await request.json();

    if (!documentText || !userId) {
      return NextResponse.json({ error: 'Missing documentText or userId' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: 'You extract info from resumes/certificates. Return ONLY a valid JSON object with keys: "skills" (array of strings), "location" (string or null), "bio" (short summary string).',
        },
        {
          role: 'user',
          content: `Extract info from the following text:\n\n${documentText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    let skills: string[] = [];
    let location = null;
    let bio = null;
    const content = completion.choices[0]?.message?.content;
    
    if (content) {
       try {
           const parsed = JSON.parse(content);
           if (parsed.skills && Array.isArray(parsed.skills)) skills = parsed.skills;
           else if (Array.isArray(parsed)) skills = parsed;
           if (parsed.location) location = parsed.location;
           if (parsed.bio) bio = parsed.bio;
       } catch (e) {
           console.error("Failed to parse JSON from Groq:", content);
       }
    }

    // Save to Supabase
    const { error } = await supabase
      .from('users')
      .update({ skills, location, bio })
      .eq('id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
    }

    return NextResponse.json({ skills });
  } catch (error) {
    console.error('Error parsing document:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
