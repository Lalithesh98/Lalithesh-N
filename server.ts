import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  UserRole, 
  Project, 
  ProjectStatus, 
  Advance, 
  MaterialCategory, 
  MaterialPurchase, 
  WorkerType, 
  LaborExpense, 
  DailyExpenseCategory, 
  DailyExpense, 
  AuditLog, 
  Notification 
} from './src/types';

const app = express();
const PORT = 3000;

// Body parser with 50MB limit to support base64 bill uploading safely
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

// Initial seed data
const initialData = {
  users: [
    { id: 'u1', name: 'Lalithesh N', email: 'lalithesh@lvconstructions.com', role: UserRole.ADMIN, password: 'admin123', username: 'lalithesh' },
    { id: 'u2', name: 'Varun Kashyap', email: 'varun@lvconstructions.com', role: UserRole.PROPRIETOR, password: 'varun123', username: 'varun' },
    { id: 'u3', name: 'Nagaraj S', email: 'nagaraj@lvconstructions.com', role: UserRole.MESTRI, password: 'nagaraj123', username: 'nagaraj' }
  ],
  projects: [],
  advances: [],
  purchases: [],
  laborExpenses: [],
  dailyExpenses: [],
  auditLogs: [],
  notifications: []
};

// Ensure db directory and file exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

let firestoreDb: any = null;

function initFirestore() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const fbApp = initializeApp(firebaseConfig);
      firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
      console.log('Firebase Firestore successfully initialized inside server.ts with Database ID:', firebaseConfig.firestoreDatabaseId);
    } else {
      console.warn('Firebase configuration file not found at: ' + configPath);
    }
  } catch (err) {
    console.error('Failed to initialize Firebase inside server.ts:', err);
  }
}

// Function to pull latest state from Firestore and update db.json
async function syncFromCloudToLocal() {
  if (!firestoreDb) return null;
  try {
    const docRef = doc(firestoreDb, 'system', 'databaseState');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.state) {
        const parsed = typeof data.state === 'string' ? JSON.parse(data.state) : data.state;
        if (parsed.users && parsed.projects) {
          console.log('Successfully fetched stable state from Firestore Cloud Backup.');
          fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
          return parsed;
        }
      }
    } else {
      console.log('No current active cloud state found in Firestore. Creating initial seed.');
      await syncFromLocalToCloud(initialData);
    }
  } catch (err) {
    console.error('Error during automatic Cloud sync-down:', err);
  }
  return null;
}

// Function to push local state securely to Firestore
async function syncFromLocalToCloud(data: any) {
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'system', 'databaseState');
    await setDoc(docRef, {
      state: data,
      lastSyncedAt: new Date().toISOString()
    });
    console.log('Successfully backed up active state to Firestore Cloud Database.');
  } catch (err) {
    console.error('Failed to sync state to Firestore cloud backup:', err);
  }
}

// Read database
function readDb() {
  initDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database, resetting db.json to initial data', err);
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
}

// Write database
function writeDb(data: any) {
  initDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  syncFromLocalToCloud(data).catch(err => {
    console.error('Background cloud sync-up warning:', err);
  });
}

// Simple Helper to generate IDs
function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check and trigger notifications based on rules:
// - New advance issued
// - New purchase recorded
// - Budget exceeds limit
// - Large expense entered (> ₹50,000)
// - Advance balance becomes low (< ₹10,000)
function checkBusinessRulesAndNotify(db: any, projectId: string, triggerByUserId: string) {
  const project = db.projects.find((p: any) => p.id === projectId && !p.isDeleted);
  if (!project) return;

  // Let's compute project-level statistics
  const purchasesTotal = db.purchases
    .filter((p: any) => p.projectId === projectId && !p.isDeleted)
    .reduce((sum: number, p: any) => sum + p.totalAmount, 0);

  const laborTotal = db.laborExpenses
    .filter((l: any) => l.projectId === projectId)
    .reduce((sum: number, l: any) => sum + l.totalWage, 0);

  const dailyTotal = db.dailyExpenses
    .filter((d: any) => d.projectId === projectId)
    .reduce((sum: number, d: any) => sum + d.amount, 0);

  const totalSpent = purchasesTotal + laborTotal + dailyTotal;

  // 1. Budget check
  if (totalSpent > project.totalBudget) {
    const hasBudgetAlert = db.notifications.some(
      (n: any) => n.projectId === projectId && n.type === 'budget_exceeded'
    );
    if (!hasBudgetAlert) {
      db.notifications.unshift({
        id: genId('notif'),
        projectId,
        projectName: project.projectName,
        message: `🚨 WARNING: Project "${project.projectName}" budget of ₹${project.totalBudget.toLocaleString()} has been exceeded! Total spent is ₹${totalSpent.toLocaleString()}.`,
        type: 'budget_exceeded',
        date: new Date().toISOString(),
        amount: totalSpent,
        isReadBy: [],
      });
    }
  }

  // 2. Advance balance check for Mestri Ramesh Singh (and other mestris in DB)
  // Current Advance Balance = Total Advance Given - Total Expenses Submitted by Mestri/Supervisor (which corresponds to Ramesh Singh as Ramesh Singh is currently our sole Mestri)
  const totalAdvances = db.advances
    .filter((a: any) => a.projectId === projectId)
    .reduce((sum: number, a: any) => sum + a.amount, 0);

  // Note: All site expenses (Material, labor, daily site expense) submitted by the Mestri
  const remainingAdvance = totalAdvances - totalSpent;

  if (remainingAdvance < 10000 && totalAdvances > 0) {
    const hasBalanceAlert = db.notifications.some(
      (n: any) => n.projectId === projectId && n.type === 'low_advance_balance' && n.amount === remainingAdvance
    );
    if (!hasBalanceAlert) {
      db.notifications.unshift({
        id: genId('notif'),
        projectId,
        projectName: project.projectName,
        message: `⚠️ ATTENTION: Mestri advance balance is extremely low at ₹${remainingAdvance.toLocaleString()} for project "${project.projectName}". Please top up advance soon!`,
        type: 'low_advance_balance',
        date: new Date().toISOString(),
        amount: remainingAdvance,
        isReadBy: [],
      });
    }
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET complete database
app.get('/api/data', (req, res) => {
  res.json(readDb());
});

// Export entire database as a downloaded JSON file
app.get('/api/database/export', (req, res) => {
  try {
    const dbData = readDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=lv_constructions_db.json');
    res.send(JSON.stringify(dbData, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export database: ' + err.message });
  }
});

// Import entire database JSON to restore/sync
app.post('/api/database/import', (req, res) => {
  try {
    const dbData = req.body;
    if (!dbData || typeof dbData !== 'object') {
      return res.status(400).json({ error: 'Invalid payload. Data must be a JSON object.' });
    }
    if (!Array.isArray(dbData.users) || !Array.isArray(dbData.projects)) {
      return res.status(400).json({ error: 'Invalid database layout. "users" and "projects" arrays are required.' });
    }
    writeDb(dbData);
    res.json({ status: 'success', message: 'Database successfully imported and synchronized!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to import/restore database: ' + err.message });
  }
});

// Explicitly pull state from cloud Firestore
app.post('/api/database/pull', async (req, res) => {
  try {
    const cloudData = await syncFromCloudToLocal();
    if (cloudData) {
      res.json({ status: 'success', message: 'Successfully pulled and restored the latest data from the Cloud Firestore backup.' });
    } else {
      res.json({ status: 'success', message: 'No backup found or local is already synchronized.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to pull cloud backup: ' + err.message });
  }
});

// Explicitly push current state to cloud Firestore
app.post('/api/database/push', async (req, res) => {
  try {
    const localData = readDb();
    await syncFromLocalToCloud(localData);
    res.json({ status: 'success', message: 'Successfully pushed current local data to the Cloud Firestore backup.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to push cloud backup: ' + err.message });
  }
});

// Update user password and write to sync databases
app.post('/api/users/update-password', (req, res) => {
  const { userId, newPassword, adminUserId, adminUserName } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const previousPassword = user.password || '******';
  user.password = newPassword;

  // Append entry in Admin Audit Logs
  db.auditLogs.unshift({
    id: genId('audit'),
    action: `Password Changed for ${user.name} (${user.role})`,
    tableAffected: 'users',
    recordId: userId,
    previousValue: `Password was "${previousPassword}"`,
    newValue: `Password set to "${newPassword}"`,
    date: new Date().toISOString(),
    userId: adminUserId || 'u1',
    userName: adminUserName || 'Admin',
  });

  writeDb(db);
  res.json({ 
    status: 'success', 
    message: `Successfully changed password for ${user.name} to "${newPassword}"`,
    users: db.users 
  });
});

// Update full user profile credentials and details
app.post('/api/users/update-profile', (req, res) => {
  const { userId, name, email, username, password, role, adminUserId, adminUserName } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const previousValue = {
    name: user.name,
    email: user.email,
    username: user.username,
    password: user.password,
    role: user.role,
  };

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (username !== undefined) user.username = username;
  if (password !== undefined) user.password = password;
  if (role !== undefined) user.role = role;

  const newValue = {
    name: user.name,
    email: user.email,
    username: user.username,
    password: user.password,
    role: user.role,
  };

  // Append entry in Admin Audit Logs
  db.auditLogs.unshift({
    id: genId('audit'),
    action: `User Profile Updated: ${user.name} (${user.role})`,
    tableAffected: 'users',
    recordId: userId,
    previousValue: JSON.stringify(previousValue),
    newValue: JSON.stringify(newValue),
    date: new Date().toISOString(),
    userId: adminUserId || 'u1',
    userName: adminUserName || 'Admin',
  });

  writeDb(db);
  res.json({ 
    status: 'success', 
    message: `Successfully updated profile of ${user.name}`,
    users: db.users 
  });
});

// Auth Login Simulation
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Username or email is required' });
  }
  const db = readDb();
  const user = db.users.find((u: any) => {
    const target = email.toLowerCase().trim();
    return (
      (u.email && u.email.toLowerCase() === target) ||
      (u.username && u.username.toLowerCase() === target) ||
      (target === 'contractor@cms.com' && u.id === 'u1') ||
      (target === 'proprietor@cms.com' && u.id === 'u2') ||
      (target === 'mestri@cms.com' && u.id === 'u3') ||
      (target === 'lalithesh' && u.id === 'u1') ||
      (target === 'varun' && u.id === 'u2') ||
      (target === 'nagaraj' && u.id === 'u3')
    );
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found. Try lalithesh (Admin), varun (Proprietor), or nagaraj (Mestri).' });
  }

  // If a password is provided (or if we want to enforce it), check correctness
  if (password && user.password && user.password !== password) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  res.json({ status: 'success', user });
});

// PROJECTS CRUD
app.post('/api/projects', (req, res) => {
  const { id, projectName, siteName, clientName, totalBudget, startDate, expectedEndDate, status, userId, userName } = req.body;
  const db = readDb();

  const budgetNum = Number(totalBudget) || 0;
  
  if (!id) {
    // Create Project
    const newProj: Project = {
      id: genId('p'),
      projectName: projectName || 'New Project',
      siteName: siteName || 'Main Site',
      clientName: clientName || 'General Client',
      startDate: startDate || new Date().toISOString().split('T')[0],
      expectedEndDate: expectedEndDate || new Date().toISOString().split('T')[0],
      totalBudget: budgetNum,
      status: status || ProjectStatus.ACTIVE,
      isDeleted: false,
    };
    db.projects.push(newProj);

    db.auditLogs.unshift({
      id: genId('audit'),
      action: 'Create Project',
      tableAffected: 'projects',
      recordId: newProj.id,
      previousValue: '',
      newValue: JSON.stringify(newProj),
      date: new Date().toISOString(),
      userId: userId || '1',
      userName: userName || 'Admin',
    });

    writeDb(db);
    return res.json({ status: 'success', project: newProj });
  } else {
    // Update existing Project
    const idx = db.projects.findIndex((p: any) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Project not found' });
    const oldProj = db.projects[idx];
    const updatedProj = {
      ...oldProj,
      projectName: projectName ?? oldProj.projectName,
      siteName: siteName ?? oldProj.siteName,
      clientName: clientName ?? oldProj.clientName,
      startDate: startDate ?? oldProj.startDate,
      expectedEndDate: expectedEndDate ?? oldProj.expectedEndDate,
      totalBudget: budgetNum ?? oldProj.totalBudget,
      status: status ?? oldProj.status,
    };
    db.projects[idx] = updatedProj;

    db.auditLogs.unshift({
      id: genId('audit'),
      action: 'Update Project',
      tableAffected: 'projects',
      recordId: id,
      previousValue: JSON.stringify(oldProj),
      newValue: JSON.stringify(updatedProj),
      date: new Date().toISOString(),
      userId: userId || '1',
      userName: userName || 'Admin',
    });

    checkBusinessRulesAndNotify(db, id, userId);
    writeDb(db);
    return res.json({ status: 'success', project: updatedProj });
  }
});

// Soft Delete Project
app.post('/api/projects/:id/delete', (req, res) => {
  const { id } = req.params;
  const { userId, userName } = req.body;
  const db = readDb();
  const idx = db.projects.findIndex((p: any) => p.id === id);
  if (idx !== -1) {
    const oldProj = db.projects[idx];
    db.projects[idx].isDeleted = true;

    db.auditLogs.unshift({
      id: genId('audit'),
      action: 'Soft Delete Project',
      tableAffected: 'projects',
      recordId: id,
      previousValue: JSON.stringify(oldProj),
      newValue: JSON.stringify(db.projects[idx]),
      date: new Date().toISOString(),
      userId: userId || '1',
      userName: userName || 'Admin',
    });

    writeDb(db);
    return res.json({ status: 'success' });
  }
  res.status(404).json({ error: 'Project not found' });
});

// ADVANCES
app.post('/api/advances', (req, res) => {
  const { projectId, date, givenBy, receivedBy, amount, paymentMode, remarks, userId, userName } = req.body;
  const db = readDb();
  
  const amtNum = Number(amount) || 0;
  
  const newAdvance: Advance = {
    id: genId('adv'),
    projectId,
    date: date || new Date().toISOString().split('T')[0],
    givenBy: givenBy || 'Contractor',
    receivedBy: receivedBy || 'Mestri',
    amount: amtNum,
    paymentMode: paymentMode || 'Cash',
    remarks: remarks || '',
  };
  
  db.advances.push(newAdvance);

  db.auditLogs.unshift({
    id: genId('audit'),
    action: 'Issue Advance',
    tableAffected: 'advances',
    recordId: newAdvance.id,
    previousValue: '',
    newValue: JSON.stringify(newAdvance),
    date: new Date().toISOString(),
    userId: userId || '1',
    userName: userName || 'Admin',
  });

  // Notify proprietors of raw advance
  const project = db.projects.find((p: any) => p.id === projectId);
  db.notifications.unshift({
    id: genId('notif'),
    projectId,
    projectName: project ? project.projectName : 'Unknown Project',
    message: `💵 NEW ADVANCE ISSUED: Rajesh Kumar issued an advance of ₹${amtNum.toLocaleString()} to ${newAdvance.receivedBy} via ${newAdvance.paymentMode}.`,
    type: 'advance_issued',
    date: new Date().toISOString(),
    amount: amtNum,
    isReadBy: [],
  });

  checkBusinessRulesAndNotify(db, projectId, userId);
  writeDb(db);
  res.json({ status: 'success', advance: newAdvance });
});

// MATERIAL PURCHASES CRUD (with soft delete)
app.post('/api/purchases', (req, res) => {
  const { id, projectId, date, category, materialName, quantity, unit, supplier, rate, invoiceNo, billUrl, userId, userName, paymentStatus, paidAmount, creditAmount, transportCharges, extraExpenses, extraExpensesRemarks, weightKg, thicknessSpecs } = req.body;
  const db = readDb();

  const qty = Number(quantity) || 0;
  const rateNum = Number(rate) || 0;
  const transport = Number(transportCharges) || 0;
  const extra = Number(extraExpenses) || 0;
  const totalAmount = (qty * rateNum) + transport + extra;

  if (!id) {
    const newPurchase: MaterialPurchase = {
      id: genId('m'),
      projectId,
      date: date || new Date().toISOString().split('T')[0],
      category: category || MaterialCategory.OTHER,
      materialName: materialName || 'General Material',
      quantity: qty,
      unit: unit || 'Pcs',
      supplier: supplier || 'Local Store',
      rate: rateNum,
      totalAmount,
      invoiceNo: invoiceNo || '',
      billUrl: billUrl || '',
      enteredBy: userName || 'Mestri',
      isDeleted: false,
      paymentStatus: paymentStatus || undefined,
      paidAmount: paidAmount !== undefined ? Number(paidAmount) : undefined,
      creditAmount: creditAmount !== undefined ? Number(creditAmount) : undefined,
      transportCharges: transport,
      extraExpenses: extra,
      extraExpensesRemarks: extraExpensesRemarks || '',
      weightKg: weightKg !== undefined ? Number(weightKg) : undefined,
      thicknessSpecs: thicknessSpecs || undefined,
    };
    db.purchases.push(newPurchase);

    db.auditLogs.unshift({
      id: genId('audit'),
      action: 'Material Purchase Recorded',
      tableAffected: 'material_purchases',
      recordId: newPurchase.id,
      previousValue: '',
      newValue: JSON.stringify(newPurchase),
      date: new Date().toISOString(),
      userId: userId || '1',
      userName: userName || 'Mestri',
    });

    const project = db.projects.find((p: any) => p.id === projectId);
    
    // Notify Proprietors for recorded purchase
    db.notifications.unshift({
      id: genId('notif'),
      projectId,
      projectName: project ? project.projectName : 'Project',
      message: `🧱 NEW MATERIAL PURCHASE: ${newPurchase.enteredBy} recorded purchase of ${newPurchase.materialName} (${newPurchase.category}) for ₹${totalAmount.toLocaleString()} from ${newPurchase.supplier}.`,
      type: 'purchase_recorded',
      date: new Date().toISOString(),
      amount: totalAmount,
      isReadBy: [],
    });

    // Notify if expense is large (> ₹50,000)
    if (totalAmount > 50000) {
      db.notifications.unshift({
        id: genId('notif'),
        projectId,
        projectName: project ? project.projectName : 'Project',
        message: `⚡ LARGE EXPENSE ALERT: Purchase of "${newPurchase.materialName}" is for ₹${totalAmount.toLocaleString()}, exceeding the ₹50,000 threshold.`,
        type: 'large_expense',
        date: new Date().toISOString(),
        amount: totalAmount,
        isReadBy: [],
      });
    }

    checkBusinessRulesAndNotify(db, projectId, userId);
    writeDb(db);
    res.json({ status: 'success', purchase: newPurchase });
  } else {
    // Update purchase
    const idx = db.purchases.findIndex((p: any) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Purchase not found' });
    const oldPurchase = db.purchases[idx];
    const updatedPurchase = {
      ...oldPurchase,
      date: date ?? oldPurchase.date,
      category: category ?? oldPurchase.category,
      materialName: materialName ?? oldPurchase.materialName,
      quantity: qty,
      unit: unit ?? oldPurchase.unit,
      supplier: supplier ?? oldPurchase.supplier,
      rate: rateNum,
      totalAmount,
      invoiceNo: invoiceNo ?? oldPurchase.invoiceNo,
      billUrl: billUrl ?? oldPurchase.billUrl,
      paymentStatus: paymentStatus ?? oldPurchase.paymentStatus,
      paidAmount: paidAmount !== undefined ? Number(paidAmount) : oldPurchase.paidAmount,
      creditAmount: creditAmount !== undefined ? Number(creditAmount) : oldPurchase.creditAmount,
      transportCharges: transport,
      extraExpenses: extra,
      extraExpensesRemarks: extraExpensesRemarks || '',
      weightKg: weightKg !== undefined ? (weightKg === null ? undefined : Number(weightKg)) : oldPurchase.weightKg,
      thicknessSpecs: thicknessSpecs !== undefined ? (thicknessSpecs === null ? undefined : thicknessSpecs) : oldPurchase.thicknessSpecs,
    };
    db.purchases[idx] = updatedPurchase;

    db.auditLogs.unshift({
      id: genId('audit'),
      action: 'Material Purchase Updated',
      tableAffected: 'material_purchases',
      recordId: id,
      previousValue: JSON.stringify(oldPurchase),
      newValue: JSON.stringify(updatedPurchase),
      date: new Date().toISOString(),
      userId: userId || '1',
      userName: userName || 'Mestri',
    });

    // Notify if updated expense becomes large
    if (totalAmount > 50000 && oldPurchase.totalAmount <= 50000) {
      const project = db.projects.find((p: any) => p.id === projectId);
      db.notifications.unshift({
        id: genId('notif'),
        projectId,
        projectName: project ? project.projectName : 'Project',
        message: `⚡ LARGE EXPENSE ALERT (UPDATED): Purchase of "${updatedPurchase.materialName}" updated to ₹${totalAmount.toLocaleString()}, exceeding the ₹50,000 threshold.`,
        type: 'large_expense',
        date: new Date().toISOString(),
        amount: totalAmount,
        isReadBy: [],
      });
    }

    checkBusinessRulesAndNotify(db, projectId, userId);
    writeDb(db);
    res.json({ status: 'success', purchase: updatedPurchase });
  }
});

// Soft Delete Material Purchase
app.post('/api/purchases/:id/delete', (req, res) => {
  const { id } = req.params;
  const { userId, userName } = req.body;
  const db = readDb();
  const idx = db.purchases.findIndex((p: any) => p.id === id);
  if (idx !== -1) {
    const oldPurchase = db.purchases[idx];
    db.purchases[idx].isDeleted = true;

    db.auditLogs.unshift({
      id: genId('audit'),
      action: 'Soft Delete Material Purchase',
      tableAffected: 'material_purchases',
      recordId: id,
      previousValue: JSON.stringify(oldPurchase),
      newValue: JSON.stringify(db.purchases[idx]),
      date: new Date().toISOString(),
      userId: userId || '1',
      userName: userName || 'Supervisor',
    });

    checkBusinessRulesAndNotify(db, oldPurchase.projectId, userId);
    writeDb(db);
    return res.json({ status: 'success' });
  }
  res.status(404).json({ error: 'Purchase not found' });
});

// LABOR EXPENSE RECORDING
app.post('/api/labor', (req, res) => {
  const { projectId, date, workerType, numWorkers, dailyWage, remarks, userId, userName, paymentStatus } = req.body;
  const db = readDb();

  const num = Number(numWorkers) || 0;
  const wage = Number(dailyWage) || 0;
  const totalWage = num * wage;

  const newLabor: LaborExpense = {
    id: genId('lab'),
    projectId,
    date: date || new Date().toISOString().split('T')[0],
    workerType: workerType || WorkerType.HELPER,
    numWorkers: num,
    dailyWage: wage,
    totalWage,
    remarks: remarks || '',
    enteredBy: userName || 'Mestri',
    paymentStatus: paymentStatus || undefined,
  };

  db.laborExpenses.push(newLabor);

  db.auditLogs.unshift({
    id: genId('audit'),
    action: 'Labor Expense Recorded',
    tableAffected: 'labor_expenses',
    recordId: newLabor.id,
    previousValue: '',
    newValue: JSON.stringify(newLabor),
    date: new Date().toISOString(),
    userId: userId || '1',
    userName: userName || 'Mestri',
  });

  const project = db.projects.find((p: any) => p.id === projectId);

  // Large labor expense alert
  if (totalWage > 50000) {
    db.notifications.unshift({
      id: genId('notif'),
      projectId,
      projectName: project ? project.projectName : 'Project',
      message: `⚡ LARGE EXPENSE ALERT: Labor billing for ${newLabor.workerType} on ${newLabor.date} is ₹${totalWage.toLocaleString()}, exceeding the ₹50,000 threshold.`,
      type: 'large_expense',
      date: new Date().toISOString(),
      amount: totalWage,
      isReadBy: [],
    });
  }

  checkBusinessRulesAndNotify(db, projectId, userId);
  writeDb(db);
  res.json({ status: 'success', labor: newLabor });
});

// DAILY EXPENSES RECORDING
app.post('/api/daily-expenses', (req, res) => {
  const { projectId, date, category, description, amount, billUrl, userId, userName, paymentStatus } = req.body;
  const db = readDb();

  const amt = Number(amount) || 0;

  const newDaily: DailyExpense = {
    id: genId('d'),
    projectId,
    date: date || new Date().toISOString().split('T')[0],
    category: category || DailyExpenseCategory.MISCELLANEOUS,
    description: description || '',
    amount: amt,
    billUrl: billUrl || '',
    enteredBy: userName || 'Mestri',
    paymentStatus: paymentStatus || undefined,
  };

  db.dailyExpenses.push(newDaily);

  db.auditLogs.unshift({
    id: genId('audit'),
    action: 'Daily Expense Recorded',
    tableAffected: 'daily_expenses',
    recordId: newDaily.id,
    previousValue: '',
    newValue: JSON.stringify(newDaily),
    date: new Date().toISOString(),
    userId: userId || '1',
    userName: userName || 'Mestri',
  });

  const project = db.projects.find((p: any) => p.id === projectId);

  if (amt > 50000) {
    db.notifications.unshift({
      id: genId('notif'),
      projectId,
      projectName: project ? project.projectName : 'Project',
      message: `⚡ LARGE EXPENSE ALERT: Daily site expense for ${newDaily.category} is ₹${amt.toLocaleString()}, exceeding the ₹50,000 threshold.`,
      type: 'large_expense',
      date: new Date().toISOString(),
      amount: amt,
      isReadBy: [],
    });
  }

  checkBusinessRulesAndNotify(db, projectId, userId);
  writeDb(db);
  res.json({ status: 'success', daily: newDaily });
});

// MARK NOTIFICATION AS READ BY USER
app.post('/api/notifications/read', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'UserId is required' });
  const db = readDb();
  
  db.notifications.forEach((n: any) => {
    if (!n.isReadBy.includes(userId)) {
      n.isReadBy.push(userId);
    }
  });

  writeDb(db);
  res.json({ status: 'success' });
});

// Serve Vite dev server or frontend build bundle
async function startServer() {
  // Initialize Firestore
  initFirestore();

  // Initialize Local Database Cache
  initDb();

  // Automatically retrieve database cloud backup on boot
  await syncFromCloudToLocal();

  // If in dev mode, run Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production (or sandboxed AI Studio where HMR is disabled)
    // We compile and serve static built files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
