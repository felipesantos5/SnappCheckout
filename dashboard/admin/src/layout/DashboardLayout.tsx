// src/pages/dashboard/DashboardLayout.tsx
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";

// O Layout Principal
export function DashboardLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <SidebarProvider className="">
        <AppSidebar />
        {/* 2. Conteúdo da Página */}
        <SidebarTrigger />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarProvider>
    </div>
  );
}
