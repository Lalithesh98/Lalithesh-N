import {
  Advance,
  DailyExpense,
  LaborExpense,
  MaterialPurchase,
  Project,
  RoleDefinition,
  StagePhoto,
  TaxInvoice,
  User,
} from './types';

const TOKEN_STORAGE_KEY = 'cms_session_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function apiCall<T>(url: string, method = 'GET', body?: any): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = { method, headers };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const err: any = new Error(errData.error || `HTTP error! status: ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json() as Promise<T>;
}

export const appApi = {
  getLoginOptions: async () =>
    apiCall<{ users: User[]; roles: RoleDefinition[] }>('/api/public/login-options'),

  getData: async () => apiCall<any>('/api/data'),

  getSupabaseConfig: async () =>
    apiCall<{ url: string; anonKey: string; configured: boolean }>('/api/supabase-config'),

  login: async (email: string, password: string) =>
    apiCall<{ status: string; user: User; token: string }>('/api/auth/login', 'POST', { email, password }),

  impersonateRole: async (role: string, userId?: string) =>
    apiCall<{ status: string; user: User; token: string }>('/api/auth/impersonate', 'POST', { role, userId }),

  saveRole: async (roleData: Partial<RoleDefinition>) =>
    apiCall<{ status: string; role: RoleDefinition; roles: RoleDefinition[] }>('/api/roles', 'POST', roleData),

  deleteRole: async (id: string) =>
    apiCall<{ status: string; roles: RoleDefinition[] }>(`/api/roles/${id}/delete`, 'POST', {}),

  createUser: async (userData: {
    name: string;
    email: string;
    username: string;
    password: string;
    role: string;
    assignedProjectIds?: string[];
  }) => apiCall<{ status: string; user: User; users: User[] }>('/api/users', 'POST', userData),

  deleteUser: async (id: string) =>
    apiCall<{ status: string; users: User[] }>(`/api/users/${id}/delete`, 'POST', {}),

  saveProject: async (projectData: Partial<Project> & { userId?: string; userName?: string }) =>
    apiCall<{ status: string; project: Project }>('/api/projects', 'POST', projectData),

  deleteProject: async (id: string) =>
    apiCall<{ status: string }>(`/api/projects/${id}/delete`, 'POST', {}),

  addAdvance: async (advanceData: Partial<Advance> & { userId?: string; userName?: string }) =>
    apiCall<{ status: string; advance: Advance }>('/api/advances', 'POST', advanceData),

  addPurchase: async (purchaseData: Partial<MaterialPurchase> & { userId?: string; userName?: string }) =>
    apiCall<{ status: string; purchase: MaterialPurchase }>('/api/purchases', 'POST', purchaseData),

  deletePurchase: async (id: string) =>
    apiCall<{ status: string }>(`/api/purchases/${id}/delete`, 'POST', {}),

  settlePurchaseCredit: async (id: string, payAmount?: number) =>
    apiCall<{ status: string; purchase: MaterialPurchase }>(`/api/purchases/${id}/settle`, 'POST', { payAmount }),

  addLabor: async (laborData: Partial<LaborExpense> & { userId?: string; userName?: string }) =>
    apiCall<{ status: string; labor: LaborExpense }>('/api/labor', 'POST', laborData),

  settleLaborCredit: async (id: string) =>
    apiCall<{ status: string; labor: LaborExpense }>(`/api/labor/${id}/settle`, 'POST', {}),

  addDailyExpense: async (dailyData: Partial<DailyExpense> & { userId?: string; userName?: string }) =>
    apiCall<{ status: string; daily: DailyExpense }>('/api/daily-expenses', 'POST', dailyData),

  settleDailyCredit: async (id: string) =>
    apiCall<{ status: string; daily: DailyExpense }>(`/api/daily-expenses/${id}/settle`, 'POST', {}),

  addStagePhoto: async (photoData: Omit<StagePhoto, 'id' | 'uploadedBy'>) =>
    apiCall<{ status: string; photo: StagePhoto }>('/api/stage-photos', 'POST', photoData),

  deleteStagePhoto: async (id: string) =>
    apiCall<{ status: string }>(`/api/stage-photos/${id}/delete`, 'POST', {}),

  saveTaxInvoice: async (invoiceData: Omit<TaxInvoice, 'id'>) =>
    apiCall<{ status: string; invoice: TaxInvoice }>('/api/tax-invoices', 'POST', invoiceData),

  deleteTaxInvoice: async (id: string) =>
    apiCall<{ status: string }>(`/api/tax-invoices/${id}/delete`, 'POST', {}),

  markNotificationsRead: async () =>
    apiCall<{ status: string }>('/api/notifications/read', 'POST', {}),

  scanBillWithAI: async (dataUrl: string) =>
    apiCall<{ status: string; extracted: Record<string, any> }>('/api/ai/scan-bill', 'POST', { dataUrl }),

  updateUserPassword: async (userId: string, newPassword: string) =>
    apiCall<{ status: string; message: string; users: User[] }>('/api/users/update-password', 'POST', {
      userId,
      newPassword,
    }),

  updateUserProfile: async (
    userId: string,
    profileData: {
      name?: string;
      email?: string;
      username?: string;
      password?: string;
      role?: string;
      assignedProjectIds?: string[];
    }
  ) =>
    apiCall<{ status: string; message: string; users: User[] }>('/api/users/update-profile', 'POST', {
      userId,
      ...profileData,
    }),
};

export default appApi;
