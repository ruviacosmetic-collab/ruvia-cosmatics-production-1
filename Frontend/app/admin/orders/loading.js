"use client";

export default function LoadingAdminOrders() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-48 bg-brand-dark/10 rounded-md animate-pulse" />
        <div className="h-10 w-56 bg-brand-dark/10 rounded-md animate-pulse" />
      </div>

      <div className="bg-white rounded-xl border border-brand-dark/10 shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-brand-dark/5 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

