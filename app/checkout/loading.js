"use client";

export default function LoadingCheckout() {
  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#FDFBF7]">
      <div className="container mx-auto px-4 md:px-12 max-w-6xl">
        <div className="h-10 w-56 bg-brand-dark/10 rounded-md animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white rounded-xl border border-brand-dark/10 p-6 shadow-sm">
            <div className="h-6 w-40 bg-brand-dark/10 rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-brand-dark/5 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 bg-white rounded-xl border border-brand-dark/10 p-6 shadow-sm">
            <div className="h-6 w-40 bg-brand-dark/10 rounded animate-pulse mb-6" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-brand-dark/10 rounded animate-pulse" />
              ))}
              <div className="h-12 bg-brand-dark/10 rounded-lg animate-pulse mt-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

