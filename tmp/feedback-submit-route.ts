import { NextRequest, NextResponse } from "next/server";
import {
  createItem,
  createNotificationsForAdmins,
  getAllAdminUsernames,
  ensureDir,
} from "@/lib/feedback-store";
import { verifySessionToken } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const ATTACH_DIR = path.join(DATA_DIR, "feedback_attachments");

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".pdf",
  ".txt", ".csv", ".xlsx", ".docx",
]);

// Magic bytes for type detection
const MAGIC: Record<string, number[]> = {
  ".jpg":  [0xff, 0xd8, 0xff],
  ".jpeg": [0xff, 0xd8, 0xff],
  ".png":  [0x89, 0x50, 0x4e, 0x47],
  ".gif":  [0x47, 0x49, 0x46],
  ".pdf":  [0x25, 0x50, 0x44, 0x46],
};

function validateMagics(ext: string, bytes: Buffer): boolean {
  const magic = MAGIC[ext];
  if (!magic) return true; // non-magic types trust extension
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

function safeExt(name: string): string {
  const base = path.extname(name).toLowerCase();
  return ALLOWED_EXTS.has(base) ? base : "";
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("mlm_session")?.value;
  const username = token ? verifySessionToken(token) : null;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  ensureDir(ATTACH_DIR);
  ensureDir(DATA_DIR);

  let attachmentPath: string | undefined;
  let attachmentName: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const category = formData.get("category") as string;
    const pageRoute = (formData.get("pageRoute") as string) || "/";

    if (!title || title.length > 120) {
      return NextResponse.json({ error: "title is required, max 120 chars" }, { status: 400 });
    }
    if (!description || description.length > 4000) {
      return NextResponse.json({ error: "description is required, max 4000 chars" }, { status: 400 });
    }
    if (!["bug", "feature", "note"].includes(category)) {
      return NextResponse.json({ error: "invalid category" }, { status: 400 });
    }

    const file = formData.get("attachment") as File | null;
    if (file && file.size > MAX_SIZE) {
      return NextResponse.json({ error: "attachment exceeds 5 MB limit" }, { status: 413 });
    }
    if (file) {
      const ext = safeExt(file.name);
      if (!ext) {
        return NextResponse.json({ error: "unsupported file type" }, { status: 415 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (!validateMagics(ext, buf)) {
        return NextResponse.json({ error: "file type mismatch" }, { status: 415 });
      }
      const safeName = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(ATTACH_DIR, safeName), buf);
      attachmentPath = safeName;
      attachmentName = file.name;
    }

    const usersRaw = fs.readFileSync(path.join(DATA_DIR, "users.json"), "utf-8");
    const users = JSON.parse(usersRaw);
    const currentUser = (Array.isArray(users) ? users : []).find(
      (u: { username: string }) => u.username === username
    );

    const item = createItem({
      submittedBy: username,
      submittedByRole: currentUser?.role === "admin" ? "admin" : "user",
      category,
      title,
      description,
      pageRoute,
      attachmentName,
      attachmentPath,
    });

    const admins = getAllAdminUsernames();
    createNotificationsForAdmins(item.id, admins, item.createdAt);

    return NextResponse.json({ id: item.id, status: item.status, createdAt: item.createdAt });
  }

  // JSON fallback
  const body = await request.json();
  const { category, title, description, pageRoute } = body;

  if (!title?.trim() || title.length > 120) {
    return NextResponse.json({ error: "title is required, max 120 chars" }, { status: 400 });
  }
  if (!description?.trim() || description.length > 4000) {
    return NextResponse.json({ error: "description is required, max 4000 chars" }, { status: 400 });
  }
  if (!["bug", "feature", "note"].includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const usersRaw = fs.readFileSync(path.join(DATA_DIR, "users.json"), "utf-8");
  const users = JSON.parse(usersRaw);
  const currentUser = (Array.isArray(users) ? users : []).find(
    (u: { username: string }) => u.username === username
  );

  const item = createItem({
    submittedBy: username,
    submittedByRole: currentUser?.role === "admin" ? "admin" : "user",
    category,
    title: title.trim(),
    description: description.trim(),
    pageRoute: pageRoute || "/",
  });

  const admins = getAllAdminUsernames();
  createNotificationsForAdmins(item.id, admins, item.createdAt);

  return NextResponse.json({ id: item.id, status: item.status, createdAt: item.createdAt });
}
