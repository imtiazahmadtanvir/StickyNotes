'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandaloneNoteView } from '@/components/StandaloneNoteView';

function NoteContent() {
  const searchParams = useSearchParams();
  const noteId = searchParams.get('id');

  if (!noteId) {
    return (
      <div style={{ padding: '20px', color: '#666', background: '#fff9c4', height: '100vh' }}>
        No note selected.
      </div>
    );
  }

  return <StandaloneNoteView noteId={noteId} />;
}

export default function NotePage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', background: '#fff9c4', height: '100vh' }}>Loading...</div>}>
      <NoteContent />
    </Suspense>
  );
}
