const API_BASE = '/tasks/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
  // Auth
  getMe: () => request<any>('/auth/me'),

  // Departments
  getDepartments: () => request<any>('/departments'),
  getDepartmentMembers: (departmentId: string) => request<any>(`/departments/${departmentId}/members`),

  // Tasks
  getTasks: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/tasks${query}`);
  },
  getMyTasks: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/tasks/mine${query}`);
  },
  getTask: (id: string) => request<any>(`/tasks/${id}`),
  createTask: (data: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) => request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  completeTask: (id: string, data: any) => request<any>(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  reopenTask: (id: string) => request<any>(`/tasks/${id}/reopen`, { method: 'POST' }),
  deleteTask: (id: string) => request<any>(`/tasks/${id}`, { method: 'DELETE' }),
  bulkDeleteTasks: (ids: string[]) => request<any>('/tasks/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Templates
  getTemplates: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/templates${query}`);
  },
  createTemplate: (data: any) => request<any>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: any) => request<any>(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => request<any>(`/templates/${id}`, { method: 'DELETE' }),

  // Generation
  triggerGeneration: () => request<any>('/generate', { method: 'POST' }),
};
