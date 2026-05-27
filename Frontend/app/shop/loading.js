"use client";

export default function LoadingShop() {
  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#FDFBF7]">
      <div className="container mx-auto px-4 md:px-12">
        <div className="h-10 w-56 bg-brand-dark/10 rounded-md animate-pulse mb-6" />
        <div className="h-4 w-80 bg-brand-dark/10 rounded-md animate-pulse mb-10" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-brand-dark/10 p-4 shadow-sm">
              <div className="h-44 bg-brand-dark/5 rounded-lg animate-pulse mb-4" />
              <div className="h-4 w-3/4 bg-brand-dark/10 rounded animate-pulse mb-2" />
              <div className="h-4 w-1/2 bg-brand-dark/10 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

