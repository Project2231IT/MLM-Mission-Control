"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: string;
  title?: string;
  description: string;
  variant?: "default" | "destructive";
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((opts: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...opts, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border px-4 py-3 shadow-lg text-sm animate-in slide-in-from-right-1",
              t.variant === "destructive"
                ? "border-red-500/50 bg-red-900/90 text-red-200"
                : "border-slate-600 bg-slate-800 text-slate-100"
            )}
          >
            {t.title && <div className="font-semibold mb-0.5">{t.title}</div>}
            <div>{t.description}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}
