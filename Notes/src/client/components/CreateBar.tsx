import React, { useState, useRef } from 'react';
import { Plus, CheckSquare, Globe, Lock } from 'lucide-react';

interface CreateBarProps {
  onCreateNote: (data: { title: string; content: string; visibility: string; checklistItems?: { text: string }[] }) => void;
}

export default function CreateBar({ onCreateNote }: CreateBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [isChecklist, setIsChecklist] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [items, setItems] = useState<string[]>(['']);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    if (!title.trim() && !content.trim() && !items.some(i => i.trim())) {
      setExpanded(false);
      return;
    }

    if (isChecklist) {
      const checklistItems = items.filter(i => i.trim()).map(text => ({ text }));
      onCreateNote({ title, content: '', visibility, checklistItems });
    } else {
      onCreateNote({ title, content, visibility });
    }

    setTitle('');
    setContent('');
    setVisibility('private');
    setItems(['']);
    setIsChecklist(false);
    setExpanded(false);
  };

  const handleItemKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newItems = [...items];
      newItems.splice(index + 1, 0, '');
      setItems(newItems);
      setTimeout(() => {
        const inputs = containerRef.current?.querySelectorAll('.checklist-input');
        (inputs?.[index + 1] as HTMLInputElement)?.focus();
      }, 0);
    }
    if (e.key === 'Backspace' && !items[index] && items.length > 1) {
      e.preventDefault();
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      setTimeout(() => {
        const inputs = containerRef.current?.querySelectorAll('.checklist-input');
        (inputs?.[Math.max(0, index - 1)] as HTMLInputElement)?.focus();
      }, 0);
    }
  };

  if (!expanded) {
    return (
      <div className="create-bar collapsed" onClick={() => setExpanded(true)}>
        <span className="create-placeholder">Take a note...</span>
        <div className="create-bar-icons">
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setIsChecklist(true); setExpanded(true); }} title="New checklist">
            <CheckSquare size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-bar expanded" ref={containerRef}>
      <input
        type="text"
        className="create-title"
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
      />
      {isChecklist ? (
        <div className="create-checklist">
          {items.map((item, i) => (
            <div key={i} className="checklist-row">
              <Plus size={14} className="checklist-icon" />
              <input
                type="text"
                className="checklist-input"
                placeholder="List item"
                value={item}
                onChange={e => {
                  const newItems = [...items];
                  newItems[i] = e.target.value;
                  setItems(newItems);
                }}
                onKeyDown={e => handleItemKeyDown(i, e)}
              />
            </div>
          ))}
        </div>
      ) : (
        <textarea
          className="create-content"
          placeholder="Take a note..."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
        />
      )}
      <div className="create-bar-footer">
        <div className="create-bar-actions">
          <button
            className={`icon-btn ${isChecklist ? 'active' : ''}`}
            onClick={() => setIsChecklist(!isChecklist)}
            title="Toggle checklist"
          >
            <CheckSquare size={18} />
          </button>
          <button
            className={`icon-btn ${visibility === 'public' ? 'active' : ''}`}
            onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
            title={visibility === 'public' ? 'Public (click to make private)' : 'Private (click to make public)'}
          >
            {visibility === 'public' ? <Globe size={18} /> : <Lock size={18} />}
          </button>
        </div>
        <div className="create-bar-submit">
          <button className="btn btn-sm" onClick={() => { setExpanded(false); setTitle(''); setContent(''); setItems(['']); setIsChecklist(false); setVisibility('private'); }}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit}>Save</button>
        </div>
      </div>
    </div>
  );
}
