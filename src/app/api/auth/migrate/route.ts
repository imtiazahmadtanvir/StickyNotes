import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Note } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, localNotes = [] }: { userId: string; localNotes?: Note[] } = body;

    if (!userId || userId === 'default-user') {
      return NextResponse.json(
        { success: false, error: 'Valid userId required for note migration.' },
        { status: 400 }
      );
    }

    // 1. Update any existing 'default-user' notes in the database to this user
    await prisma.note.updateMany({
      where: { userId: 'default-user' },
      data: { userId },
    });

    // 2. Upsert each local note into the database under this user
    for (const note of localNotes) {
      if (!note || !note.id) continue;
      await prisma.note.upsert({
        where: { id: note.id },
        update: {
          userId,
          title: note.title || '',
          content: note.content || '',
          color: note.color || 'yellow',
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
          title: note.title || '',
          content: note.content || '',
          color: note.color || 'yellow',
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
    }

    // 3. Fetch all current non-deleted notes for this user
    const userNotes = await prisma.note.findMany({
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
      message: 'Notes migrated and synced successfully!',
      notes: userNotes,
      count: userNotes.length,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to migrate notes.' },
      { status: 500 }
    );
  }
}
