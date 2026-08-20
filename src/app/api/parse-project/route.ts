import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(request: Request) {
  try {
    const { title, description, userId } = await request.json();

    if (!title || !description || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: 'You are an AI that extracts data from project descriptions. Return a JSON object with: "required_skills" (string array), "location" (string, optional), and "budget" (string, optional).',
        },
        {
          role: 'user',
          content: `Extract info for this project:\nTitle: ${title}\nDescription: ${description}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    let required_skills: string[] = [];
    let location = null;
    let budget = null;
    const content = completion.choices[0]?.message?.content;
    
    if (content) {
       try {
           const parsed = JSON.parse(content);
           if (parsed.required_skills && Array.isArray(parsed.required_skills)) required_skills = parsed.required_skills;
           if (parsed.location) location = parsed.location;
           if (parsed.budget) budget = parsed.budget;
       } catch (e) {
           console.error("Failed to parse JSON from Groq:", content);
       }
    }

    // Save project to Supabase
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        owner_id: userId,
        title,
        description,
        required_skills,
        location,
        budget
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error parsing project:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
