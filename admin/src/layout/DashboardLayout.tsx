// src/pages/dashboard/DashboardLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";

// O Layout Principal
export function DashboardLayout() {
  const location = useLocation();
  const isAllSalesPage = location.pathname === "/all-sales";

  return (
    <div className="flex min-h-screen w-full flex-col">
      <SidebarProvider className="">
        <AppSidebar />
        {/* 2. Conteúdo da Página */}
        <SidebarTrigger className="fixed top-3 left-3 z-50 md:relative md:top-0 md:left-0" />
        <main
          className={`flex-1 overflow-x-hidden p-1.5 pt-14 sm:p-4 md:p-8 md:pt-12 ${isAllSalesPage ? "pl-0!" : ""}`}
        >
          <Outlet />
        </main>
      </SidebarProvider>
    </div>
  );
}
