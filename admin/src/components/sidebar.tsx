import { ChartNoAxesCombined, ShoppingBasket, User, ChartColumnIncreasing, Moon, Sun } from "lucide-react";
import logo from "../assets/logo.png";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { RevenueCard } from "./RevenueCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { getShortName } from "@/helper/shortName";
import { Link, useLocation } from "react-router-dom";

// Menu items.
const items = [
  {
    title: "DashBoard",
    url: "/",
    icon: ChartColumnIncreasing,
  },
  {
    title: "Ofertas",
    url: "/offers",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Criar Oferta",
    url: "/offers/new",
    icon: ShoppingBasket,
  },
];

// const approvalItems = [
//   {
//     title: "Usuários",
//     url: "/pending-users-approvals",
//     icon: Users,
//   },
//   {
//     title: "Leilões",
//     url: "/pending-auctions-approvals",
//     icon: Gavel,
//   },
// ];

function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 rounded-full p-0 justify-start">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium leading-none">{getShortName(user?.name)}</p>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Botão de Dark Mode */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Botão de Logout */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            logout();
          }}
          className="cursor-pointer"
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  // const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const location = useLocation();
  const { token } = useAuth();
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!token) return;

    const fetchRevenue = async () => {
      try {
        const response = await axios.get(`${API_URL}/metrics/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTotalRevenue(response.data.kpis.totalRevenue || 0);
      } catch (error) {
        console.error("Erro ao carregar faturamento:", error);
      }
    };

    fetchRevenue();
  }, [token]);

  return (
    <Sidebar>
      <SidebarContent className="justify-between">
        <SidebarGroup>
          <img src={logo} alt="logo" className="mt-10 mb-10 w-36 mx-auto" />

          {/* Revenue Card */}
          <div className="px-2 mb-6">
            <RevenueCard currentRevenue={totalRevenue} goalRevenue={10000000} />
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                // Lógica de active state
                let isActive = false;

                if (item.url === "/") {
                  // Dashboard só fica ativo na rota exata "/"
                  isActive = location.pathname === "/";
                } else if (item.url === "/offers/new") {
                  // "Criar Oferta" fica ativo em /offers/new e /offers/new/*
                  isActive = location.pathname === "/offers/new" || location.pathname.startsWith("/offers/new/");
                } else if (item.url === "/offers") {
                  // "Ofertas" fica ativo em /offers e /offers/:id (mas não em /offers/new)
                  isActive =
                    location.pathname === "/offers" || (location.pathname.startsWith("/offers/") && !location.pathname.startsWith("/offers/new"));
                } else {
                  // Para outras rotas, usa match exato ou startsWith
                  isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setIsApprovalOpen(!isApprovalOpen)} className="cursor-pointer">
                  <ListChecks />
                  <span>Aprovações</span>
                  <ChevronDown className={`ml-auto transition-transform duration-200 ${isApprovalOpen ? "rotate-180" : ""}`} />
                </SidebarMenuButton>

                {isApprovalOpen && (
                  <SidebarMenuSub>
                    {approvalItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <a href={subItem.url}>
                            <subItem.icon />
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem> */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarFooter className="mb-1">
          <UserMenu />
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
