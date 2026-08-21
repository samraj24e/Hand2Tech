import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { parseProfileMetadata, stringifyProfileMetadata } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { workerId, reviewerName, rating, text } = await request.json();

    if (!workerId || !reviewerName || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch current worker data
    const { data: worker, error: fetchError } = await supabase
      .from('users')
      .select('bio, rating')
      .eq('id', workerId)
      .single();

    if (fetchError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // 2. Parse bio, append review
    const metadata = parseProfileMetadata(worker.bio);
    if (!metadata.reviews) metadata.reviews = [];
    
    metadata.reviews.unshift({
      reviewer: reviewerName,
      rating: Number(rating),
      text: text || "",
      date: new Date().toISOString()
    });

    // 3. Calculate new average rating
    const currentRating = Number(worker.rating || 5.0);
    // Simple moving average based on number of reviews + 1 base
    const numReviews = metadata.reviews.length;
    const newRating = ((currentRating * (numReviews > 1 ? numReviews : 1)) + Number(rating)) / (numReviews + 1);

    // 4. Update the user record
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        bio: stringifyProfileMetadata(metadata),
        rating: Math.round(newRating * 10) / 10
      })
      .eq('id', workerId);

    if (updateError) {
      // Note: If RLS is strictly enforced on users table to prevent other users updating, 
      // this might fail with standard supabase client. In an MVP environment without strict RLS, it works.
      console.error("Update Error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
