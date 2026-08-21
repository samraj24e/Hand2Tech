import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy_key_for_build',
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(request: Request) {
  try {
    const { title, descriptionText, duration, closing_time, distance_limit, project_phase, userId } = await request.json();

    if (!title || !descriptionText || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let required_skills: string[] = [];
    let location = null;
    let budget = null;
    let bom_estimate: string[] = [];

    try {
      const completion = await openai.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are an AI that extracts data from project descriptions. Return a JSON object with: "required_skills" (string array), "location" (string, optional), "budget" (string, optional), AND "bom_estimate" (array of 3 strings of physical materials needed, noting which ones could be sourced from scrap).',
          },
          {
            role: 'user',
            content: `Extract info for this project:\nTitle: ${title}\nDescription: ${descriptionText}\nDuration: ${duration}\nPhase: ${project_phase}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      
      if (content) {
         try {
             const parsed = JSON.parse(content);
             if (parsed.required_skills && Array.isArray(parsed.required_skills)) required_skills = parsed.required_skills;
             if (parsed.location) location = parsed.location;
             if (parsed.budget) budget = parsed.budget;
             if (parsed.bom_estimate && Array.isArray(parsed.bom_estimate)) bom_estimate = parsed.bom_estimate;
         } catch (e) {
             console.error("Failed to parse JSON from Groq:", content);
         }
      }
    } catch (aiError) {
      console.error("AI processing failed, falling back to basic project creation:", aiError);
      required_skills = ["general labor"];
      bom_estimate = ["Basic tools", "Standard materials"];
    }

    const description = JSON.stringify({
      descriptionText,
      duration,
      closing_time,
      distance_limit,
      budget,
      project_phase
    });

    // Save project to Supabase
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        owner_id: userId,
        title,
        description,
        required_skills,
        location,
        budget,
        bom_estimate
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error parsing project:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
