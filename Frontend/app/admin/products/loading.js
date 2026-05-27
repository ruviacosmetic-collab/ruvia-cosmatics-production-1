"use client";

export default function LoadingAdminProducts() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-56 bg-brand-dark/10 rounded-md animate-pulse" />
        <div className="h-10 w-32 bg-brand-dark/10 rounded-md animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-brand-dark/10 p-6 shadow-sm">
            <div className="h-5 w-40 bg-brand-dark/10 rounded animate-pulse mb-4" />
            <div className="h-4 w-28 bg-brand-dark/10 rounded animate-pulse mb-2" />
            <div className="h-28 bg-brand-dark/5 rounded-lg animate-pulse mt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

