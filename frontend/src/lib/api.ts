const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    roles: string[];
    department?: string;
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'An error occurred',
        error: data.error,
      };
    }

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error occurred',
    };
  }
}

export interface Shift {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  _id: string;
  key: string;
  value: any;
  description?: string;
  category: string;
}

export interface Department {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  hod?: any;
  hr?: any;
  attendanceConfig: {
    lateInLimit: number;
    earlyOutLimit: number;
    lateInGraceTime: number;
    earlyOutGraceTime: number;
  };
  permissionPolicy: {
    dailyLimit: number;
    monthlyLimit: number;
    deductFromSalary: boolean;
    deductionAmount: number;
  };
  autoDeductionRules: Array<{
    trigger: 'late_in' | 'early_out' | 'permission';
    count: number;
    action: 'half_day' | 'full_day' | 'deduct_amount';
    amount?: number;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  login: async (email: string, password: string) => {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Shifts
  getShifts: async (isActive?: boolean) => {
    const query = isActive !== undefined ? `?isActive=${String(isActive)}` : '';
    return apiRequest<Shift[]>(`/shifts${query}`, { method: 'GET' });
  },

  getShift: async (id: string) => {
    return apiRequest<Shift>(`/shifts/${id}`, { method: 'GET' });
  },

  createShift: async (data: { name: string; startTime?: string; endTime?: string; duration?: number }) => {
    return apiRequest<Shift>('/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateShift: async (id: string, data: Partial<Shift>) => {
    return apiRequest<Shift>(`/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteShift: async (id: string) => {
    return apiRequest<void>(`/shifts/${id}`, { method: 'DELETE' });
  },

  getAllowedDurations: async () => {
    return apiRequest<{ data: number[]; durations: any[] }>('/shifts/durations', { method: 'GET' });
  },

  // Shift Durations
  getShiftDurations: async () => {
    return apiRequest<{ success: boolean; count: number; data: number[]; durations: any[] }>('/shifts/durations/all', { method: 'GET' });
  },

  createShiftDuration: async (data: { duration: number; label?: string }) => {
    return apiRequest<any>('/shifts/durations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateShiftDuration: async (id: string, data: { duration?: number; label?: string; isActive?: boolean }) => {
    return apiRequest<any>(`/shifts/durations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteShiftDuration: async (id: string) => {
    return apiRequest<void>(`/shifts/durations/${id}`, { method: 'DELETE' });
  },

  // Users
  getUsers: async (role?: string, department?: string, isActive?: boolean) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (department) params.append('department', department);
    if (isActive !== undefined) params.append('isActive', String(isActive));
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<any[]>(`/users${query}`, { method: 'GET' });
  },

  // Departments
  getDepartments: async (isActive?: boolean) => {
    const query = isActive !== undefined ? `?isActive=${isActive}` : '';
    return apiRequest<Department[]>(`/departments${query}`, { method: 'GET' });
  },

  getDepartment: async (id: string) => {
    return apiRequest<Department>(`/departments/${id}`, { method: 'GET' });
  },

  getDepartmentEmployees: async (id: string) => {
    return apiRequest<any[]>(`/departments/${id}/employees`, { method: 'GET' });
  },

  createDepartment: async (data: Partial<Department>) => {
    return apiRequest<Department>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateDepartment: async (id: string, data: Partial<Department>) => {
    return apiRequest<Department>(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteDepartment: async (id: string) => {
    return apiRequest<void>(`/departments/${id}`, { method: 'DELETE' });
  },

  assignHOD: async (id: string, hodId: string) => {
    return apiRequest<Department>(`/departments/${id}/assign-hod`, {
      method: 'PUT',
      body: JSON.stringify({ hodId }),
    });
  },

  assignHR: async (id: string, hrId: string) => {
    return apiRequest<Department>(`/departments/${id}/assign-hr`, {
      method: 'PUT',
      body: JSON.stringify({ hrId }),
    });
  },

  assignShifts: async (id: string, shiftIds: string[]) => {
    return apiRequest<Department>(`/departments/${id}/shifts`, {
      method: 'PUT',
      body: JSON.stringify({ shiftIds }),
    });
  },

  // Designations
  getDesignations: async (departmentId: string) => {
    return apiRequest<any[]>(`/departments/${departmentId}/designations`, { method: 'GET' });
  },

  getDesignation: async (id: string) => {
    return apiRequest<any>(`/departments/designations/${id}`, { method: 'GET' });
  },

  createDesignation: async (departmentId: string, data: any) => {
    return apiRequest<any>(`/departments/${departmentId}/designations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateDesignation: async (id: string, data: any) => {
    return apiRequest<any>(`/departments/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteDesignation: async (id: string) => {
    return apiRequest<void>(`/departments/designations/${id}`, { method: 'DELETE' });
  },

  // Settings
  getSettings: async (category?: string) => {
    const query = category ? `?category=${category}` : '';
    return apiRequest<Setting[]>(`/settings${query}`, { method: 'GET' });
  },

  getSetting: async (key: string) => {
    return apiRequest<Setting>(`/settings/${key}`, { method: 'GET' });
  },

  upsertSetting: async (data: { key: string; value: any; description?: string; category?: string }) => {
    return apiRequest<Setting>('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSetting: async (key: string, data: { value: any; description?: string; category?: string }) => {
    return apiRequest<Setting>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Users
  getUsers: async (role?: string, department?: string, isActive?: boolean) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (department) params.append('department', department);
    if (isActive !== undefined) params.append('isActive', String(isActive));
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<any[]>(`/users${query}`, { method: 'GET' });
  },
};

