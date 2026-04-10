import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForAdmin,
  markNotificationRead,
  getUnreadCount,
} from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mlm_session")?.value;
  const username = token ? verifySessionToken(token) : null;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const usersRaw = require("fs").readFileSync(
    require("path").join(process.cwd(), "data", "users.json"),
    "utf-8"
  );
  const users = JSON.parse(usersRaw);
  const currentUser = (Array.isArray(users) ? users : []).find(
    (u: { username: string }) => u.username === username
  );
  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
  const notifications = getNotificationsForAdmin(username, unreadOnly);
  const unreadCount = getUnreadCount(username);

  return NextResponse.json({ notifications, unreadCount });
}
