import { NextRequest, NextResponse } from "next/server";
import { getAllItems } from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";
import type { Role } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mlm_session")?.value;
  const user = token ? verifySessionToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const allItems = getAllItems();
  const admin = user.role === "admin";

  let filtered = allItems;

  if (mine && !admin) {
    filtered = filtered.filter((i) => i.submittedBy === user.username);
  } else if (!admin) {
    filtered = filtered.filter((i) => i.submittedBy === user.username);
  }

  if (category) {
    filtered = filtered.filter((i) => i.category === category);
  }
  if (status) {
    filtered = filtered.filter((i) => i.status === status);
  }

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);

  return NextResponse.json({ items, total, page, limit });
}
