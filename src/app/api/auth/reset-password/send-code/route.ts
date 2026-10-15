import { NextResponse } from 'next/server';
import { findUserByEmail, createPasswordResetToken } from '@/lib/user-db';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No account registered with this email address.' },
        { status: 404 }
      );
    }

    // Generate verified 6-digit OTP token in Supabase PostgreSQL
    const code = await createPasswordResetToken(email);

    // If Supabase client is configured, also trigger official Supabase Auth recovery email
    if (supabase) {
      try {
        await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      } catch (err) {
        console.warn('Supabase Auth reset email notice:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'A 6-digit verification code has been generated.',
      // Provided for immediate display/confirmation in the UI
      verificationCode: code,
    });
  } catch (error) {
    console.error('Send reset code error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to send verification code.' },
      { status: 500 }
    );
  }
}
