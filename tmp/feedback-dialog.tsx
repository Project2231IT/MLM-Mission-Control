"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type Category = "bug" | "feature" | "note";

interface FeedbackDialogProps {
  pageRoute?: string;
}

export default function FeedbackButton({ pageRoute = "/" }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const MAX_DESC = 4000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("pageRoute", pageRoute);
      if (file) formData.append("attachment", file);

      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error ?? "Submit failed", variant: "destructive" });
        return;
      }

      toast({ title: "Feedback submitted", description: "Thank you — we'll review it shortly." });
      setOpen(false);
      setTitle("");
      setDescription("");
      setFile(null);
      setCategory("bug");
    } catch {
      toast({ title: "Error", description: "Network error. Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="fixed bottom-6 right-6 rounded-full shadow-lg gap-2"
          size="sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
        </DialogHeader>
        <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bug">🐛 Bug</TabsTrigger>
            <TabsTrigger value="feature">✨ Feature</TabsTrigger>
            <TabsTrigger value="note">📝 Note</TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={
                  category === "bug"
                    ? "e.g. Performance page shows wrong vendor"
                    : category === "feature"
                    ? "e.g. Add export to CSV"
                    : "e.g. Login page suggestion"
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="description">
                Description{" "}
                <span className="text-xs text-slate-400">({description.length}/{MAX_DESC})</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_DESC}
                rows={5}
                placeholder="Describe what happened, what you expected, and steps to reproduce..."
                required
              />
            </div>
            <div>
              <Label htmlFor="attachment">Attachment (optional, max 5 MB)</Label>
              <Input
                id="attachment"
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.csv,.xlsx,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
