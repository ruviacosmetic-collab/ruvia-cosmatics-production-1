"use client";

export default function LoadingOrders() {
  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#FDFBF7] font-sans">
      <div className="container mx-auto px-4 md:px-12 max-w-6xl">
        <div className="h-10 w-56 bg-brand-dark/10 rounded-md animate-pulse mb-6" />
        <div className="h-4 w-72 bg-brand-dark/10 rounded-md animate-pulse mb-10" />

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-brand-dark/10 p-6 shadow-sm">
              <div className="flex justify-between gap-4">
                <div className="space-y-3 w-full">
                  <div className="h-4 w-40 bg-brand-dark/10 rounded animate-pulse" />
                  <div className="h-4 w-64 bg-brand-dark/10 rounded animate-pulse" />
                </div>
                <div className="h-9 w-28 bg-brand-dark/10 rounded-md animate-pulse" />
              </div>
              <div className="h-24 bg-brand-dark/5 rounded-lg animate-pulse mt-5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

