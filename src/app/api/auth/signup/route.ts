import { NextResponse } from 'next/server';
import { findUserByEmail, createUser } from '@/lib/user-db';
import { hashPassword } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = await createUser({
      email,
      name: typeof name === 'string' ? name : undefined,
      passwordHash,
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to create account.' },
      { status: 500 }
    );
  }
}
