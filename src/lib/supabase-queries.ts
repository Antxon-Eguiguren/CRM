import type { TablesInsert } from './types';
import { supabase } from '@/supabaseClient';

/**
 * Common PostgREST select fragments (embed parent client for list UIs).
 * Use with the typed client: `supabase.from('contacts').select(SELECT_CONTACTS_WITH_CLIENT)`.
 */
export const SELECT_CONTACTS_WITH_CLIENT = '*, clients(name)' as const;
export const SELECT_PROJECTS_WITH_CLIENT = '*, clients(name)' as const;

/** Lightweight client pickers for dropdowns */
export const SELECT_CLIENTS_FOR_PICKER = 'id, name' as const;

export function insertClient(
  userId: string,
  values: Omit<TablesInsert<'clients'>, 'user_id' | 'id' | 'created_at'>,
): TablesInsert<'clients'> {
  return { ...values, user_id: userId };
}

export function insertContact(
  userId: string,
  values: Omit<TablesInsert<'contacts'>, 'user_id' | 'id' | 'created_at'>,
): TablesInsert<'contacts'> {
  return { ...values, user_id: userId };
}

export function insertProject(
  userId: string,
  values: Omit<TablesInsert<'projects'>, 'user_id' | 'id' | 'created_at'>,
): TablesInsert<'projects'> {
  return { ...values, user_id: userId };
}

/** Next `P-0001`-style reference from existing `reference` values (case-insensitive). */
export async function generateNextReference(): Promise<string> {
  const { data, error } = await supabase.from('projects').select('reference');
  if (error) throw new Error(error.message);
  let max = 0;
  const re = /^P-(\d+)$/i;
  for (const row of (data ?? []) as { reference: string }[]) {
    const m = re.exec(String(row.reference).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `P-${String(max + 1).padStart(4, '0')}`;
}
