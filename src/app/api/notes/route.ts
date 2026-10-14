import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/notes - Retrieve notes from Supabase PostgreSQL
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    const notes = await prisma.note.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notes retrieved from Supabase',
      data: notes,
      count: notes.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create or update note in Supabase PostgreSQL
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { note, userId = 'default-user' } = body;

    if (!note || !note.id) {
      return NextResponse.json(
        { success: false, error: 'Note payload is invalid' },
        { status: 400 }
      );
    }

    const saved = await prisma.note.upsert({
      where: { id: note.id },
      update: {
        title: note.title ?? '',
        content: note.content ?? '',
        color: note.color ?? 'yellow',
        isPinned: !!note.isPinned,
        isArchived: !!note.isArchived,
        positionX: note.positionX ?? 100,
        positionY: note.positionY ?? 100,
        width: note.width ?? 320,
        height: note.height ?? 340,
        revision: { increment: 1 },
        deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
      },
      create: {
        id: note.id,
        userId,
        title: note.title ?? '',
        content: note.content ?? '',
        color: note.color ?? 'yellow',
        isPinned: !!note.isPinned,
        isArchived: !!note.isArchived,
        positionX: note.positionX ?? 100,
        positionY: note.positionY ?? 100,
        width: note.width ?? 320,
        height: note.height ?? 340,
        revision: note.revision || 1,
        deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Note saved to Supabase',
      note: saved,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
