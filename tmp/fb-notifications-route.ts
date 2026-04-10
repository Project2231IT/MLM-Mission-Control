import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForAdmin,
  markNotificationRead,
  getUnreadCount,
  getAllItems,
} from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function isAdmin(username: string): boolean {
  const usersRaw = fs.readFileSync(path.join(DATA_DIR, "users.json"), "utf-8");
  const users = JSON.parse(usersRaw);
  const u = (Array.isArray(users) ? users : []).find(
    (x: { username: string }) => x.username === username
  );
  return u?.role === "admin";
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mlm_session")?.value;
  const username = token ? verifySessionToken(token) : null;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
  const notifications = getNotificationsForAdmin(username, unreadOnly);
  const unreadCount = getUnreadCount(username);

  const allItems = getAllItems();
  const enriched = notifications.map((n) => {
    const item = allItems.find((i) => i.id === n.feedbackId);
    return {
      ...n,
      feedbackCategory: item?.category ?? "bug",
      feedbackTitle: item?.title ?? "",
    };
  });

  return NextResponse.json({ notifications: enriched, unreadCount });
}
