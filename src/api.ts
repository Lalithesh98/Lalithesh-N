import { 
  Project, 
  Advance, 
  MaterialPurchase, 
  LaborExpense, 
  DailyExpense, 
  User 
} from './types';

// Standardized fetch wrapper
async function apiCall<T>(url: string, method = 'GET', body?: any): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const appApi = {
  // Fetch complete DB state (Includes projects, advances, purchases, labor, daily expenses, logs, users, notifications)
  getData: async () => {
    return apiCall<any>('/api/data');
  },

  // Auth login
  login: async (email: string, password?: string) => {
    return apiCall<{ status: string; user: User }>('/api/auth/login', 'POST', { email, password });
  },

  // Projects
  saveProject: async (projectData: Partial<Project> & { userId: string; userName: string }) => {
    return apiCall<{ status: string; project: Project }>('/api/projects', 'POST', projectData);
  },

  deleteProject: async (id: string, userId: string, userName: string) => {
    return apiCall<{ status: string }>('/api/projects/' + id + '/delete', 'POST', { userId, userName });
  },

  // Advances
  addAdvance: async (advanceData: Partial<Advance> & { userId: string; userName: string }) => {
    return apiCall<{ status: string; advance: Advance }>('/api/advances', 'POST', advanceData);
  },

  // Material Purchases
  addPurchase: async (purchaseData: Partial<MaterialPurchase> & { userId: string; userName: string }) => {
    return apiCall<{ status: string; purchase: MaterialPurchase }>('/api/purchases', 'POST', purchaseData);
  },

  deletePurchase: async (id: string, userId: string, userName: string) => {
    return apiCall<{ status: string }>('/api/purchases/' + id + '/delete', 'POST', { userId, userName });
  },

  // Labor Expenses
  addLabor: async (laborData: Partial<LaborExpense> & { userId: string; userName: string }) => {
    return apiCall<{ status: string; labor: LaborExpense }>('/api/labor', 'POST', laborData);
  },

  // Daily Site Expenses
  addDailyExpense: async (dailyData: Partial<DailyExpense> & { userId: string; userName: string }) => {
    return apiCall<{ status: string; daily: DailyExpense }>('/api/daily-expenses', 'POST', dailyData);
  },

  // Notification reading
  markNotificationsRead: async (userId: string) => {
    return apiCall<{ status: string }>('/api/notifications/read', 'POST', { userId });
  },

  // Import / restore DB state
  importDatabase: async (dbData: any) => {
    return apiCall<{ status: string; message: string }>('/api/database/import', 'POST', dbData);
  },

  // Get Firebase configuration
  getFirebaseConfig: async () => {
    return apiCall<any>('/api/firebase-config');
  },

  // Explicitly pull database state from cloud backup
  pullDatabaseFromCloud: async () => {
    return apiCall<{ status: string; message: string }>('/api/database/pull', 'POST');
  },

  // Explicitly push database state to cloud backup
  pushDatabaseToCloud: async () => {
    return apiCall<{ status: string; message: string }>('/api/database/push', 'POST');
  },

  // Update a user password
  updateUserPassword: async (userId: string, newPassword: string, adminUserId: string, adminUserName: string) => {
    return apiCall<{ status: string; message: string; users: any[] }>('/api/users/update-password', 'POST', {
      userId,
      newPassword,
      adminUserId,
      adminUserName,
    });
  },

  // Update full user profile credentials and details
  updateUserProfile: async (
    userId: string,
    profileData: { name?: string; email?: string; username?: string; password?: string; role?: string },
    adminUserId: string,
    adminUserName: string
  ) => {
    return apiCall<{ status: string; message: string; users: any[] }>('/api/users/update-profile', 'POST', {
      userId,
      ...profileData,
      adminUserId,
      adminUserName,
    });
  },
};
export default appApi;
