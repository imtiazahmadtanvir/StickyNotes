import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SyncOperationRequest {
  id: string;
  noteId: string;
  action: 'UPSERT' | 'DELETE';
  payload: Record<string, unknown>;
  timestamp: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operations = [], userId = 'default-user' }: { operations: SyncOperationRequest[]; userId?: string } = body;

    if (!Array.isArray(operations)) {
      return NextResponse.json(
        { success: false, error: 'Expected operations array' },
        { status: 400 }
      );
    }

    const processedIds: string[] = [];
    const conflicts: Array<{ noteId: string; reason: string }> = [];

    for (const op of operations) {
      try {
        const payload = op.payload || {};

        if (op.action === 'DELETE') {
          // Soft delete in Supabase
          await prisma.note.updateMany({
            where: { id: op.noteId, userId },
            data: { deletedAt: new Date() },
          });

          await prisma.syncLog.create({
            data: {
              userId,
              deviceId: 'windows-desktop',
              action: 'DELETE',
              noteId: op.noteId,
            },
          });

          processedIds.push(op.id);
        } else {
          // UPSERT Note
          const existing = await prisma.note.findUnique({
            where: { id: op.noteId },
          });

          const clientRevision = typeof payload.revision === 'number' ? payload.revision : 1;

          // Conflict detection
          if (existing && existing.revision > clientRevision + 2) {
            conflicts.push({
              noteId: op.noteId,
              reason: 'Cloud revision is newer than local revision',
            });
            continue;
          }

          await prisma.note.upsert({
            where: { id: op.noteId },
            update: {
              title: typeof payload.title === 'string' ? payload.title : '',
              content: typeof payload.content === 'string' ? payload.content : '',
              color: typeof payload.color === 'string' ? payload.color : 'yellow',
              isPinned: !!payload.isPinned,
              isArchived: !!payload.isArchived,
              positionX: typeof payload.positionX === 'number' ? payload.positionX : 100,
              positionY: typeof payload.positionY === 'number' ? payload.positionY : 100,
              width: typeof payload.width === 'number' ? payload.width : 320,
              height: typeof payload.height === 'number' ? payload.height : 340,
              revision: { increment: 1 },
              deletedAt: payload.deletedAt ? new Date(payload.deletedAt as string) : null,
            },
            create: {
              id: op.noteId,
              userId,
              title: typeof payload.title === 'string' ? payload.title : '',
              content: typeof payload.content === 'string' ? payload.content : '',
              color: typeof payload.color === 'string' ? payload.color : 'yellow',
              isPinned: !!payload.isPinned,
              isArchived: !!payload.isArchived,
              positionX: typeof payload.positionX === 'number' ? payload.positionX : 100,
              positionY: typeof payload.positionY === 'number' ? payload.positionY : 100,
              width: typeof payload.width === 'number' ? payload.width : 320,
              height: typeof payload.height === 'number' ? payload.height : 340,
              revision: clientRevision,
              deletedAt: payload.deletedAt ? new Date(payload.deletedAt as string) : null,
            },
          });

          await prisma.syncLog.create({
            data: {
              userId,
              deviceId: 'windows-desktop',
              action: 'UPSERT',
              noteId: op.noteId,
              revision: clientRevision,
            },
          });

          processedIds.push(op.id);
        }
      } catch (opErr) {
        console.error(`Failed to sync operation ${op.id}:`, opErr);
      }
    }

    return NextResponse.json({
      success: true,
      syncedOperationIds: processedIds,
      conflicts,
      serverTime: new Date().toISOString(),
      message: `Successfully synchronized ${processedIds.length} delta operations with Supabase`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
