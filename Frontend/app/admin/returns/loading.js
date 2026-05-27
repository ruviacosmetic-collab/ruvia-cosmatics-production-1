"use client";

export default function LoadingAdminReturns() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-brand-dark/10 rounded-md animate-pulse" />
      <div className="bg-white rounded-xl border border-brand-dark/10 shadow-sm p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-brand-dark/5 rounded-md animate-pulse" />
        ))}
      </div>
    </div>
  );
}

