const API_BASE = '/notes/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  getMe: () => request<any>('/auth/me'),

  getNotes: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/notes${query}`);
  },
  createNote: (data: any) => request<any>('/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id: string, data: any) => request<any>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  archiveNote: (id: string) => request<any>(`/notes/${id}/archive`, { method: 'POST' }),
  unarchiveNote: (id: string) => request<any>(`/notes/${id}/unarchive`, { method: 'POST' }),
  trashNote: (id: string) => request<any>(`/notes/${id}/trash`, { method: 'POST' }),
  restoreNote: (id: string) => request<any>(`/notes/${id}/restore`, { method: 'POST' }),
  deleteNote: (id: string) => request<any>(`/notes/${id}`, { method: 'DELETE' }),
  reorderNotes: (noteIds: string[]) => request<any>('/notes/reorder', { method: 'POST', body: JSON.stringify({ noteIds }) }),

  addChecklistItem: (noteId: string, data: any) => request<any>(`/notes/${noteId}/checklist`, { method: 'POST', body: JSON.stringify(data) }),
  updateChecklistItem: (noteId: string, itemId: string, data: any) => request<any>(`/notes/${noteId}/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChecklistItem: (noteId: string, itemId: string) => request<any>(`/notes/${noteId}/checklist/${itemId}`, { method: 'DELETE' }),

  getLabels: () => request<any>('/labels'),
  createLabel: (data: any) => request<any>('/labels', { method: 'POST', body: JSON.stringify(data) }),
  updateLabel: (id: string, data: any) => request<any>(`/labels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLabel: (id: string) => request<any>(`/labels/${id}`, { method: 'DELETE' }),

  addNoteLabel: (noteId: string, labelId: string) => request<any>(`/notes/${noteId}/labels/${labelId}`, { method: 'POST' }),
  removeNoteLabel: (noteId: string, labelId: string) => request<any>(`/notes/${noteId}/labels/${labelId}`, { method: 'DELETE' }),
};
