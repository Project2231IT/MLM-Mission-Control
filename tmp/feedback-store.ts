import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DATA_DIR = path.join(process.cwd(), "data");
const ITEMS_FILE = path.join(DATA_DIR, "feedback_items.json");
const NOTIFS_FILE = path.join(DATA_DIR, "feedback_notifications.json");
const ATTACH_DIR = path.join(DATA_DIR, "feedback_attachments");

export type FeedbackCategory = "bug" | "feature" | "note";
export type FeedbackStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "wont_fix";

export interface FeedbackItem {
  id: string;
  submittedBy: string;
  submittedByRole: "admin" | "user";
  category: FeedbackCategory;
  title: string;
  description: string;
  pageRoute: string;
  attachmentName?: string;
  attachmentPath?: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  adminNotes: string[];
}

export interface FeedbackNotification {
  id: string;
  feedbackId: string;
  adminUsername: string;
  read: boolean;
  createdAt: string;
}

interface ItemsStore {
  items: FeedbackItem[];
}
interface NotifsStore {
  notifications: FeedbackNotification[];
}

function readItems(): ItemsStore {
  const raw = fs.readFileSync(ITEMS_FILE, "utf-8");
  return JSON.parse(raw);
}
function writeItems(store: ItemsStore): void {
  fs.writeFileSync(ITEMS_FILE, JSON.stringify(store, null, 2));
}
function readNotifs(): NotifsStore {
  const raw = fs.readFileSync(NOTIFS_FILE, "utf-8");
  return JSON.parse(raw);
}
function writeNotifs(store: NotifsStore): void {
  fs.writeFileSync(NOTIFS_FILE, JSON.stringify(store, null, 2));
}

export function getAllItems(): FeedbackItem[] {
  return readItems().items;
}

export function getItemById(id: string): FeedbackItem | undefined {
  return getAllItems().find((i) => i.id === id);
}

export function createItem(
  data: Omit<FeedbackItem, "id" | "status" | "createdAt" | "updatedAt" | "adminNotes">
): FeedbackItem {
  const now = new Date().toISOString();
  const item: FeedbackItem = {
    ...data,
    id: uuidv4(),
    status: "new",
    createdAt: now,
    updatedAt: now,
    adminNotes: [],
  };
  const store = readItems();
  store.items.unshift(item);
  writeItems(store);
  return item;
}

export function updateItem(
  id: string,
  patch: Partial<Pick<FeedbackItem, "status" | "adminNotes">>
): FeedbackItem | undefined {
  const store = readItems();
  const idx = store.items.findIndex((i) => i.id === id);
  if (idx === -1) return undefined;
  const item = store.items[idx];
  if (patch.status) item.status = patch.status;
  if (patch.adminNotes) {
    item.adminNotes = [...item.adminNotes, ...patch.adminNotes];
  }
  item.updatedAt = new Date().toISOString();
  store.items[idx] = item;
  writeItems(store);
  return item;
}

export function createNotificationsForAdmins(
  feedbackId: string,
  adminUsernames: string[],
  createdAt: string
): void {
  const store = readNotifs();
  for (const username of adminUsernames) {
    store.notifications.push({
      id: uuidv4(),
      feedbackId,
      adminUsername: username,
      read: false,
      createdAt,
    });
  }
  writeNotifs(store);
}

export function getNotificationsForAdmin(
  username: string,
  unreadOnly = false
): FeedbackNotification[] {
  const store = readNotifs();
  return store.notifications
    .filter((n) => n.adminUsername === username && (!unreadOnly || !n.read))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationRead(id: string, username: string): boolean {
  const store = readNotifs();
  const idx = store.notifications.findIndex(
    (n) => n.id === id && n.adminUsername === username
  );
  if (idx === -1) return false;
  store.notifications[idx].read = true;
  writeNotifs(store);
  return true;
}

export function getUnreadCount(username: string): number {
  return readNotifs().notifications.filter(
    (n) => n.adminUsername === username && !n.read
  ).length;
}

export function getAllAdminUsernames(): string[] {
  const usersRaw = fs.readFileSync(
    path.join(DATA_DIR, "users.json"),
    "utf-8"
  );
  const users = JSON.parse(usersRaw);
  return (Array.isArray(users) ? users : [])
    .filter((u: { role?: string; active?: boolean }) => u.role === "admin" && u.active !== false)
    .map((u: { username: string }) => u.username);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
