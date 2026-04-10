import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForAdmin,
  getUnreadCount,
  getAllItems,
} from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";
import type { Role } from "@/lib/auth";

function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === "admin";
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mlm_session")?.value;
  const user = token ? verifySessionToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
  const notifications = getNotificationsForAdmin(user.username, unreadOnly);
  const unreadCount = getUnreadCount(user.username);

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
