"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAdmin, AdminProvider } from "../../context/AdminContext";
import { LayoutDashboard, Package, ShoppingCart, MessageSquare, LogOut, Menu, X } from "lucide-react";

function AdminLayoutContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { adminLogout, isAuthenticated, loading } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Only redirect to login if we are not authenticated AND not already on the login page
    if (!loading && !isAuthenticated && pathname !== '/admin/login') {
      router.push("/admin/login");
    }
  }, [isAuthenticated, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="text-brand-dark">Loading...</div>
      </div>
    );
  }

  // If the user is on the login page, just render the login page without the sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // For all other admin routes, if not authenticated, don't render the sidebar
  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    adminLogout();
    router.push("/admin/login");
  };

  const navItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/products", icon: Package, label: "Products" },
    { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
    { href: "/admin/returns", icon: MessageSquare, label: "Returns" },
    { href: "/admin/reviews", icon: MessageSquare, label: "Reviews" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-white rounded-lg shadow-md border border-brand-dark/10"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-brand-dark/10 z-40 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-brand-dark/10">
          <h1 className="font-serif text-2xl font-bold text-brand-dark">Admin Portal</h1>
          <p className="text-sm text-brand-dark/60 mt-1">Ruvia Cosmetics</p>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-brand-dark hover:bg-brand-pink/10 hover:text-brand-pink transition-colors"
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-brand-dark/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminProvider>
  );
}
