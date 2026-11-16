import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { BorrowingRepayment, BorrowingStatus, ProjectBorrowing, User } from '../types';
import { mapBorrowing, mapRepayment, uploadDataUrlIfNeeded } from './supabaseServer';

const FALLBACK_DIR = path.resolve(process.cwd(), 'data');
const FALLBACK_FILE = path.join(FALLBACK_DIR, 'borrowings_store.json');

interface FallbackStore {
  borrowings: any[];
  repayments: any[];
}

function ensureFallbackStore(): FallbackStore {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    if (!fs.existsSync(FALLBACK_FILE)) {
      const initial: FallbackStore = { borrowings: [], repayments: [] };
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      borrowings: Array.isArray(parsed.borrowings) ? parsed.borrowings : [],
      repayments: Array.isArray(parsed.repayments) ? parsed.repayments : [],
    };
  } catch (e) {
    return { borrowings: [], repayments: [] };
  }
}

function writeFallbackStore(store: FallbackStore) {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed writing fallback borrowings store:', e);
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function getBorrowingsFromDb(
  supabase: SupabaseClient,
  projectId?: string
): Promise<{ borrowings: ProjectBorrowing[]; repayments: BorrowingRepayment[] }> {
  try {
    let bQuery = supabase.from('project_borrowings').select('*').order('date', { ascending: false });
    let rQuery = supabase.from('borrowing_repayments').select('*').order('date', { ascending: false });

    if (projectId) {
      bQuery = bQuery.eq('project_id', projectId);
      rQuery = rQuery.eq('project_id', projectId);
    }

    const [bRes, rRes] = await Promise.all([bQuery, rQuery]);

    // If Supabase table does not exist yet (PGRST205 / 42P01), fall back gracefully to local file
    if (bRes.error || rRes.error) {
      const err = bRes.error || rRes.error;
      if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
        const store = ensureFallbackStore();
        let fBorrowings = store.borrowings;
        let fRepayments = store.repayments;
        if (projectId) {
          fBorrowings = fBorrowings.filter((b) => b.project_id === projectId);
          fRepayments = fRepayments.filter((r) => r.project_id === projectId);
        }
        const mappedRepayments = fRepayments.map(mapRepayment);
        const mappedBorrowings = fBorrowings.map((b) => {
          const matchingRepayments = mappedRepayments.filter((r) => r.borrowingId === b.id);
          return mapBorrowing(b, matchingRepayments);
        });
        return { borrowings: mappedBorrowings, repayments: mappedRepayments };
      }
      throw err;
    }

    const mappedRepayments = (rRes.data || []).map(mapRepayment);
    const mappedBorrowings = (bRes.data || []).map((b) => {
      const matchingRepayments = mappedRepayments.filter((r) => r.borrowingId === b.id);
      return mapBorrowing(b, matchingRepayments);
    });

    return { borrowings: mappedBorrowings, repayments: mappedRepayments };
  } catch (err) {
    const store = ensureFallbackStore();
    let fBorrowings = store.borrowings;
    let fRepayments = store.repayments;
    if (projectId) {
      fBorrowings = fBorrowings.filter((b) => b.project_id === projectId);
      fRepayments = fRepayments.filter((r) => r.project_id === projectId);
    }
    const mappedRepayments = fRepayments.map(mapRepayment);
    const mappedBorrowings = fBorrowings.map((b) => {
      const matchingRepayments = mappedRepayments.filter((r) => r.borrowingId === b.id);
      return mapBorrowing(b, matchingRepayments);
    });
    return { borrowings: mappedBorrowings, repayments: mappedRepayments };
  }
}

export async function saveBorrowingToDb(
  supabase: SupabaseClient,
  data: Partial<ProjectBorrowing>,
  userName: string
): Promise<ProjectBorrowing> {
  const principal = Number(data.amount) || 0;
  const interest = Number(data.interestAmount) || 0;
  const totalDue = principal + interest;
  const repaid = Number(data.repaidAmount) || 0;
  const balanceDue = Math.max(0, totalDue - repaid);

  let status = 'Active';
  if (balanceDue <= 0 && repaid > 0) status = 'Settled';
  else if (repaid > 0) status = 'Partially Repaid';

  let receiptUrl = data.receiptUrl || '';
  if (receiptUrl.startsWith('data:')) {
    receiptUrl = await uploadDataUrlIfNeeded(supabase, receiptUrl, 'borrowings', 'borrowing_doc');
  }

  const isNew = !data.id;
  const borrowingId = data.id || genId('borrow');

  const row = {
    id: borrowingId,
    project_id: data.projectId,
    date: data.date || new Date().toISOString().split('T')[0],
    lender_name: (data.lenderName || 'External Lender').trim(),
    lender_contact: (data.lenderContact || '').trim(),
    borrower_name: (data.borrowerName || userName).trim(),
    amount: principal,
    interest_amount: interest,
    total_due: totalDue,
    repaid_amount: repaid,
    balance_due: balanceDue,
    purpose: (data.purpose || '').trim(),
    due_date: data.dueDate || null,
    status,
    receipt_url: receiptUrl,
    notes: (data.notes || '').trim(),
    updated_at: new Date().toISOString(),
  };

  try {
    if (isNew) {
      const { data: inserted, error } = await supabase
        .from('project_borrowings')
        .insert({ ...row, created_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) throw error;
      return mapBorrowing(inserted, []);
    } else {
      const { data: updated, error } = await supabase
        .from('project_borrowings')
        .update(row)
        .eq('id', borrowingId)
        .select('*')
        .single();
      if (error) throw error;

      const { data: reps } = await supabase
        .from('borrowing_repayments')
        .select('*')
        .eq('borrowing_id', borrowingId)
        .order('date', { ascending: false });
      return mapBorrowing(updated, (reps || []).map(mapRepayment));
    }
  } catch (err: any) {
    // If Supabase table isn't present, store in local fallback
    if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
      const store = ensureFallbackStore();
      const existingIdx = store.borrowings.findIndex((b) => b.id === borrowingId);
      if (existingIdx >= 0) {
        store.borrowings[existingIdx] = {
          ...store.borrowings[existingIdx],
          ...row,
        };
      } else {
        store.borrowings.unshift({
          ...row,
          created_at: new Date().toISOString(),
        });
      }
      writeFallbackStore(store);

      const matchingReps = store.repayments.filter((r) => r.borrowing_id === borrowingId).map(mapRepayment);
      return mapBorrowing(row, matchingReps);
    }
    throw err;
  }
}

export async function addRepaymentToDb(
  supabase: SupabaseClient,
  borrowingId: string,
  data: Partial<BorrowingRepayment>,
  userName: string
): Promise<{ borrowing: ProjectBorrowing; repayment: BorrowingRepayment }> {
  const repaymentAmount = Number(data.amount) || 0;
  if (repaymentAmount <= 0) {
    throw new Error('Repayment amount must be greater than zero.');
  }

  let receiptUrl = data.receiptUrl || '';
  if (receiptUrl.startsWith('data:')) {
    receiptUrl = await uploadDataUrlIfNeeded(supabase, receiptUrl, 'borrowings', 'repayment_receipt');
  }

  const repaymentId = genId('repay');

  try {
    // 1. Fetch current borrowing
    const { data: bRow, error: bErr } = await supabase
      .from('project_borrowings')
      .select('*')
      .eq('id', borrowingId)
      .single();
    if (bErr) throw bErr;
    if (!bRow) throw new Error('Target borrowing record not found.');

    const newRepaymentRow = {
      id: repaymentId,
      borrowing_id: borrowingId,
      project_id: bRow.project_id,
      date: data.date || new Date().toISOString().split('T')[0],
      amount: repaymentAmount,
      repaid_by: (data.repaidBy || userName).trim(),
      payment_mode: data.paymentMode || 'UPI / Bank Transfer',
      reference_no: (data.referenceNo || '').trim(),
      receipt_url: receiptUrl,
      remarks: (data.remarks || '').trim(),
      created_at: new Date().toISOString(),
    };

    const { data: insRep, error: insErr } = await supabase
      .from('borrowing_repayments')
      .insert(newRepaymentRow)
      .select('*')
      .single();
    if (insErr) throw insErr;

    // 2. Compute updated totals
    const currentRepaid = Number(bRow.repaid_amount) || 0;
    const newRepaid = currentRepaid + repaymentAmount;
    const totalDue = Number(bRow.total_due) || (Number(bRow.amount) + Number(bRow.interest_amount));
    const newBalance = Math.max(0, totalDue - newRepaid);

    let newStatus = 'Active';
    if (newBalance <= 0) newStatus = 'Settled';
    else if (newRepaid > 0) newStatus = 'Partially Repaid';

    const { data: updatedB, error: updErr } = await supabase
      .from('project_borrowings')
      .update({
        repaid_amount: newRepaid,
        balance_due: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', borrowingId)
      .select('*')
      .single();
    if (updErr) throw updErr;

    const { data: allReps } = await supabase
      .from('borrowing_repayments')
      .select('*')
      .eq('borrowing_id', borrowingId)
      .order('date', { ascending: false });

    return {
      borrowing: mapBorrowing(updatedB, (allReps || []).map(mapRepayment)),
      repayment: mapRepayment(insRep),
    };
  } catch (err: any) {
    if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
      const store = ensureFallbackStore();
      const bIdx = store.borrowings.findIndex((b) => b.id === borrowingId);
      if (bIdx < 0) throw new Error('Target borrowing record not found.');

      const bRow = store.borrowings[bIdx];
      const newRepRow = {
        id: repaymentId,
        borrowing_id: borrowingId,
        project_id: bRow.project_id,
        date: data.date || new Date().toISOString().split('T')[0],
        amount: repaymentAmount,
        repaid_by: (data.repaidBy || userName).trim(),
        payment_mode: data.paymentMode || 'UPI / Bank Transfer',
        reference_no: (data.referenceNo || '').trim(),
        receipt_url: receiptUrl,
        remarks: (data.remarks || '').trim(),
        created_at: new Date().toISOString(),
      };
      store.repayments.unshift(newRepRow);

      const currentRepaid = Number(bRow.repaid_amount) || 0;
      const newRepaid = currentRepaid + repaymentAmount;
      const totalDue = Number(bRow.total_due) || (Number(bRow.amount) + Number(bRow.interest_amount));
      const newBalance = Math.max(0, totalDue - newRepaid);

      let newStatus = 'Active';
      if (newBalance <= 0) newStatus = 'Settled';
      else if (newRepaid > 0) newStatus = 'Partially Repaid';

      store.borrowings[bIdx] = {
        ...bRow,
        repaid_amount: newRepaid,
        balance_due: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      writeFallbackStore(store);

      const matchingReps = store.repayments.filter((r) => r.borrowing_id === borrowingId).map(mapRepayment);
      return {
        borrowing: mapBorrowing(store.borrowings[bIdx], matchingReps),
        repayment: mapRepayment(newRepRow),
      };
    }
    throw err;
  }
}

export async function deleteBorrowingFromDb(supabase: SupabaseClient, borrowingId: string): Promise<void> {
  try {
    await supabase.from('borrowing_repayments').delete().eq('borrowing_id', borrowingId);
    const { error } = await supabase.from('project_borrowings').delete().eq('id', borrowingId);
    if (error) throw error;
  } catch (err: any) {
    if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
      const store = ensureFallbackStore();
      store.borrowings = store.borrowings.filter((b) => b.id !== borrowingId);
      store.repayments = store.repayments.filter((r) => r.borrowing_id !== borrowingId);
      writeFallbackStore(store);
      return;
    }
    throw err;
  }
}

export async function deleteRepaymentFromDb(
  supabase: SupabaseClient,
  repaymentId: string
): Promise<ProjectBorrowing> {
  try {
    const { data: repRow, error: repErr } = await supabase
      .from('borrowing_repayments')
      .select('*')
      .eq('id', repaymentId)
      .single();
    if (repErr) throw repErr;
    if (!repRow) throw new Error('Repayment record not found.');

    const borrowingId = repRow.borrowing_id;
    const repAmount = Number(repRow.amount) || 0;

    await supabase.from('borrowing_repayments').delete().eq('id', repaymentId);

    const { data: bRow } = await supabase
      .from('project_borrowings')
      .select('*')
      .eq('id', borrowingId)
      .single();

    if (bRow) {
      const currentRepaid = Number(bRow.repaid_amount) || 0;
      const newRepaid = Math.max(0, currentRepaid - repAmount);
      const totalDue = Number(bRow.total_due) || (Number(bRow.amount) + Number(bRow.interest_amount));
      const newBalance = Math.max(0, totalDue - newRepaid);

      let newStatus = 'Active';
      if (newBalance <= 0 && newRepaid > 0) newStatus = 'Settled';
      else if (newRepaid > 0) newStatus = 'Partially Repaid';

      const { data: updatedB } = await supabase
        .from('project_borrowings')
        .update({
          repaid_amount: newRepaid,
          balance_due: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', borrowingId)
        .select('*')
        .single();

      const { data: remainingReps } = await supabase
        .from('borrowing_repayments')
        .select('*')
        .eq('borrowing_id', borrowingId)
        .order('date', { ascending: false });

      return mapBorrowing(updatedB || bRow, (remainingReps || []).map(mapRepayment));
    }
    throw new Error('Associated borrowing record not found.');
  } catch (err: any) {
    if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
      const store = ensureFallbackStore();
      const repIdx = store.repayments.findIndex((r) => r.id === repaymentId);
      if (repIdx < 0) throw new Error('Repayment record not found.');

      const repRow = store.repayments[repIdx];
      const borrowingId = repRow.borrowing_id;
      const repAmount = Number(repRow.amount) || 0;

      store.repayments.splice(repIdx, 1);

      const bIdx = store.borrowings.findIndex((b) => b.id === borrowingId);
      if (bIdx >= 0) {
        const bRow = store.borrowings[bIdx];
        const currentRepaid = Number(bRow.repaid_amount) || 0;
        const newRepaid = Math.max(0, currentRepaid - repAmount);
        const totalDue = Number(bRow.total_due) || (Number(bRow.amount) + Number(bRow.interest_amount));
        const newBalance = Math.max(0, totalDue - newRepaid);

        let newStatus = 'Active';
        if (newBalance <= 0 && newRepaid > 0) newStatus = 'Settled';
        else if (newRepaid > 0) newStatus = 'Partially Repaid';

        store.borrowings[bIdx] = {
          ...bRow,
          repaid_amount: newRepaid,
          balance_due: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        writeFallbackStore(store);

        const matchingReps = store.repayments.filter((r) => r.borrowing_id === borrowingId).map(mapRepayment);
        return mapBorrowing(store.borrowings[bIdx], matchingReps);
      }
    }
    throw err;
  }
}
