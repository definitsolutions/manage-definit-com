import React from 'react';
import { Pin, Archive, ArchiveRestore, Trash2, RotateCcw, X, Globe, Lock } from 'lucide-react';

export const NOTE_COLORS: Record<string, { light: string; dark: string }> = {
  default: { light: '#ffffff', dark: '#1e293b' },
  red: { light: '#fee2e2', dark: '#451a1a' },
  orange: { light: '#ffedd5', dark: '#451a03' },
  yellow: { light: '#fef9c3', dark: '#422006' },
  green: { light: '#dcfce7', dark: '#14532d' },
  teal: { light: '#ccfbf1', dark: '#134e4a' },
  blue: { light: '#dbeafe', dark: '#1e3a5f' },
  purple: { light: '#ede9fe', dark: '#2e1065' },
  pink: { light: '#fce7f3', dark: '#500724' },
  gray: { light: '#f3f4f6', dark: '#374151' },
};

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  sortOrder: number;
}

interface NoteLabel {
  id: string;
  label: { id: string; name: string };
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  visibility: string;
  sortOrder: number;
  checklistItems: ChecklistItem[];
  noteLabels: NoteLabel[];
  user: { id: string; displayName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

interface NoteCardProps {
  note: Note;
  view: 'notes' | 'archive' | 'trash' | 'label';
  isOwner: boolean;
  onClick: () => void;
  onPin?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onTrash?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

export default function NoteCard({
  note, view, isOwner, onClick,
  onPin, onArchive, onUnarchive, onTrash, onRestore, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
  isDragging, isDragOver,
}: NoteCardProps) {
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const bgColor = NOTE_COLORS[note.color]?.[theme as 'light' | 'dark'] || NOTE_COLORS.default[theme as 'light' | 'dark'];

  const unchecked = note.checklistItems.filter(i => !i.checked);
  const checked = note.checklistItems.filter(i => i.checked);

  return (
    <div
      className={`note-card ${note.pinned ? 'pinned' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{ backgroundColor: bgColor }}
      onClick={onClick}
      draggable={isOwner && view === 'notes'}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="note-card-top-row">
        {note.pinned && (
          <div className="pin-indicator">
            <Pin size={14} />
          </div>
        )}
        <div className="visibility-indicator" title={note.visibility === 'public' ? 'Public' : 'Private'}>
          {note.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
        </div>
      </div>

      {note.title && <div className="note-card-title">{note.title}</div>}

      {note.content && (
        <div className="note-card-content">{note.content.length > 200 ? note.content.slice(0, 200) + '...' : note.content}</div>
      )}

      {note.checklistItems.length > 0 && (
        <div className="note-card-checklist">
          {unchecked.slice(0, 5).map(item => (
            <div key={item.id} className="note-card-check-item">
              <span className="check-box" /> <span>{item.text}</span>
            </div>
          ))}
          {unchecked.length > 5 && (
            <div className="note-card-more">+{unchecked.length - 5} more items</div>
          )}
          {checked.length > 0 && (
            <div className="note-card-checked-count">{checked.length} checked item{checked.length !== 1 ? 's' : ''}</div>
          )}
        </div>
      )}

      {note.noteLabels.length > 0 && (
        <div className="note-card-labels">
          {note.noteLabels.map(nl => (
            <span key={nl.id} className="note-label-chip">{nl.label.name}</span>
          ))}
        </div>
      )}

      {!isOwner && (
        <div className="note-card-author">{note.user.displayName}</div>
      )}

      {isOwner && (
        <div className="note-card-actions" onClick={e => e.stopPropagation()}>
          {view === 'notes' && (
            <>
              <button className="icon-btn-sm" onClick={onPin} title={note.pinned ? 'Unpin' : 'Pin'}>
                <Pin size={14} />
              </button>
              <button className="icon-btn-sm" onClick={onArchive} title="Archive">
                <Archive size={14} />
              </button>
              <button className="icon-btn-sm" onClick={onTrash} title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
          {view === 'archive' && (
            <>
              <button className="icon-btn-sm" onClick={onUnarchive} title="Unarchive">
                <ArchiveRestore size={14} />
              </button>
              <button className="icon-btn-sm" onClick={onTrash} title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
          {view === 'trash' && (
            <>
              <button className="icon-btn-sm" onClick={onRestore} title="Restore">
                <RotateCcw size={14} />
              </button>
              <button className="icon-btn-sm danger" onClick={onDelete} title="Delete forever">
                <X size={14} />
              </button>
            </>
          )}
          {view === 'label' && (
            <>
              <button className="icon-btn-sm" onClick={onPin} title={note.pinned ? 'Unpin' : 'Pin'}>
                <Pin size={14} />
              </button>
              <button className="icon-btn-sm" onClick={onArchive} title="Archive">
                <Archive size={14} />
              </button>
              <button className="icon-btn-sm" onClick={onTrash} title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
