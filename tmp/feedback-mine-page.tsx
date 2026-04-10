"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Category = "bug" | "feature" | "note";
type Status = "new" | "acknowledged" | "in_progress" | "resolved" | "wont_fix";

interface FeedbackItem {
  id: string;
  category: Category;
  title: string;
  description: string;
  pageRoute: string;
  attachmentName?: string;
  status: Status;
  createdAt: string;
}

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
  wont_fix: "Won't Fix",
};

const STATUS_COLORS: Record<Status, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  acknowledged: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  in_progress: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  wont_fix: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const CAT_COLORS: Record<Category, string> = {
  bug: "bg-red-500/20 text-red-400",
  feature: "bg-green-500/20 text-green-400",
  note: "bg-slate-500/20 text-slate-400",
};

export default function MyFeedbackPage() {
  const router = useRouter();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) router.push("/login");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/feedback/items?mine=true&limit=50")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">My Feedback</h1>
        <p className="text-sm text-slate-400 mt-1">Your submitted feedback and their status</p>
      </div>

      <div className="rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/50">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Title</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Category</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Page</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
              {items.some((i) => i.attachmentName) && (
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Attachment</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                No feedback submitted yet. Click the Feedback button to get started.
              </td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-slate-700/30 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 text-slate-100 font-medium max-w-xs truncate">{item.title}</td>
                <td className="px-3 py-2.5">
                  <Badge className={cn("text-xs", CAT_COLORS[item.category])}>{item.category}</Badge>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs font-mono">{item.pageRoute}</td>
                <td className="px-3 py-2.5">
                  <Badge className={cn("text-xs border", STATUS_COLORS[item.status])}>
                    {STATUS_LABELS[item.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{new Date(item.createdAt).toLocaleDateString()}</td>
                {items.some((i) => i.attachmentName) && (
                  <td className="px-3 py-2.5">
                    {item.attachmentName && (
                      <a href={"/api/feedback/attachments/" + item.id} className="text-xs text-blue-400 hover:underline" download>
                        📎 {item.attachmentName}
                      </a>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
