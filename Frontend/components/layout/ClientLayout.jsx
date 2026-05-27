"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import CartCanvas from "../cart/CartCanvas";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/auth");
  const isAdminPage = pathname.startsWith("/admin");
  const hideCustomerUI = isAuthPage || isAdminPage;

  return (
    <>
      <div className="grain" />
      {!hideCustomerUI && <Header />}
      <main className="flex-grow">{children}</main>
      {!hideCustomerUI && <Footer />}
      {!isAdminPage && <CartCanvas />}
    </>
  );
}
