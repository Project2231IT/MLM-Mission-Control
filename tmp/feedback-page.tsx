"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Category = "bug" | "feature" | "note";
type Status = "new" | "acknowledged" | "in_progress" | "resolved" | "wont_fix";

interface FeedbackItem {
  id: string;
  submittedBy: string;
  category: Category;
  title: string;
  description: string;
  pageRoute: string;
  attachmentName?: string;
  status: Status;
  createdAt: string;
  adminNotes: string[];
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Ack" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "wont_fix", label: "Won't Fix" },
];

const CAT_COLORS: Record<Category, string> = {
  bug: "bg-red-500/20 text-red-400",
  feature: "bg-green-500/20 text-green-400",
  note: "bg-slate-500/20 text-slate-400",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  acknowledged: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  in_progress: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  wont_fix: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function FeedbackPage() {
  const router = useRouter();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [limit] = useState(20);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.role !== "admin") router.push("/");
      })
      .catch(() => router.push("/"));
  }, [router]);

  function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);
    params.set("page", String(p));
    params.set("limit", String(limit));
    fetch("/api/feedback/items?" + params.toString())
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setPage(p);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [category, status]);

  async function handleStatusChange(id: string, newStatus: string) {
    await fetch("/api/feedback/items/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load(page);
    if (selected?.id === id) setSelected((s) => s ? { ...s, status: newStatus as Status } : s);
  }

  const totalPages = Math.ceil(total / limit);
  const filtered = items.filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feedback</h1>
          <p className="text-sm text-slate-400 mt-1">Review and manage all submissions</p>
        </div>
        <span className="text-sm text-slate-400">{total} total</span>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by title..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select
          options={[
            { value: "all", label: "All Categories" },
            { value: "bug", label: "Bug" },
            { value: "feature", label: "Feature" },
            { value: "note", label: "Note" },
          ]}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-36"
        />
        <Select
          options={[
            { value: "all", label: "All Statuses" },
            { value: "new", label: "New" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "in_progress", label: "In Progress" },
            { value: "resolved", label: "Resolved" },
            { value: "wont_fix", label: "Won't Fix" },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-44"
        />
      </div>

      <div className="rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Title</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Category</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">By</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Page</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No feedback yet</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/30 hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2.5 text-slate-100 font-medium max-w-xs truncate">{item.title}</td>
                  <td className="px-3 py-2.5">
                    <Badge className={cn("text-xs", CAT_COLORS[item.category])}>{item.category}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs">{item.submittedBy}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs font-mono">{item.pageRoute}</td>
                  <td className="px-3 py-2.5">
                    <Select
                      options={STATUS_OPTIONS}
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className={cn("h-6 text-xs w-28 border", STATUS_COLORS[item.status])}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs">{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(item)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</Button>
          <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</Button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelected(null)} />
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-700 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <Badge className={cn("mb-2", CAT_COLORS[selected.category])}>{selected.category}</Badge>
                <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                <p className="text-sm text-slate-400 mt-1">By {selected.submittedBy} · {new Date(selected.createdAt).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">Page: {selected.pageRoute}</p>
              </div>
              <div className="border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{selected.description || "No description"}</p>
              </div>
              {selected.attachmentName && (
                <a href={"/api/feedback/attachments/" + selected.id} className="text-sm text-blue-400 hover:underline" download>
                  📎 {selected.attachmentName}
                </a>
              )}
              {selected.adminNotes && selected.adminNotes.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-300 mb-2">Admin Notes</p>
                  {selected.adminNotes.map((n, i) => (
                    <div key={i} className="text-xs text-slate-400 border-l border-slate-600 pl-3 mb-2">{n}</div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
