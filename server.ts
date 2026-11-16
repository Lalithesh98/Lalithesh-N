import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  BorrowingRepayment,
  BorrowingStatus,
  DailyExpenseCategory,
  MaterialCategory,
  PaymentStatus,
  ProjectBorrowing,
  ProjectStatus,
  RoleDefinition,
  UserRole,
  WorkerType,
} from './src/types';
import {
  getBorrowingsFromDb,
  saveBorrowingToDb,
  addRepaymentToDb,
  deleteBorrowingFromDb,
  deleteRepaymentFromDb,
} from './src/lib/borrowingService';
import {
  getSupabaseAdmin,
  hashPassword,
  mapAdvance,
  mapAuditLog,
  mapDaily,
  mapLabor,
  mapNotification,
  mapProject,
  mapPurchase,
  mapRole,
  mapStagePhoto,
  mapTaxInvoice,
  mapUser,
  SessionPayload,
  signSessionToken,
  uploadDataUrlIfNeeded,
  verifyPassword,
  verifySessionToken,
} from './src/lib/supabaseServer';

interface AuthenticatedRequest extends Request {
  auth?: SessionPayload;
  roleDef?: RoleDefinition;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const supabase = getSupabaseAdmin();

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

async function ensureDefaultRolesAndUsers() {
  const { data: existingRoles, error: rolesErr } = await supabase.from('app_roles').select('*');
  if (!rolesErr) {
    if (!existingRoles || existingRoles.length === 0) {
      await supabase.from('app_roles').upsert([
        {
          id: 'role_admin',
          name: 'Admin',
          description: 'Full system control over sites, advances, borrowings, expenses, role access, and user accounts.',
          allowed_tabs: ['dashboard', 'projects', 'advances', 'borrowings', 'materials', 'labor', 'daily', 'reconciliation', 'documents', 'reports', 'audit', 'photos'],
          can_write_expenses: true,
          can_manage_projects: true,
          can_manage_roles: true,
          is_system: true,
        },
        {
          id: 'role_proprietor',
          name: 'Proprietor',
          description: 'Executive oversight, financial reconciliations, borrowings, reports, documents, and stage progress.',
          allowed_tabs: ['dashboard', 'borrowings', 'reconciliation', 'documents', 'reports', 'photos'],
          can_write_expenses: false,
          can_manage_projects: false,
          can_manage_roles: false,
          is_system: false,
        },
        {
          id: 'role_mestri',
          name: 'Mestri',
          description: 'On-site supervisor logging material purchases, labor wages, daily expenses, and stage photos.',
          allowed_tabs: ['dashboard', 'materials', 'labor', 'daily', 'documents', 'photos'],
          can_write_expenses: true,
          can_manage_projects: false,
          can_manage_roles: false,
          is_system: false,
        },
      ], { onConflict: 'id' });
    } else {
      // Ensure existing Admin and Proprietor roles include 'borrowings'
      for (const r of existingRoles) {
        if ((r.id === 'role_admin' || r.id === 'role_proprietor' || r.name === 'Admin' || r.name === 'Proprietor') &&
            Array.isArray(r.allowed_tabs) && !r.allowed_tabs.includes('borrowings')) {
          await supabase.from('app_roles').update({ allowed_tabs: [...r.allowed_tabs, 'borrowings'] }).eq('id', r.id);
        }
      }
    }
  }

  const { data: existing, error } = await supabase.from('app_users').select('id').limit(1);
  if (error) {
    console.error('Supabase connection check failed:', error.message);
    return;
  }
  if (!existing || existing.length === 0) {
    const defaults = [
      {
        id: 'u1',
        name: 'Primary Admin',
        email: 'admin@lvconstructions.com',
        username: 'admin',
        role: UserRole.ADMIN,
        password_hash: hashPassword('admin123'),
        assigned_project_ids: [],
      },
    ];
    const { error: insertErr } = await supabase.from('app_users').upsert(defaults, { onConflict: 'id' });
    if (insertErr) console.error('Failed seeding default admin:', insertErr.message);
    else console.log('Seeded default Admin user into Supabase.');
  }
}

async function getRoleDefinitionByName(roleName: string): Promise<RoleDefinition | null> {
  const { data } = await supabase
    .from('app_roles')
    .select('*')
    .ilike('name', roleName.trim())
    .limit(1)
    .maybeSingle();
  return data ? mapRole(data) : null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
  req.auth = payload;
  next();
}

type Capability = 'canManageRoles' | 'canManageProjects' | 'canWriteExpenses' | 'canRaiseInvoices' | 'canExport';

function requireCapability(cap: Capability) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    try {
      // Look up live user role from DB so role updates apply immediately
      const { data: userRow } = await supabase
        .from('app_users')
        .select('role')
        .eq('id', req.auth.userId)
        .maybeSingle();

      const activeRoleName = userRow?.role || req.auth.role;
      const roleDef = await getRoleDefinitionByName(activeRoleName);
      if (!roleDef) {
        return res.status(403).json({ error: `Role "${activeRoleName}" is not configured.` });
      }
      req.roleDef = roleDef;

      const allowed =
        (cap === 'canManageRoles' && roleDef.canManageRoles) ||
        (cap === 'canManageProjects' && (roleDef.canManageProjects || roleDef.canManageRoles)) ||
        (cap === 'canWriteExpenses' && (roleDef.canWriteExpenses || roleDef.canManageRoles)) ||
        (cap === 'canRaiseInvoices' && (roleDef.canManageRoles || roleDef.allowedTabs.includes('audit') || roleDef.allowedTabs.includes('reports'))) ||
        (cap === 'canExport' && (roleDef.canManageRoles || roleDef.allowedTabs.includes('reports') || roleDef.allowedTabs.includes('reconciliation')));

      if (!allowed) {
        return res.status(403).json({ error: `Permission denied for role ${activeRoleName} (${cap}).` });
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: 'Authorization check failed: ' + err.message });
    }
  };
}

async function writeAuditLog(params: {
  action: string;
  tableAffected: string;
  recordId: string;
  previousValue: string;
  newValue: string;
  userId: string;
  userName: string;
}) {
  const { error } = await supabase.from('audit_logs').insert({
    id: genId('audit'),
    action: params.action,
    table_affected: params.tableAffected,
    record_id: params.recordId,
    previous_value: params.previousValue,
    new_value: params.newValue,
    date: new Date().toISOString(),
    user_id: params.userId,
    user_name: params.userName,
  });
  if (error) console.error('Audit log write failed:', error.message);
}

async function checkBusinessRulesAndNotify(projectId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (!project) return;

  const [{ data: purchases }, { data: labor }, { data: daily }, { data: advances }, { data: existingNotifs }] =
    await Promise.all([
      supabase.from('material_purchases').select('*').eq('project_id', projectId).eq('is_deleted', false),
      supabase.from('labor_expenses').select('*').eq('project_id', projectId),
      supabase.from('daily_expenses').select('*').eq('project_id', projectId),
      supabase.from('advances').select('*').eq('project_id', projectId),
      supabase.from('notifications').select('*').eq('project_id', projectId),
    ]);

  const purchasesList = purchases || [];
  const laborList = labor || [];
  const dailyList = daily || [];
  const advancesList = advances || [];
  const notifsList = existingNotifs || [];

  const purchasesTotal = purchasesList.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const laborTotal = laborList.reduce((sum, l) => sum + (Number(l.total_wage) || 0), 0);
  const dailyTotal = dailyList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalSpent = purchasesTotal + laborTotal + dailyTotal;

  const totalBudget = Number(project.total_budget) || 0;
  if (totalSpent > totalBudget) {
    const hasBudgetAlert = notifsList.some((n) => n.type === 'budget_exceeded');
    if (!hasBudgetAlert) {
      await supabase.from('notifications').insert({
        id: genId('notif'),
        project_id: projectId,
        project_name: project.project_name,
        message: `🚨 WARNING: Project "${project.project_name}" budget of ₹${totalBudget.toLocaleString()} has been exceeded! Total spent is ₹${totalSpent.toLocaleString()}.`,
        type: 'budget_exceeded',
        date: new Date().toISOString(),
        amount: totalSpent,
        is_read_by: [],
      });
    }
  }

  const paidPurchases = purchasesList.reduce((sum, p) => {
    if (p.paid_amount !== null && p.paid_amount !== undefined) return sum + Number(p.paid_amount);
    return sum + (p.payment_status !== PaymentStatus.CREDIT ? Number(p.total_amount) || 0 : 0);
  }, 0);
  const paidLabor = laborList
    .filter((l) => l.payment_status !== PaymentStatus.CREDIT)
    .reduce((sum, l) => sum + (Number(l.total_wage) || 0), 0);
  const paidDaily = dailyList
    .filter((d) => d.payment_status !== PaymentStatus.CREDIT)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const totalAdvances = advancesList.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const remainingAdvance = totalAdvances - (paidPurchases + paidLabor + paidDaily);

  if (remainingAdvance < 10000 && totalAdvances > 0) {
    const hasBalanceAlert = notifsList.some(
      (n) => n.type === 'low_advance_balance' && Number(n.amount) === remainingAdvance
    );
    if (!hasBalanceAlert) {
      const supervisorLabel = project.assigned_mestri_name || 'Site Supervisor';
      await supabase.from('notifications').insert({
        id: genId('notif'),
        project_id: projectId,
        project_name: project.project_name,
        message: `⚠️ ATTENTION: ${supervisorLabel} advance balance is extremely low at ₹${remainingAdvance.toLocaleString()} for project "${project.project_name}". Please top up advance soon!`,
        type: 'low_advance_balance',
        date: new Date().toISOString(),
        amount: remainingAdvance,
        is_read_by: [],
      });
    }
  }
}

async function fetchCompleteDatabaseState(authUser?: SessionPayload) {
  const [
    rolesRes,
    usersRes,
    projectsRes,
    advancesRes,
    purchasesRes,
    laborRes,
    dailyRes,
    stagePhotosRes,
    taxInvoicesRes,
    auditRes,
    notifRes,
  ] = await Promise.all([
    supabase.from('app_roles').select('*').order('created_at', { ascending: true }),
    supabase.from('app_users').select('id, name, email, username, role, assigned_project_ids').order('id'),
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('advances').select('*').order('date', { ascending: false }),
    supabase.from('material_purchases').select('*').order('date', { ascending: false }),
    supabase.from('labor_expenses').select('*').order('date', { ascending: false }),
    supabase.from('daily_expenses').select('*').order('date', { ascending: false }),
    supabase.from('stage_photos').select('*').order('created_at', { ascending: false }),
    supabase.from('tax_invoices').select('*').order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').order('date', { ascending: false }).limit(250),
    supabase.from('notifications').select('*').order('date', { ascending: false }).limit(100),
  ]);

  const errors = [
    rolesRes.error,
    usersRes.error,
    projectsRes.error,
    advancesRes.error,
    purchasesRes.error,
    laborRes.error,
    dailyRes.error,
    stagePhotosRes.error,
    taxInvoicesRes.error,
    auditRes.error,
    notifRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]!.message);
  }

  const roles = (rolesRes.data || []).map(mapRole);
  const users = (usersRes.data || []).map(mapUser);
  let projects = (projectsRes.data || []).map(mapProject);
  let advances = (advancesRes.data || []).map(mapAdvance);
  let purchases = (purchasesRes.data || []).map(mapPurchase);
  let laborExpenses = (laborRes.data || []).map(mapLabor);
  let dailyExpenses = (dailyRes.data || []).map(mapDaily);
  let stagePhotos = (stagePhotosRes.data || []).map(mapStagePhoto);
  let notifications = (notifRes.data || []).map(mapNotification);

  // Fetch borrowings & loan repayments
  const borrowingsData = await getBorrowingsFromDb(supabase);
  let borrowings = borrowingsData.borrowings;

  // Scope sites for site-restricted users (e.g., site-specific Mestris)
  if (authUser) {
    const me = users.find((u) => u.id === authUser.userId);
    const myRole = roles.find((r) => r.name.toLowerCase() === (me?.role || authUser.role).toLowerCase());
    const isUnrestricted = Boolean(myRole?.canManageRoles || myRole?.canManageProjects);

    if (!isUnrestricted && me) {
      const explicitIds = new Set(me.assignedProjectIds || []);
      const mestriAssignedProjects = projects.filter(
        (p) => explicitIds.has(p.id) || p.assignedMestriId === me.id
      );

      // If this user has explicit site assignments (via user profile OR project.assignedMestriId), scope to those sites
      if (explicitIds.size > 0 || mestriAssignedProjects.length > 0) {
        const allowedIds = new Set(mestriAssignedProjects.map((p) => p.id));
        projects = projects.filter((p) => allowedIds.has(p.id));
        advances = advances.filter((a) => allowedIds.has(a.projectId));
        purchases = purchases.filter((p) => allowedIds.has(p.projectId));
        laborExpenses = laborExpenses.filter((l) => allowedIds.has(l.projectId));
        dailyExpenses = dailyExpenses.filter((d) => allowedIds.has(d.projectId));
        stagePhotos = stagePhotos.filter((s) => allowedIds.has(s.projectId));
        notifications = notifications.filter((n) => allowedIds.has(n.projectId));
        borrowings = borrowings.filter((b) => allowedIds.has(b.projectId));
      }
    }
  }

  return {
    roles,
    users,
    projects,
    advances,
    borrowings,
    purchases,
    laborExpenses,
    dailyExpenses,
    stagePhotos,
    taxInvoices: (taxInvoicesRes.data || []).map(mapTaxInvoice),
    auditLogs: (auditRes.data || []).map(mapAuditLog),
    notifications,
  };
}

// Health check
app.get('/api/health', async (_req, res) => {
  const { error } = await supabase.from('app_users').select('id').limit(1);
  res.json({
    status: error ? 'degraded' : 'ok',
    database: error ? error.message : 'supabase',
    time: new Date().toISOString(),
  });
});

// Public login options (dynamically fetched from Supabase; never includes passwords)
app.get('/api/public/login-options', async (_req, res) => {
  try {
    const [{ data: usersData, error: uErr }, { data: rolesData, error: rErr }] = await Promise.all([
      supabase.from('app_users').select('id, name, email, username, role, assigned_project_ids').order('id'),
      supabase.from('app_roles').select('*').order('created_at', { ascending: true }),
    ]);
    if (uErr) throw uErr;
    if (rErr) throw rErr;
    res.json({
      users: (usersData || []).map(mapUser),
      roles: (rolesData || []).map(mapRole),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed loading login options: ' + err.message });
  }
});

// Public Supabase config for client Realtime indicator
app.get('/api/supabase-config', (_req, res) => {
  res.json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  });
});

// Auth Login (verifies password hash strictly)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const target = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const candidatePassword = typeof password === 'string' ? password : '';

    if (!target || !candidatePassword) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const { data: users, error } = await supabase.from('app_users').select('*');
    if (error) throw error;

    const userRow = (users || []).find(
      (u: any) =>
        (u.email && u.email.toLowerCase() === target) ||
        (u.username && u.username.toLowerCase() === target)
    );

    if (!userRow) {
      return res.status(404).json({ error: 'Account not found. Check your username or email.' });
    }

    if (!verifyPassword(candidatePassword, userRow.password_hash)) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const user = mapUser(userRow);
    const token = signSessionToken(user);
    res.json({ status: 'success', user, token });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Admin role/user simulation switch (requires canManageRoles capability)
app.post('/api/auth/impersonate', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { role, userId } = req.body || {};
    let query = supabase.from('app_users').select('id, name, email, username, role, assigned_project_ids');
    if (userId) {
      query = query.eq('id', userId);
    } else if (role) {
      query = query.eq('role', role);
    } else {
      return res.status(400).json({ error: 'role or userId is required.' });
    }

    const { data: userRow, error } = await query.limit(1).maybeSingle();
    if (error || !userRow) {
      return res.status(404).json({ error: `No user account found for ${userId || role}. Create a user with this role first.` });
    }

    const user = mapUser(userRow);
    const token = signSessionToken(user);
    res.json({ status: 'success', user, token });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed switching role: ' + err.message });
  }
});

// GET complete database state
app.get('/api/data', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const state = await fetchCompleteDatabaseState(req.auth);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed loading Supabase database: ' + err.message });
  }
});

// Export entire database as JSON backup
app.get('/api/database/export', requireAuth, requireCapability('canExport'), async (req: AuthenticatedRequest, res) => {
  try {
    const state = await fetchCompleteDatabaseState(req.auth);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=lv_constructions_supabase_backup.json');
    res.send(JSON.stringify(state, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export database: ' + err.message });
  }
});

// DYNAMIC ROLES CRUD
app.post('/api/roles', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id, name, description, allowedTabs, canWriteExpenses, canManageProjects, canManageRoles } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) {
      return res.status(400).json({ error: 'Role name is required.' });
    }

    const normalizedTabs = Array.isArray(allowedTabs) && allowedTabs.length > 0 ? allowedTabs : ['dashboard'];

    if (!id) {
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom';
      const roleId = `role_${slug}_${Math.random().toString(36).substring(2, 6)}`;
      const { data: inserted, error } = await supabase
        .from('app_roles')
        .insert({
          id: roleId,
          name: cleanName,
          description: description || '',
          allowed_tabs: normalizedTabs,
          can_write_expenses: Boolean(canWriteExpenses),
          can_manage_projects: Boolean(canManageProjects),
          can_manage_roles: Boolean(canManageRoles),
          is_system: false,
        })
        .select('*')
        .single();
      if (error) throw error;

      const role = mapRole(inserted);
      await writeAuditLog({
        action: `Role Created: ${role.name}`,
        tableAffected: 'app_roles',
        recordId: role.id,
        previousValue: '',
        newValue: JSON.stringify(role),
        userId: req.auth!.userId,
        userName: req.auth!.name,
      });

      const { data: allRoles } = await supabase.from('app_roles').select('*').order('created_at', { ascending: true });
      return res.json({ status: 'success', role, roles: (allRoles || []).map(mapRole) });
    } else {
      const { data: oldRow } = await supabase.from('app_roles').select('*').eq('id', id).maybeSingle();
      if (!oldRow) return res.status(404).json({ error: 'Role not found.' });

      const { data: updatedRow, error } = await supabase
        .from('app_roles')
        .update({
          name: oldRow.is_system ? oldRow.name : cleanName,
          description: description ?? oldRow.description,
          allowed_tabs: normalizedTabs,
          can_write_expenses: canWriteExpenses !== undefined ? Boolean(canWriteExpenses) : oldRow.can_write_expenses,
          can_manage_projects: canManageProjects !== undefined ? Boolean(canManageProjects) : oldRow.can_manage_projects,
          can_manage_roles: oldRow.is_system ? true : (canManageRoles !== undefined ? Boolean(canManageRoles) : oldRow.can_manage_roles),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      // Sync user role names if role was renamed
      if (!oldRow.is_system && oldRow.name !== updatedRow.name) {
        await supabase.from('app_users').update({ role: updatedRow.name }).eq('role', oldRow.name);
      }

      const role = mapRole(updatedRow);
      await writeAuditLog({
        action: `Role Access Updated: ${role.name}`,
        tableAffected: 'app_roles',
        recordId: role.id,
        previousValue: JSON.stringify(mapRole(oldRow)),
        newValue: JSON.stringify(role),
        userId: req.auth!.userId,
        userName: req.auth!.name,
      });

      const { data: allRoles } = await supabase.from('app_roles').select('*').order('created_at', { ascending: true });
      return res.json({ status: 'success', role, roles: (allRoles || []).map(mapRole) });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed saving role: ' + err.message });
  }
});

app.post('/api/roles/:id/delete', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { data: roleRow } = await supabase.from('app_roles').select('*').eq('id', id).maybeSingle();
    if (!roleRow) return res.status(404).json({ error: 'Role not found.' });
    if (roleRow.is_system) return res.status(400).json({ error: 'System Admin role cannot be deleted.' });

    const { data: assignedUsers } = await supabase.from('app_users').select('id').eq('role', roleRow.name).limit(1);
    if (assignedUsers && assignedUsers.length > 0) {
      return res.status(400).json({ error: `Cannot delete role "${roleRow.name}" while users are assigned to it.` });
    }

    const { error } = await supabase.from('app_roles').delete().eq('id', id);
    if (error) throw error;

    await writeAuditLog({
      action: `Role Deleted: ${roleRow.name}`,
      tableAffected: 'app_roles',
      recordId: id,
      previousValue: JSON.stringify(mapRole(roleRow)),
      newValue: '',
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: allRoles } = await supabase.from('app_roles').select('*').order('created_at', { ascending: true });
    res.json({ status: 'success', roles: (allRoles || []).map(mapRole) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting role: ' + err.message });
  }
});

// USERS / SITE MESTRIS CRUD
app.post('/api/users', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, username, password, role, assignedProjectIds } = req.body || {};
    if (!name?.trim() || !email?.trim() || !username?.trim() || !password?.trim() || !role?.trim()) {
      return res.status(400).json({ error: 'Name, email, username, role, and password are required.' });
    }

    const newRow = {
      id: genId('u'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      role: role.trim(),
      password_hash: hashPassword(password.trim()),
      assigned_project_ids: Array.isArray(assignedProjectIds) ? assignedProjectIds : [],
    };

    const { data: inserted, error } = await supabase
      .from('app_users')
      .insert(newRow)
      .select('id, name, email, username, role, assigned_project_ids')
      .single();
    if (error) throw error;

    const user = mapUser(inserted);
    await writeAuditLog({
      action: `User Account Created: ${user.name} (${user.role})`,
      tableAffected: 'users',
      recordId: user.id,
      previousValue: '',
      newValue: JSON.stringify(user),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: users } = await supabase
      .from('app_users')
      .select('id, name, email, username, role, assigned_project_ids')
      .order('id');
    res.json({ status: 'success', user, users: (users || []).map(mapUser) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed creating user: ' + err.message });
  }
});

app.post('/api/users/:id/delete', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (id === req.auth!.userId) {
      return res.status(400).json({ error: 'You cannot delete the currently active account.' });
    }
    const { data: oldRow } = await supabase
      .from('app_users')
      .select('id, name, email, username, role, assigned_project_ids')
      .eq('id', id)
      .maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'User not found.' });

    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw error;

    await writeAuditLog({
      action: `User Deleted: ${oldRow.name} (${oldRow.role})`,
      tableAffected: 'users',
      recordId: id,
      previousValue: JSON.stringify(mapUser(oldRow)),
      newValue: '',
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: users } = await supabase
      .from('app_users')
      .select('id, name, email, username, role, assigned_project_ids')
      .order('id');
    res.json({ status: 'success', users: (users || []).map(mapUser) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting user: ' + err.message });
  }
});

// Update user password
app.post('/api/users/update-password', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, newPassword } = req.body || {};
    if (!userId || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'User ID and a password of at least 4 characters are required.' });
    }

    const { data: userRow, error: findErr } = await supabase
      .from('app_users')
      .select('id, name, role')
      .eq('id', userId)
      .maybeSingle();

    if (findErr || !userRow) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const { error: updErr } = await supabase
      .from('app_users')
      .update({ password_hash: hashPassword(newPassword.trim()), updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updErr) throw updErr;

    await writeAuditLog({
      action: `Password Changed for ${userRow.name} (${userRow.role})`,
      tableAffected: 'users',
      recordId: userId,
      previousValue: '[REDACTED]',
      newValue: '[REDACTED]',
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: users } = await supabase
      .from('app_users')
      .select('id, name, email, username, role, assigned_project_ids')
      .order('id');
    res.json({
      status: 'success',
      message: `Successfully updated password for ${userRow.name}`,
      users: (users || []).map(mapUser),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Password update failed: ' + err.message });
  }
});

// Update full user profile
app.post('/api/users/update-profile', requireAuth, requireCapability('canManageRoles'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, name, email, username, password, role, assignedProjectIds } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    const { data: oldRow, error: findErr } = await supabase
      .from('app_users')
      .select('id, name, email, username, role, assigned_project_ids')
      .eq('id', userId)
      .maybeSingle();

    if (findErr || !oldRow) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (username !== undefined) updates.username = username;
    if (role !== undefined) updates.role = role;
    if (Array.isArray(assignedProjectIds)) updates.assigned_project_ids = assignedProjectIds;
    if (typeof password === 'string' && password.trim().length > 0) {
      updates.password_hash = hashPassword(password.trim());
    }

    const { data: updatedRow, error: updErr } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select('id, name, email, username, role, assigned_project_ids')
      .single();

    if (updErr) throw updErr;

    await writeAuditLog({
      action: `User Profile Updated: ${updatedRow.name} (${updatedRow.role})`,
      tableAffected: 'users',
      recordId: userId,
      previousValue: JSON.stringify(oldRow),
      newValue: JSON.stringify({ ...updatedRow, passwordChanged: Boolean(updates.password_hash) }),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: users } = await supabase
      .from('app_users')
      .select('id, name, email, username, role, assigned_project_ids')
      .order('id');
    res.json({
      status: 'success',
      message: `Successfully updated profile of ${updatedRow.name}`,
      users: (users || []).map(mapUser),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Profile update failed: ' + err.message });
  }
});

// PROJECTS CRUD
app.post('/api/projects', requireAuth, requireCapability('canManageProjects'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      id,
      projectName,
      siteName,
      clientName,
      totalBudget,
      startDate,
      expectedEndDate,
      status,
      assignedMestriId,
      assignedMestriName,
    } = req.body || {};

    let resolvedMestriName = assignedMestriName || '';
    if (assignedMestriId && !resolvedMestriName) {
      const { data: mUser } = await supabase
        .from('app_users')
        .select('name')
        .eq('id', assignedMestriId)
        .maybeSingle();
      if (mUser) resolvedMestriName = mUser.name;
    }

    if (!id) {
      const today = new Date().toISOString().split('T')[0];
      const row = {
        id: genId('p'),
        project_name: projectName || 'New Project',
        site_name: siteName || 'Main Site',
        client_name: clientName || 'General Client',
        start_date: startDate || today,
        expected_end_date: expectedEndDate || today,
        total_budget: Number(totalBudget) || 0,
        status: status || ProjectStatus.ACTIVE,
        is_deleted: false,
        assigned_mestri_id: assignedMestriId || null,
        assigned_mestri_name: resolvedMestriName,
      };
      const { data: inserted, error } = await supabase.from('projects').insert(row).select('*').single();
      if (error) throw error;

      const project = mapProject(inserted);
      await writeAuditLog({
        action: 'Create Project',
        tableAffected: 'projects',
        recordId: project.id,
        previousValue: '',
        newValue: JSON.stringify(project),
        userId: req.auth!.userId,
        userName: req.auth!.name,
      });

      return res.json({ status: 'success', project });
    } else {
      const { data: oldRow, error: findErr } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (findErr || !oldRow) return res.status(404).json({ error: 'Project not found' });

      const parsedBudget =
        totalBudget !== undefined && totalBudget !== null && totalBudget !== ''
          ? Number(totalBudget)
          : Number(oldRow.total_budget);

      const updates = {
        project_name: projectName ?? oldRow.project_name,
        site_name: siteName ?? oldRow.site_name,
        client_name: clientName ?? oldRow.client_name,
        start_date: startDate ?? oldRow.start_date,
        expected_end_date: expectedEndDate ?? oldRow.expected_end_date,
        total_budget: Number.isFinite(parsedBudget) ? parsedBudget : Number(oldRow.total_budget),
        status: status ?? oldRow.status,
        assigned_mestri_id: assignedMestriId !== undefined ? (assignedMestriId || null) : oldRow.assigned_mestri_id,
        assigned_mestri_name: assignedMestriId !== undefined ? resolvedMestriName : oldRow.assigned_mestri_name,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedRow, error: updErr } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (updErr) throw updErr;

      const project = mapProject(updatedRow);
      await writeAuditLog({
        action: 'Update Project',
        tableAffected: 'projects',
        recordId: id,
        previousValue: JSON.stringify(mapProject(oldRow)),
        newValue: JSON.stringify(project),
        userId: req.auth!.userId,
        userName: req.auth!.name,
      });

      await checkBusinessRulesAndNotify(id);
      return res.json({ status: 'success', project });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed saving project: ' + err.message });
  }
});

app.post('/api/projects/:id/delete', requireAuth, requireCapability('canManageProjects'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { data: oldRow } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'Project not found' });

    const { data: updatedRow, error } = await supabase
      .from('projects')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    await writeAuditLog({
      action: 'Soft Delete Project',
      tableAffected: 'projects',
      recordId: id,
      previousValue: JSON.stringify(mapProject(oldRow)),
      newValue: JSON.stringify(mapProject(updatedRow)),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting project: ' + err.message });
  }
});

// ADVANCES
app.post('/api/advances', requireAuth, requireCapability('canManageProjects'), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, date, givenBy, receivedBy, amount, paymentMode, remarks } = req.body || {};
    const amtNum = Number(amount) || 0;
    const issuer = givenBy || req.auth!.name;

    const row = {
      id: genId('adv'),
      project_id: projectId,
      date: date || new Date().toISOString().split('T')[0],
      given_by: issuer,
      received_by: receivedBy || 'Site Supervisor',
      amount: amtNum,
      payment_mode: paymentMode || 'Cash',
      remarks: remarks || '',
    };

    const { data: inserted, error } = await supabase.from('advances').insert(row).select('*').single();
    if (error) throw error;

    const advance = mapAdvance(inserted);
    await writeAuditLog({
      action: 'Issue Advance',
      tableAffected: 'advances',
      recordId: advance.id,
      previousValue: '',
      newValue: JSON.stringify(advance),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: proj } = await supabase.from('projects').select('project_name').eq('id', projectId).maybeSingle();
    await supabase.from('notifications').insert({
      id: genId('notif'),
      project_id: projectId,
      project_name: proj ? proj.project_name : 'Unknown Project',
      message: `💵 NEW ADVANCE ISSUED: ${issuer} issued an advance of ₹${amtNum.toLocaleString()} to ${advance.receivedBy} via ${advance.paymentMode}.`,
      type: 'advance_issued',
      date: new Date().toISOString(),
      amount: amtNum,
      is_read_by: [],
    });

    await checkBusinessRulesAndNotify(projectId);
    res.json({ status: 'success', advance });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed recording advance: ' + err.message });
  }
});

// CASH FLOW BORROWINGS & FRIEND LOANS CRUD
app.get('/api/borrowings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const { borrowings } = await getBorrowingsFromDb(supabase, projectId);
    res.json({ borrowings });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed fetching borrowings: ' + err.message });
  }
});

app.post('/api/borrowings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const canManage = req.roleDef?.canManageProjects || req.roleDef?.canManageRoles || req.auth?.role === UserRole.ADMIN;
    if (!canManage) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to record borrowings.' });
    }

    const borrowingData = req.body || {};
    if (!borrowingData.projectId || !borrowingData.amount || Number(borrowingData.amount) <= 0) {
      return res.status(400).json({ error: 'Valid site project and borrowing amount are required.' });
    }

    const isNew = !borrowingData.id;
    const borrowing = await saveBorrowingToDb(supabase, borrowingData, req.auth!.name);

    await writeAuditLog({
      action: isNew ? 'Record Borrowing' : 'Update Borrowing',
      tableAffected: 'project_borrowings',
      recordId: borrowing.id,
      previousValue: '',
      newValue: JSON.stringify(borrowing),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const { data: proj } = await supabase.from('projects').select('project_name').eq('id', borrowing.projectId).maybeSingle();
    const projName = proj ? proj.project_name : 'Site Project';

    if (isNew) {
      await supabase.from('notifications').insert({
        id: genId('notif'),
        project_id: borrowing.projectId,
        project_name: projName,
        message: `🤝 CASH INJECTION: ₹${borrowing.amount.toLocaleString()} borrowed from "${borrowing.lenderName}" by ${borrowing.borrowerName} for ${borrowing.purpose || 'site liquidity'}.`,
        type: 'borrowing_recorded',
        date: new Date().toISOString(),
        amount: borrowing.amount,
        is_read_by: [],
      });
    }

    res.json({ status: 'success', borrowing });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed saving borrowing: ' + err.message });
  }
});

app.post('/api/borrowings/:id/repay', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const canManage = req.roleDef?.canManageProjects || req.roleDef?.canManageRoles || req.auth?.role === UserRole.ADMIN;
    if (!canManage) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to record loan repayments.' });
    }

    const { id } = req.params;
    const repaymentData = req.body || {};
    const amt = Number(repaymentData.amount) || 0;
    if (amt <= 0) {
      return res.status(400).json({ error: 'Repayment amount must be greater than zero.' });
    }

    const { borrowing, repayment } = await addRepaymentToDb(supabase, id, repaymentData, req.auth!.name);

    await writeAuditLog({
      action: 'Repay Borrowing',
      tableAffected: 'borrowing_repayments',
      recordId: repayment.id,
      previousValue: '',
      newValue: JSON.stringify({ borrowing, repayment }),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    const isSettled = borrowing.status === BorrowingStatus.SETTLED;
    const { data: proj } = await supabase.from('projects').select('project_name').eq('id', borrowing.projectId).maybeSingle();
    const projName = proj ? proj.project_name : 'Site Project';

    await supabase.from('notifications').insert({
      id: genId('notif'),
      project_id: borrowing.projectId,
      project_name: projName,
      message: isSettled
        ? `✅ LOAN FULLY SETTLED: ₹${amt.toLocaleString()} repaid to "${borrowing.lenderName}". Debt is 100% cleared!`
        : `💳 PARTIAL LOAN REPAID: ₹${amt.toLocaleString()} repaid to "${borrowing.lenderName}". Remaining balance: ₹${borrowing.balanceDue.toLocaleString()}.`,
      type: isSettled ? 'loan_settled' : 'loan_repaid',
      date: new Date().toISOString(),
      amount: amt,
      is_read_by: [],
    });

    res.json({ status: 'success', borrowing, repayment });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed recording repayment: ' + err.message });
  }
});

app.post('/api/borrowings/:id/delete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const canManage = req.roleDef?.canManageProjects || req.roleDef?.canManageRoles || req.auth?.role === UserRole.ADMIN;
    if (!canManage) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to delete borrowings.' });
    }

    const { id } = req.params;
    await deleteBorrowingFromDb(supabase, id);

    await writeAuditLog({
      action: 'Delete Borrowing',
      tableAffected: 'project_borrowings',
      recordId: id,
      previousValue: '',
      newValue: '',
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting borrowing: ' + err.message });
  }
});

app.post('/api/borrowings/repayments/:id/delete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const canManage = req.roleDef?.canManageProjects || req.roleDef?.canManageRoles || req.auth?.role === UserRole.ADMIN;
    if (!canManage) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to delete repayment.' });
    }

    const { id } = req.params;
    const borrowing = await deleteRepaymentFromDb(supabase, id);

    await writeAuditLog({
      action: 'Delete Borrowing Repayment',
      tableAffected: 'borrowing_repayments',
      recordId: id,
      previousValue: '',
      newValue: JSON.stringify(borrowing),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    res.json({ status: 'success', borrowing });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting repayment: ' + err.message });
  }
});

// MATERIAL PURCHASES CRUD + CREDIT SETTLEMENT
app.post('/api/purchases', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      id,
      projectId,
      date,
      category,
      materialName,
      quantity,
      unit,
      supplier,
      rate,
      invoiceNo,
      billUrl,
      paymentStatus,
      paidAmount,
      creditAmount,
      transportCharges,
      extraExpenses,
      extraExpensesRemarks,
      weightKg,
      thicknessSpecs,
    } = req.body || {};

    const qty = Number(quantity) || 0;
    const rateNum = Number(rate) || 0;
    const transport = Number(transportCharges) || 0;
    const extra = Number(extraExpenses) || 0;
    const totalAmount = qty * rateNum + transport + extra;

    const uploadedBillUrl = await uploadDataUrlIfNeeded(supabase, billUrl, 'bills', id || 'purchase');

    if (!id) {
      const row = {
        id: genId('m'),
        project_id: projectId,
        date: date || new Date().toISOString().split('T')[0],
        category: category || MaterialCategory.OTHER,
        material_name: materialName || 'General Material',
        quantity: qty,
        unit: unit || 'Pcs',
        supplier: supplier || 'Local Store',
        rate: rateNum,
        total_amount: totalAmount,
        invoice_no: invoiceNo || '',
        bill_url: uploadedBillUrl,
        entered_by: req.auth!.name,
        is_deleted: false,
        payment_status: paymentStatus || null,
        paid_amount: paidAmount !== undefined ? Number(paidAmount) : null,
        credit_amount: creditAmount !== undefined ? Number(creditAmount) : null,
        transport_charges: transport,
        extra_expenses: extra,
        extra_expenses_remarks: extraExpensesRemarks || '',
        weight_kg: weightKg !== undefined ? Number(weightKg) : null,
        thickness_specs: thicknessSpecs || null,
      };

      const { data: inserted, error } = await supabase.from('material_purchases').insert(row).select('*').single();
      if (error) throw error;

      const purchase = mapPurchase(inserted);
      await writeAuditLog({
        action: 'Material Purchase Recorded',
        tableAffected: 'material_purchases',
        recordId: purchase.id,
        previousValue: '',
        newValue: JSON.stringify(purchase),
        userId: req.auth!.userId,
        userName: req.auth!.name,
      });

      const { data: proj } = await supabase.from('projects').select('project_name').eq('id', projectId).maybeSingle();
      const projectName = proj ? proj.project_name : 'Project';

      await supabase.from('notifications').insert({
        id: genId('notif'),
        project_id: projectId,
        project_name: projectName,
        message: `🧱 NEW MATERIAL PURCHASE: ${purchase.enteredBy} recorded purchase of ${purchase.materialName} (${purchase.category}) for ₹${totalAmount.toLocaleString()} from ${purchase.supplier}.`,
        type: 'purchase_recorded',
        date: new Date().toISOString(),
        amount: totalAmount,
        is_read_by: [],
      });

      if (totalAmount > 50000) {
        await supabase.from('notifications').insert({
          id: genId('notif'),
          project_id: projectId,
          project_name: projectName,
          message: `⚡ LARGE EXPENSE ALERT: Purchase of "${purchase.materialName}" is for ₹${totalAmount.toLocaleString()}, exceeding the ₹50,000 threshold.`,
          type: 'large_expense',
          date: new Date().toISOString(),
          amount: totalAmount,
          is_read_by: [],
        });
      }

      await checkBusinessRulesAndNotify(projectId);
      return res.json({ status: 'success', purchase });
    } else {
      const { data: oldRow } = await supabase.from('material_purchases').select('*').eq('id', id).maybeSingle();
      if (!oldRow) return res.status(404).json({ error: 'Purchase not found' });

      const oldPurchase = mapPurchase(oldRow);
      const updates = {
        date: date ?? oldRow.date,
        category: category ?? oldRow.category,
        material_name: materialName ?? oldRow.material_name,
        quantity: qty,
        unit: unit ?? oldRow.unit,
        supplier: supplier ?? oldRow.supplier,
        rate: rateNum,
        total_amount: totalAmount,
        invoice_no: invoiceNo ?? oldRow.invoice_no,
        bill_url: uploadedBillUrl || oldRow.bill_url,
        payment_status: paymentStatus ?? oldRow.payment_status,
        paid_amount: paidAmount !== undefined ? Number(paidAmount) : oldRow.paid_amount,
        credit_amount: creditAmount !== undefined ? Number(creditAmount) : oldRow.credit_amount,
        transport_charges: transport,
        extra_expenses: extra,
        extra_expenses_remarks: extraExpensesRemarks || '',
        weight_kg: weightKg !== undefined ? (weightKg === null ? null : Number(weightKg)) : oldRow.weight_kg,
        thickness_specs:
          thicknessSpecs !== undefined ? (thicknessSpecs === null ? null : thicknessSpecs) : oldRow.thickness_specs,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedRow, error } = await supabase
        .from('material_purchases')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      const updatedPurchase = mapPurchase(updatedRow);
      await writeAuditLog({
        action: 'Material Purchase Updated',
        tableAffected: 'material_purchases',
        recordId: id,
        previousValue: JSON.stringify(oldPurchase),
        newValue: JSON.stringify(updatedPurchase),
        userId: req.auth!.userId,
        userName: req.auth!.name,
      });

      if (totalAmount > 50000 && oldPurchase.totalAmount <= 50000) {
        const { data: proj } = await supabase.from('projects').select('project_name').eq('id', projectId).maybeSingle();
        await supabase.from('notifications').insert({
          id: genId('notif'),
          project_id: projectId,
          project_name: proj ? proj.project_name : 'Project',
          message: `⚡ LARGE EXPENSE ALERT (UPDATED): Purchase of "${updatedPurchase.materialName}" updated to ₹${totalAmount.toLocaleString()}, exceeding the ₹50,000 threshold.`,
          type: 'large_expense',
          date: new Date().toISOString(),
          amount: totalAmount,
          is_read_by: [],
        });
      }

      await checkBusinessRulesAndNotify(projectId);
      return res.json({ status: 'success', purchase: updatedPurchase });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed saving purchase: ' + err.message });
  }
});

app.post('/api/purchases/:id/delete', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { data: oldRow } = await supabase.from('material_purchases').select('*').eq('id', id).maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'Purchase not found' });

    const { data: updatedRow, error } = await supabase
      .from('material_purchases')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    await writeAuditLog({
      action: 'Soft Delete Material Purchase',
      tableAffected: 'material_purchases',
      recordId: id,
      previousValue: JSON.stringify(mapPurchase(oldRow)),
      newValue: JSON.stringify(mapPurchase(updatedRow)),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    await checkBusinessRulesAndNotify(oldRow.project_id);
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting purchase: ' + err.message });
  }
});

app.post('/api/purchases/:id/settle', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { payAmount } = req.body || {};

    const { data: oldRow } = await supabase.from('material_purchases').select('*').eq('id', id).maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'Purchase not found' });

    const total = Number(oldRow.total_amount) || 0;
    const prevPaid =
      oldRow.paid_amount !== null && oldRow.paid_amount !== undefined
        ? Number(oldRow.paid_amount)
        : oldRow.payment_status === PaymentStatus.CREDIT
          ? 0
          : total;
    const prevCredit = Math.max(0, total - prevPaid);
    const settleVal = payAmount !== undefined ? Math.min(prevCredit, Math.max(0, Number(payAmount) || 0)) : prevCredit;

    const newPaid = Math.min(total, prevPaid + settleVal);
    const newCredit = Math.max(0, total - newPaid);
    const newStatus = newCredit <= 0 ? PaymentStatus.PAID : newPaid === 0 ? PaymentStatus.CREDIT : PaymentStatus.PAID;

    const { data: updatedRow, error } = await supabase
      .from('material_purchases')
      .update({
        paid_amount: newPaid,
        credit_amount: newCredit,
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const updated = mapPurchase(updatedRow);
    await writeAuditLog({
      action: `Credit Payment Settled (₹${settleVal.toLocaleString()})`,
      tableAffected: 'material_purchases',
      recordId: id,
      previousValue: JSON.stringify(mapPurchase(oldRow)),
      newValue: JSON.stringify(updated),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    await checkBusinessRulesAndNotify(oldRow.project_id);
    res.json({ status: 'success', purchase: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed settling purchase credit: ' + err.message });
  }
});

// LABOR EXPENSE RECORDING & SETTLEMENT
app.post('/api/labor', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, date, workerType, numWorkers, dailyWage, remarks, paymentStatus } = req.body || {};
    const num = Number(numWorkers) || 0;
    const wage = Number(dailyWage) || 0;
    const totalWage = num * wage;

    const row = {
      id: genId('lab'),
      project_id: projectId,
      date: date || new Date().toISOString().split('T')[0],
      worker_type: workerType || WorkerType.HELPER,
      num_workers: num,
      daily_wage: wage,
      total_wage: totalWage,
      remarks: remarks || '',
      entered_by: req.auth!.name,
      payment_status: paymentStatus || null,
    };

    const { data: inserted, error } = await supabase.from('labor_expenses').insert(row).select('*').single();
    if (error) throw error;

    const labor = mapLabor(inserted);
    await writeAuditLog({
      action: 'Labor Expense Recorded',
      tableAffected: 'labor_expenses',
      recordId: labor.id,
      previousValue: '',
      newValue: JSON.stringify(labor),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    if (totalWage > 50000) {
      const { data: proj } = await supabase.from('projects').select('project_name').eq('id', projectId).maybeSingle();
      await supabase.from('notifications').insert({
        id: genId('notif'),
        project_id: projectId,
        project_name: proj ? proj.project_name : 'Project',
        message: `⚡ LARGE EXPENSE ALERT: Labor billing for ${labor.workerType} on ${labor.date} is ₹${totalWage.toLocaleString()}, exceeding the ₹50,000 threshold.`,
        type: 'large_expense',
        date: new Date().toISOString(),
        amount: totalWage,
        is_read_by: [],
      });
    }

    await checkBusinessRulesAndNotify(projectId);
    res.json({ status: 'success', labor });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed recording labor expense: ' + err.message });
  }
});

app.post('/api/labor/:id/settle', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { data: oldRow } = await supabase.from('labor_expenses').select('*').eq('id', id).maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'Labor record not found' });

    const { data: updatedRow, error } = await supabase
      .from('labor_expenses')
      .update({ payment_status: PaymentStatus.PAID })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const updated = mapLabor(updatedRow);
    await writeAuditLog({
      action: 'Labor Credit Settled',
      tableAffected: 'labor_expenses',
      recordId: id,
      previousValue: JSON.stringify(mapLabor(oldRow)),
      newValue: JSON.stringify(updated),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    await checkBusinessRulesAndNotify(oldRow.project_id);
    res.json({ status: 'success', labor: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed settling labor expense: ' + err.message });
  }
});

// DAILY EXPENSES RECORDING & SETTLEMENT
app.post('/api/daily-expenses', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, date, category, description, amount, billUrl, paymentStatus } = req.body || {};
    const amt = Number(amount) || 0;
    const uploadedBillUrl = await uploadDataUrlIfNeeded(supabase, billUrl, 'daily-bills', 'daily');

    const row = {
      id: genId('d'),
      project_id: projectId,
      date: date || new Date().toISOString().split('T')[0],
      category: category || DailyExpenseCategory.MISCELLANEOUS,
      description: description || '',
      amount: amt,
      bill_url: uploadedBillUrl,
      entered_by: req.auth!.name,
      payment_status: paymentStatus || null,
    };

    const { data: inserted, error } = await supabase.from('daily_expenses').insert(row).select('*').single();
    if (error) throw error;

    const daily = mapDaily(inserted);
    await writeAuditLog({
      action: 'Daily Expense Recorded',
      tableAffected: 'daily_expenses',
      recordId: daily.id,
      previousValue: '',
      newValue: JSON.stringify(daily),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    if (amt > 50000) {
      const { data: proj } = await supabase.from('projects').select('project_name').eq('id', projectId).maybeSingle();
      await supabase.from('notifications').insert({
        id: genId('notif'),
        project_id: projectId,
        project_name: proj ? proj.project_name : 'Project',
        message: `⚡ LARGE EXPENSE ALERT: Daily site expense for ${daily.category} is ₹${amt.toLocaleString()}, exceeding the ₹50,000 threshold.`,
        type: 'large_expense',
        date: new Date().toISOString(),
        amount: amt,
        is_read_by: [],
      });
    }

    await checkBusinessRulesAndNotify(projectId);
    res.json({ status: 'success', daily });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed recording daily expense: ' + err.message });
  }
});

app.post('/api/daily-expenses/:id/settle', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { data: oldRow } = await supabase.from('daily_expenses').select('*').eq('id', id).maybeSingle();
    if (!oldRow) return res.status(404).json({ error: 'Daily expense not found' });

    const { data: updatedRow, error } = await supabase
      .from('daily_expenses')
      .update({ payment_status: PaymentStatus.PAID })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const updated = mapDaily(updatedRow);
    await writeAuditLog({
      action: 'Daily Expense Credit Settled',
      tableAffected: 'daily_expenses',
      recordId: id,
      previousValue: JSON.stringify(mapDaily(oldRow)),
      newValue: JSON.stringify(updated),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    await checkBusinessRulesAndNotify(oldRow.project_id);
    res.json({ status: 'success', daily: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed settling daily expense: ' + err.message });
  }
});

// STAGE PROGRESS PHOTOS (persisted to Supabase + Storage)
app.post('/api/stage-photos', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, stageKey, photoUrl, remarks, date } = req.body || {};
    if (!projectId || !stageKey || !photoUrl) {
      return res.status(400).json({ error: 'projectId, stageKey, and photoUrl are required.' });
    }

    const storedUrl = await uploadDataUrlIfNeeded(supabase, photoUrl, `stage-photos/${projectId}`, stageKey);
    const row = {
      id: genId('photo'),
      project_id: projectId,
      stage_key: stageKey,
      photo_url: storedUrl,
      remarks: remarks || '',
      uploaded_by: req.auth!.name,
      date: date || new Date().toISOString().split('T')[0],
    };

    const { data: inserted, error } = await supabase.from('stage_photos').insert(row).select('*').single();
    if (error) throw error;

    res.json({ status: 'success', photo: mapStagePhoto(inserted) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed saving stage photo: ' + err.message });
  }
});

app.post('/api/stage-photos/:id/delete', requireAuth, requireCapability('canWriteExpenses'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('stage_photos').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting stage photo: ' + err.message });
  }
});

// TAX INVOICES (persisted to Supabase)
app.post('/api/tax-invoices', requireAuth, requireCapability('canRaiseInvoices'), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, invoiceNo, date, projectName, siteName, clientName, grandTotal, items, metadata } = req.body || {};
    const row = {
      id: genId('inv'),
      project_id: projectId || null,
      invoice_no: invoiceNo || '',
      date: date || new Date().toISOString().split('T')[0],
      project_name: projectName || 'General Site',
      site_name: siteName || '',
      client_name: clientName || '',
      grand_total: Number(grandTotal) || 0,
      items: Array.isArray(items) ? items : [],
      metadata: metadata || {},
    };

    const { data: inserted, error } = await supabase.from('tax_invoices').insert(row).select('*').single();
    if (error) throw error;

    await writeAuditLog({
      action: `Tax Invoice Raised (${row.invoice_no})`,
      tableAffected: 'tax_invoices',
      recordId: row.id,
      previousValue: '',
      newValue: JSON.stringify({ invoiceNo: row.invoice_no, clientName: row.client_name, grandTotal: row.grand_total }),
      userId: req.auth!.userId,
      userName: req.auth!.name,
    });

    res.json({ status: 'success', invoice: mapTaxInvoice(inserted) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed saving tax invoice: ' + err.message });
  }
});

app.post('/api/tax-invoices/:id/delete', requireAuth, requireCapability('canManageRoles'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('tax_invoices').delete().eq('id', id);
    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed deleting tax invoice: ' + err.message });
  }
});

// MARK NOTIFICATIONS READ
app.post('/api/notifications/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth!.userId;
    const { data: notifs, error } = await supabase.from('notifications').select('id, is_read_by');
    if (error) throw error;

    const updates = (notifs || [])
      .filter((n: any) => !Array.isArray(n.is_read_by) || !n.is_read_by.includes(userId))
      .map((n: any) =>
        supabase
          .from('notifications')
          .update({ is_read_by: [...(Array.isArray(n.is_read_by) ? n.is_read_by : []), userId] })
          .eq('id', n.id)
      );

    await Promise.all(updates);
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed marking notifications read: ' + err.message });
  }
});

// GEMINI AI RECEIPT / BILL SCANNER
app.post('/api/ai/scan-bill', requireAuth, requireCapability('canWriteExpenses'), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }
    const { dataUrl } = req.body || {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'A valid base64 data URL image or PDF is required.' });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Malformed base64 data URL.' });
    }

    const [, mimeType, base64Data] = match;
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: `Extract construction material purchase invoice fields from this receipt/bill image.
Return JSON only matching the schema. Pick the closest category from: ${Object.values(MaterialCategory).join(', ')}.
If a field is unreadable, return an empty string for text or 0 for numbers.`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplier: { type: Type.STRING },
            invoiceNo: { type: Type.STRING },
            date: { type: Type.STRING, description: 'YYYY-MM-DD format if visible' },
            category: { type: Type.STRING },
            materialName: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            rate: { type: Type.NUMBER },
            transportCharges: { type: Type.NUMBER },
            extraExpenses: { type: Type.NUMBER },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ status: 'success', extracted: parsed });
  } catch (err: any) {
    res.status(500).json({ error: 'AI bill scan failed: ' + err.message });
  }
});

// Serve Vite dev server or production static build
async function startServer() {
  await ensureDefaultRolesAndUsers();

  if (process.env.NODE_ENV !== 'production') {
    const [{ default: react }, { default: tailwindcss }] = await Promise.all([
      import('@vitejs/plugin-react'),
      import('@tailwindcss/vite'),
    ]);
    const vite = await createViteServer({
      configFile: false,
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), '.'),
        },
      },
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT} (Database: Supabase)`);
  });
}

startServer();
