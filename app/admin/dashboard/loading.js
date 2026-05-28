"use client";

export default function LoadingAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-brand-dark/10 rounded-md animate-pulse" />
        <div className="h-4 w-64 bg-brand-dark/10 rounded-md animate-pulse mt-3" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-brand-dark/10 p-6">
            <div className="h-4 w-24 bg-brand-dark/10 rounded animate-pulse mb-4" />
            <div className="h-8 w-32 bg-brand-dark/10 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
          <div className="h-5 w-40 bg-brand-dark/10 rounded animate-pulse mb-3" />
          <div className="h-80 bg-brand-dark/5 rounded-lg animate-pulse" />
        </div>
        <div className="xl:col-span-4 grid grid-cols-1 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
            <div className="h-5 w-32 bg-brand-dark/10 rounded animate-pulse mb-3" />
            <div className="h-64 bg-brand-dark/5 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-brand-dark/10 p-6">
            <div className="h-5 w-32 bg-brand-dark/10 rounded animate-pulse mb-3" />
            <div className="h-56 bg-brand-dark/5 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

