export type Role = 'school' | 'student' | 'mentor' | 'independent';
export type Specialty = 'robotics' | 'drone' | 'roboboat' | 'general';
export type Condition = 'new' | 'good' | 'fair' | 'parts_only';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'received';

export const ROLES: Role[] = ['school', 'student', 'mentor', 'independent'];
export const SPECIALTIES: Specialty[] = ['robotics', 'drone', 'roboboat', 'general'];
export const CONDITIONS: Condition[] = ['new', 'good', 'fair', 'parts_only'];
export const CATEGORIES = [
  'Motors',
  'Electronics',
  'Sensors',
  'Power',
  'Structure',
  'Hardware',
  'Tools',
  'Kits',
  'Other',
] as const;

export const CONDITION_LABELS: Record<Condition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  parts_only: 'Parts only',
};

export interface Profile {
  id: string;
  team_name: string;
  role: Role;
}

export interface Contacts {
  id: string;
  phone: string;
  email: string;
}

export interface Item {
  id: string;
  owner_id: string;
  name: string;
  photo_url: string | null; // square crop: thumbnails and item screens
  photo_full_url: string | null; // uncropped copy: full-screen feed
  category: string;
  specialty: Specialty;
  condition: Condition;
  notes: string;
  qty_total: number;
  qty_in_use: number;
  qty_available: number;
  qty_pending: number;
  created_at: string;
  updated_at: string;
  owner?: Pick<Profile, 'team_name' | 'role'> | null;
}

/** A requester's availability for one day of the week. Times are 24h "HH:MM". */
export type TimeWindow = { all_day: true } | { all_day: false; start: string; end: string };
/** Keyed by day number as a string: "0" = Sun … "6" = Sat. */
export type AvailabilityWindows = Partial<Record<string, TimeWindow>>;

export interface ItemRequest {
  id: string;
  item_id: string;
  item_name: string;
  owner_id: string;
  requester_id: string;
  qty: number;
  purpose: string;
  available_days: number[];
  available_windows: AvailabilityWindows;
  need_by: string;
  requester_suggested_date: string | null;
  owner_suggested_date: string | null;
  final_date: string | null;
  /** Owner drop-off window on final_date, "HH:MM". */
  dropoff_start: string | null;
  dropoff_end: string | null;
  status: RequestStatus;
  created_at: string;
  decided_at: string | null;
  received_at: string | null;
  /** Set when the owner taps "Mark as sent" (informational). */
  sent_at: string | null;
  item?: Pick<Item, 'id' | 'name' | 'photo_url' | 'specialty' | 'qty_total' | 'qty_available'> | null;
  owner?: Profile | null;
  requester?: Profile | null;
}

export interface RequestContacts {
  request_id: string;
  requester_phone: string;
  requester_email: string;
  owner_phone: string;
  owner_email: string;
}

export interface WishlistEntry {
  id: string;
  name: string;
  specialty: Specialty;
  qty_needed: number;
  need_by: string;
  urgent: boolean;
  notes: string;
  created_at: string;
  /** Community items (other teams, available > 0) matching this entry right now. */
  match_count: number;
}

export type WishlistInput = Pick<WishlistEntry, 'name' | 'specialty' | 'qty_needed' | 'need_by' | 'urgent' | 'notes'>;

export type NotificationType =
  | 'request_received'
  | 'request_approved'
  | 'request_denied'
  | 'wishlist_match'
  | 'final_date_set'
  | 'item_sent'
  | 'item_received';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  request_id: string | null;
  item_id: string | null;
  wishlist_entry_id: string | null;
  read_at: string | null;
  created_at: string;
}
