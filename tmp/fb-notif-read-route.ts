import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";
import type { Role } from "@/lib/auth";

function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === "admin";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = request.cookies.get("mlm_session")?.value;
  const user = token ? verifySessionToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = markNotificationRead(params.id, user.username);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ read: true });
}
