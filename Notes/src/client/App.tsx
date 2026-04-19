import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { StickyNote, Archive, Trash2, Tag, Plus, Search, Sun, Moon, X, Edit3 } from 'lucide-react';
import { api } from './api/client';
import NotesView from './pages/NotesView';
import SharedIconRail from './components/shared/SharedIconRail';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface Label {
  id: string;
  name: string;
  _count: { noteLabels: number };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    api.getMe().then(data => setUser(data.user)).catch(() => {});
    refreshLabels();
  }, []);

  const refreshLabels = () => {
    api.getLabels().then(data => setLabels(data.labels)).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('notes-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const getActiveView = () => {
    if (location.pathname === '/archive') return 'archive';
    if (location.pathname === '/trash') return 'trash';
    if (location.pathname.startsWith('/label/')) return 'label';
    return 'notes';
  };

  const activeLabelId = location.pathname.startsWith('/label/') ? location.pathname.split('/label/')[1] : null;

  const handleRailNavigate = (path: string, external?: boolean) => {
    if (external) {
      window.location.href = path;
    } else {
      navigate(path);
    }
  };

  return (
    <div className="zendesk-layout">
      <SharedIconRail
        activeId="notes"
        onNavigate={handleRailNavigate}
      />

      <aside className="sidebar">
        <div className="sidebar-header">
          <StickyNote size={22} />
          <h1 className="sidebar-title">Notes</h1>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${getActiveView() === 'notes' ? 'active' : ''}`} onClick={() => navigate('/')}>
            <StickyNote size={18} /> <span>Notes</span>
          </button>
          <button className={`nav-item ${getActiveView() === 'archive' ? 'active' : ''}`} onClick={() => navigate('/archive')}>
            <Archive size={18} /> <span>Archive</span>
          </button>
          <button className={`nav-item ${getActiveView() === 'trash' ? 'active' : ''}`} onClick={() => navigate('/trash')}>
            <Trash2 size={18} /> <span>Trash</span>
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Labels</span>
            <button className="icon-btn" onClick={() => setShowLabelModal(true)} title="Edit labels">
              <Edit3 size={14} />
            </button>
          </div>
          {labels.map(label => (
            <button
              key={label.id}
              className={`nav-item ${activeLabelId === label.id ? 'active' : ''}`}
              onClick={() => navigate(`/label/${label.id}`)}
            >
              <Tag size={18} /> <span>{label.name}</span>
              <span className="nav-count">{label._count.noteLabels}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="zendesk-main">
        <header className="top-bar">
          <div className="top-bar-left">
            <span className="top-bar-app-name">Notes</span>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="icon-btn" onClick={() => setSearchQuery('')}><X size={16} /></button>
            )}
          </div>
          <div className="top-bar-actions">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {user && (
              <div className="top-bar-avatar">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </header>

        <main className="zendesk-content">
          <Routes>
            <Route path="/" element={<NotesView view="notes" searchQuery={searchQuery} labels={labels} currentUserId={user?.id ?? null} onLabelsChange={refreshLabels} />} />
            <Route path="/archive" element={<NotesView view="archive" searchQuery={searchQuery} labels={labels} currentUserId={user?.id ?? null} onLabelsChange={refreshLabels} />} />
            <Route path="/trash" element={<NotesView view="trash" searchQuery={searchQuery} labels={labels} currentUserId={user?.id ?? null} onLabelsChange={refreshLabels} />} />
            <Route path="/label/:labelId" element={<NotesView view="label" searchQuery={searchQuery} labels={labels} currentUserId={user?.id ?? null} onLabelsChange={refreshLabels} />} />
          </Routes>
        </main>
      </div>

      {showLabelModal && (
        <LabelManager labels={labels} onClose={() => { setShowLabelModal(false); refreshLabels(); }} />
      )}
    </div>
  );
}

function LabelManager({ labels, onClose }: { labels: Label[]; onClose: () => void }) {
  const [items, setItems] = useState(labels);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { label } = await api.createLabel({ name: newName.trim() });
    setItems([...items, { ...label, _count: { noteLabels: 0 } }]);
    setNewName('');
  };

  const handleDelete = async (id: string) => {
    await api.deleteLabel(id);
    setItems(items.filter(l => l.id !== id));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Labels</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="label-create-row">
            <input
              type="text"
              placeholder="Create new label"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="label-list">
            {items.map(label => (
              <div key={label.id} className="label-row">
                <Tag size={16} />
                <span className="label-name">{label.name}</span>
                <button className="icon-btn danger" onClick={() => handleDelete(label.id)} title="Delete">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
