import { NextRequest, NextResponse } from "next/server";
import { updateItem, getItemById } from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";
import type { Role } from "@/lib/auth";
import type { FeedbackStatus } from "@/lib/feedback-store";

function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === "admin";
}

export async function PATCH(
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

  const body = await request.json();
  const { status, adminNote } = body;

  const validStatuses: FeedbackStatus[] = ["new","acknowledged","in_progress","resolved","wont_fix"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const updated = updateItem(params.id, {
    status: status as FeedbackStatus,
    adminNotes: adminNote ? [`[${new Date().toISOString()}] ${user.username}: ${adminNote}`] : undefined,
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = request.cookies.get("mlm_session")?.value;
  const user = token ? verifySessionToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = getItemById(params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAdmin(user) && item.submittedBy !== user.username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(item);
}
