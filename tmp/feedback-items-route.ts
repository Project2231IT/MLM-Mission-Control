import { NextRequest, NextResponse } from "next/server";
import { getAllItems } from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mlm_session")?.value;
  const username = token ? verifySessionToken(token) : null;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const allItems = getAllItems();

  // Determine if user is admin
  const usersRaw = require("fs").readFileSync(
    require("path").join(process.cwd(), "data", "users.json"),
    "utf-8"
  );
  const users = JSON.parse(usersRaw);
  const currentUser = (Array.isArray(users) ? users : []).find(
    (u: { username: string }) => u.username === username
  );
  const isAdmin = currentUser?.role === "admin";

  let filtered = allItems;

  if (mine && !isAdmin) {
    filtered = filtered.filter((i: { submittedBy: string }) => i.submittedBy === username);
  }

  if (category) {
    filtered = filtered.filter((i: { category: string }) => i.category === category);
  }
  if (status) {
    filtered = filtered.filter((i: { status: string }) => i.status === status);
  }

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);

  return NextResponse.json({ items, total, page, limit });
}
