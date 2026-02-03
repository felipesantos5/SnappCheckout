import { ChartNoAxesCombined, User, ChartColumnIncreasing, Moon, Sun, Settings, FlaskConical, Wallet, Receipt } from "lucide-react";
import logo from "../assets/logo.png";
import logoWhite from "../assets/logo-white.png";
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
  useSidebar,
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
    title: "Todas as Vendas",
    url: "/all-sales",
    icon: Receipt,
  },
  {
    title: "Pagamentos",
    url: "/payments",
    icon: Wallet,
  },

  {
    title: "Testes A/B",
    url: "/abtests",
    icon: FlaskConical,
  },
  {
    title: "Configurações",
    url: "/settings",
    icon: Settings,
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
  const location = useLocation();

  const { token } = useAuth();
  const { theme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();

  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!token) return;

    const fetchRevenue = async () => {
      try {
        // Busca faturamento total desde 2020 até hoje (sem limite de período)
        const startDate = new Date("2020-01-01").toISOString();
        const endDate = new Date().toISOString();

        const response = await axios.get(`${API_URL}/metrics/overview?startDate=${startDate}&endDate=${endDate}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTotalRevenue(response.data.kpis.totalRevenue || 0);
      } catch (error) {
        console.error("Erro ao carregar faturamento:", error);
      }
    };

    fetchRevenue();
  }, [token]);

  // Fechar a sidebar automaticamente quando a rota muda no mobile
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar>
      <SidebarContent className="justify-between">
        <SidebarGroup>
          <img src={theme === "dark" ? logoWhite : logo} alt="logo" className="mt-10 mb-10 w-36 mx-auto" />

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
                } else if (item.url === "/offers") {
                  // "Ofertas" fica ativo em /offers e qualquer sub-rota de /offers
                  isActive = location.pathname === "/offers" || location.pathname.startsWith("/offers/");
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
