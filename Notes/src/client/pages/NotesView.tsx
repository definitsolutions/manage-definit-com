import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import NoteCard, { type Note } from '../components/NoteCard';
import NoteEditor from '../components/NoteEditor';
import CreateBar from '../components/CreateBar';

interface Label {
  id: string;
  name: string;
  _count: { noteLabels: number };
}

interface NotesViewProps {
  view: 'notes' | 'archive' | 'trash' | 'label';
  searchQuery: string;
  labels: Label[];
  currentUserId: string | null;
  onLabelsChange: () => void;
}

export default function NotesView({ view, searchQuery, labels, currentUserId, onLabelsChange }: NotesViewProps) {
  const { labelId } = useParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fetchNotes = async () => {
    const params: Record<string, string> = {};
    if (view === 'archive') params.archived = 'true';
    if (view === 'trash') params.trashed = 'true';
    if (view === 'label' && labelId) params.labelId = labelId;
    if (searchQuery) params.search = searchQuery;

    try {
      const data = await api.getNotes(params);
      setNotes(data.notes);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchNotes();
  }, [view, labelId, searchQuery]);

  const handleCreateNote = async (data: { title: string; content: string; visibility: string; checklistItems?: { text: string }[] }) => {
    await api.createNote(data);
    fetchNotes();
  };

  const handlePin = async (note: Note) => {
    await api.updateNote(note.id, { pinned: !note.pinned });
    fetchNotes();
  };

  const handleArchive = async (id: string) => {
    await api.archiveNote(id);
    fetchNotes();
    onLabelsChange();
  };

  const handleUnarchive = async (id: string) => {
    await api.unarchiveNote(id);
    fetchNotes();
  };

  const handleTrash = async (id: string) => {
    await api.trashNote(id);
    fetchNotes();
    onLabelsChange();
  };

  const handleRestore = async (id: string) => {
    await api.restoreNote(id);
    fetchNotes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note forever?')) return;
    await api.deleteNote(id);
    fetchNotes();
  };

  const handleEditorUpdate = (updated: Note) => {
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setEditingNote(updated);
  };

  const handleEditorDelete = () => {
    setEditingNote(null);
    fetchNotes();
    onLabelsChange();
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, noteId: string) => {
    setDragId(noteId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, noteId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (noteId !== dragId) {
      setDragOverId(noteId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    // Reorder: move dragId to the position of targetId
    const currentOrder = notes.map(n => n.id);
    const dragIndex = currentOrder.indexOf(dragId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (dragIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    const newOrder = [...currentOrder];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(targetIndex, 0, dragId);

    // Optimistic update
    const reordered = newOrder.map(id => notes.find(n => n.id === id)!).filter(Boolean);
    setNotes(reordered);

    // Only reorder user's own notes
    const ownNoteIds = reordered.filter(n => n.user?.id === currentUserId).map(n => n.id);
    await api.reorderNotes(ownNoteIds);

    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const pinnedNotes = notes.filter(n => n.pinned);
  const unpinnedNotes = notes.filter(n => !n.pinned);

  const viewTitle = {
    notes: '',
    archive: 'Archive',
    trash: 'Trash',
    label: labels.find(l => l.id === labelId)?.name || 'Label',
  }[view];

  const renderNoteCard = (note: Note) => (
    <NoteCard
      key={note.id}
      note={note}
      view={view}
      isOwner={note.user?.id === currentUserId}
      onClick={() => setEditingNote(note)}
      onPin={() => handlePin(note)}
      onArchive={() => handleArchive(note.id)}
      onUnarchive={() => handleUnarchive(note.id)}
      onTrash={() => handleTrash(note.id)}
      onRestore={() => handleRestore(note.id)}
      onDelete={() => handleDelete(note.id)}
      onDragStart={(e) => handleDragStart(e, note.id)}
      onDragOver={(e) => handleDragOver(e, note.id)}
      onDrop={(e) => handleDrop(e, note.id)}
      onDragEnd={handleDragEnd}
      isDragging={dragId === note.id}
      isDragOver={dragOverId === note.id}
    />
  );

  return (
    <div className="notes-view">
      {view === 'notes' && <CreateBar onCreateNote={handleCreateNote} />}

      {viewTitle && <h2 className="view-title">{viewTitle}</h2>}

      {view === 'trash' && notes.length > 0 && (
        <div className="trash-notice">Notes in trash are deleted after 7 days.</div>
      )}

      {notes.length === 0 && !loading && (
        <div className="empty-state">
          <p>{view === 'notes' ? 'No notes yet. Create one above!' : view === 'archive' ? 'No archived notes.' : view === 'trash' ? 'Trash is empty.' : 'No notes with this label.'}</p>
        </div>
      )}

      {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
        <div className="section-label">Pinned</div>
      )}
      {pinnedNotes.length > 0 && (
        <div className="notes-grid">
          {pinnedNotes.map(renderNoteCard)}
        </div>
      )}

      {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
        <div className="section-label">Others</div>
      )}
      {unpinnedNotes.length > 0 && (
        <div className="notes-grid">
          {unpinnedNotes.map(renderNoteCard)}
        </div>
      )}

      {editingNote && (
        <NoteEditor
          note={editingNote}
          labels={labels}
          isOwner={editingNote.user?.id === currentUserId}
          onClose={() => { setEditingNote(null); fetchNotes(); }}
          onUpdate={handleEditorUpdate}
          onDelete={handleEditorDelete}
        />
      )}
    </div>
  );
}
