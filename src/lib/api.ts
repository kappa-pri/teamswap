import { supabase } from './supabase';
import type {
  AppNotification,
  AvailabilityWindows,
  Condition,
  Contacts,
  Item,
  ItemRequest,
  Profile,
  RequestContacts,
  Role,
  Specialty,
  WishlistEntry,
  WishlistInput,
} from './types';
import { todayISO } from './dates';

const OWNER = 'owner:profiles!items_owner_id_fkey(team_name, role)';
const REQUEST_SELECT = `*,
  item:items(id, name, photo_url, specialty, qty_total, qty_available),
  owner:profiles!requests_owner_id_fkey(id, team_name, role),
  requester:profiles!requests_requester_id_fkey(id, team_name, role)`;

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) {
    if (res.error.message.includes('items_qty_sum')) {
      throw new Error('Quantities changed while you were editing (a request may have just come in). Go back, reopen the item and try again.');
    }
    throw new Error(res.error.message);
  }
  return res.data as T;
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

// ---------- profiles & contacts ----------

export async function fetchProfile(id: string): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('id, team_name, role').eq('id', id).maybeSingle());
}

export async function fetchMyContacts(): Promise<Contacts | null> {
  const id = await myId();
  return unwrap(await supabase.from('contacts').select('*').eq('id', id).maybeSingle());
}

export async function updateMyProfile(patch: { team_name: string; role: Role }) {
  const id = await myId();
  unwrap(await supabase.from('profiles').update(patch).eq('id', id));
}

export async function updateMyContacts(patch: { phone: string; email: string }) {
  const id = await myId();
  unwrap(await supabase.from('contacts').update(patch).eq('id', id));
}

// ---------- items ----------

export interface ItemInput {
  name: string;
  photo_url: string | null;
  photo_full_url: string | null;
  category: string;
  specialty: Specialty;
  condition: Condition;
  notes: string;
  qty_total: number;
  qty_in_use: number;
  qty_available: number;
}

export async function fetchMyItems(): Promise<Item[]> {
  const id = await myId();
  return unwrap(
    await supabase.from('items').select('*').eq('owner_id', id).order('updated_at', { ascending: false }),
  );
}

export async function fetchItem(id: string): Promise<Item | null> {
  return unwrap(await supabase.from('items').select(`*, ${OWNER}`).eq('id', id).maybeSingle());
}

/**
 * True when the database hasn't been upgraded with items.photo_full_url yet
 * (schema.sql not re-run). Saving then retries without it, so the square
 * photo still saves; the feed just uses the square until the upgrade.
 */
function missingFullPhotoColumn(error: { message: string } | null): boolean {
  return !!error && error.message.includes('photo_full_url');
}

function withoutFullPhoto<T extends Partial<ItemInput>>(input: T): Omit<T, 'photo_full_url'> {
  const { photo_full_url: _omit, ...rest } = input;
  return rest;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const owner_id = await myId();
  let res = await supabase.from('items').insert({ ...input, owner_id }).select('*').single();
  if (missingFullPhotoColumn(res.error)) {
    res = await supabase.from('items').insert({ ...withoutFullPhoto(input), owner_id }).select('*').single();
  }
  return unwrap(res);
}

export async function updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
  let res = await supabase.from('items').update(input).eq('id', id).select('*').single();
  if (missingFullPhotoColumn(res.error)) {
    res = await supabase.from('items').update(withoutFullPhoto(input)).eq('id', id).select('*').single();
  }
  return unwrap(res);
}

export async function deleteItem(id: string) {
  unwrap(await supabase.from('items').delete().eq('id', id));
}

/**
 * Move units between in-use and available. Total and pending are untouched.
 * Re-reads the row first so a request that just moved units into pending
 * can't make the in_use + available + pending = total check fail.
 */
export async function setSplit(item: Item, qty_available: number): Promise<Item> {
  const fresh: Pick<Item, 'qty_total' | 'qty_pending'> = unwrap(
    await supabase.from('items').select('qty_total, qty_pending').eq('id', item.id).single(),
  );
  const free = fresh.qty_total - fresh.qty_pending;
  const available = Math.max(0, Math.min(free, qty_available));
  return updateItem(item.id, { qty_available: available, qty_in_use: free - available });
}

export async function fetchCommunity(): Promise<Item[]> {
  const id = await myId();
  return unwrap(
    await supabase
      .from('items')
      .select(`*, ${OWNER}`)
      .gt('qty_available', 0)
      .neq('owner_id', id)
      .order('updated_at', { ascending: false }),
  );
}

export async function fetchSharedItemsOf(ownerId: string): Promise<Item[]> {
  return unwrap(
    await supabase
      .from('items')
      .select(`*, ${OWNER}`)
      .eq('owner_id', ownerId)
      .gt('qty_available', 0)
      .order('updated_at', { ascending: false }),
  );
}

// ---------- requests ----------

export async function fetchMyRequests(): Promise<{ me: string; incoming: ItemRequest[]; outgoing: ItemRequest[] }> {
  const me = await myId();
  const rows: ItemRequest[] = unwrap(
    await supabase.from('requests').select(REQUEST_SELECT).order('created_at', { ascending: false }),
  );
  return {
    me,
    incoming: rows.filter((r) => r.owner_id === me),
    outgoing: rows.filter((r) => r.requester_id === me),
  };
}

export async function fetchItemRequestCounts(itemId: string) {
  const rows: { status: string }[] = unwrap(
    await supabase.from('requests').select('status').eq('item_id', itemId).in('status', ['pending', 'approved']),
  );
  return {
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
  };
}

export async function fetchRequest(id: string): Promise<ItemRequest | null> {
  return unwrap(await supabase.from('requests').select(REQUEST_SELECT).eq('id', id).maybeSingle());
}

/** Returns null until the request is approved (enforced by RLS). */
export async function fetchRequestContacts(id: string): Promise<RequestContacts | null> {
  return unwrap(await supabase.from('request_contacts').select('*').eq('request_id', id).maybeSingle());
}

export async function fetchHomeCounts() {
  const me = await myId();
  const [incoming, outgoing, active, flagged, saved] = await Promise.all([
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('owner_id', me).eq('status', 'pending'),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', me).eq('status', 'pending'),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('items').select('qty_available').eq('owner_id', me).gt('qty_available', 0),
    supabase.from('saved_items').select('item_id', { count: 'exact', head: true }),
  ]);
  for (const r of [incoming, outgoing, active, flagged]) if (r.error) throw new Error(r.error.message);
  // Saved count is a nice-to-have; never let it break the rest of Home.
  const flaggedRows = (flagged.data ?? []) as { qty_available: number }[];
  return {
    incomingPending: incoming.count ?? 0,
    outgoingPending: outgoing.count ?? 0,
    activeExchanges: active.count ?? 0,
    flaggedItems: flaggedRows.length,
    flaggedUnits: flaggedRows.reduce((s, r) => s + r.qty_available, 0),
    savedItems: saved.error ? 0 : (saved.count ?? 0),
  };
}

export interface SubmitRequestInput {
  itemId: string;
  qty: number;
  purpose: string;
  availableDays: number[];
  availableWindows: AvailabilityWindows;
  needBy: string;
  suggestedDate: string | null;
  phone: string;
  email: string;
}

export async function submitRequest(i: SubmitRequestInput): Promise<string> {
  return unwrap(
    await supabase.rpc('submit_request', {
      p_item_id: i.itemId,
      p_qty: i.qty,
      p_purpose: i.purpose,
      p_available_days: i.availableDays,
      p_available_windows: i.availableWindows,
      p_need_by: i.needBy,
      p_suggested_date: i.suggestedDate,
      p_phone: i.phone,
      p_email: i.email,
    }),
  );
}

export async function decideRequest(id: string, approve: boolean) {
  unwrap(await supabase.rpc('decide_request', { p_request_id: id, p_approve: approve }));
}

export async function suggestPickupDate(id: string, date: string) {
  unwrap(await supabase.rpc('suggest_pickup_date', { p_request_id: id, p_date: date }));
}

/** Owners must pass a drop-off window; requesters confirm the date only. */
export async function confirmFinalDate(id: string, date: string, dropoff?: { start: string; end: string }) {
  unwrap(
    await supabase.rpc('confirm_final_date', {
      p_request_id: id,
      p_date: date,
      p_dropoff_start: dropoff?.start ?? null,
      p_dropoff_end: dropoff?.end ?? null,
    }),
  );
}

/** Owner (giver) only. */
export async function markSent(id: string) {
  unwrap(await supabase.rpc('mark_sent', { p_request_id: id }));
}

/** Requester (receiver) only. Closes the exchange and removes the units from inventory. */
export async function markReceived(id: string) {
  unwrap(await supabase.rpc('mark_received', { p_request_id: id }));
}

// ---------- saved items (bookmarks) ----------

export interface SavedEntry {
  created_at: string;
  item: Item | null;
}

export async function fetchSavedIds(): Promise<Set<string>> {
  const rows: { item_id: string }[] = unwrap(await supabase.from('saved_items').select('item_id'));
  return new Set(rows.map((r) => r.item_id));
}

export async function fetchSavedItems(): Promise<SavedEntry[]> {
  const res = await supabase
    .from('saved_items')
    .select(`created_at, item:items(*, ${OWNER})`)
    .order('created_at', { ascending: false });
  // item_id → items is many-to-one, so PostgREST returns a single object (or null).
  return unwrap(res) as unknown as SavedEntry[];
}

export async function fetchSavedCount(): Promise<number> {
  const res = await supabase.from('saved_items').select('item_id', { count: 'exact', head: true });
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export async function saveItem(itemId: string) {
  unwrap(await supabase.rpc('save_item', { p_item_id: itemId }));
}

export async function unsaveItem(itemId: string) {
  unwrap(await supabase.rpc('unsave_item', { p_item_id: itemId }));
}

/** Item ids I have a request on that the owner hasn't answered yet. */
export async function fetchMyPendingRequestItemIds(): Promise<Set<string>> {
  const me = await myId();
  const rows: { item_id: string }[] = unwrap(
    await supabase.from('requests').select('item_id').eq('requester_id', me).eq('status', 'pending'),
  );
  return new Set(rows.map((r) => r.item_id));
}

// ---------- wishlist ----------

/** My entries with live match counts. Also deletes entries past their need-by date. */
export async function fetchMyWishlist(): Promise<WishlistEntry[]> {
  return unwrap(await supabase.rpc('get_my_wishlist', { p_today: todayISO() }));
}

export async function fetchWishlistEntry(id: string): Promise<WishlistEntry | null> {
  return unwrap(await supabase.from('wishlist_entries').select('*').eq('id', id).maybeSingle());
}

export async function createWishlistEntry(input: WishlistInput) {
  unwrap(await supabase.from('wishlist_entries').insert(input));
}

export async function updateWishlistEntry(id: string, input: WishlistInput) {
  unwrap(await supabase.from('wishlist_entries').update(input).eq('id', id));
}

export async function deleteWishlistEntry(id: string) {
  unwrap(await supabase.from('wishlist_entries').delete().eq('id', id));
}

export async function fetchWishlistMatches(entryId: string): Promise<Item[]> {
  const ids: string[] = unwrap(await supabase.rpc('get_wishlist_matches', { p_entry_id: entryId }));
  if (ids.length === 0) return [];
  const items: Item[] = unwrap(await supabase.from('items').select(`*, ${OWNER}`).in('id', ids));
  const order = new Map(ids.map((id, i) => [id, i]));
  return items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ---------- notifications ----------

export async function fetchNotifications(limit = 60): Promise<AppNotification[]> {
  return unwrap(
    await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit),
  );
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

/** Mark the given notifications read, or all of mine when ids is omitted. */
export async function markNotificationsRead(ids?: string[]) {
  unwrap(await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null }));
}
