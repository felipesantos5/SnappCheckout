import { ChartNoAxesCombined, ShoppingBasket, User, ChartColumnIncreasing } from "lucide-react";
import logo from "../assets/logo.png";

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

// Menu items.
const items = [
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
  {
    title: "DashBoard",
    url: "/",
    icon: ChartColumnIncreasing,
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 rounded-full p-0 justify-start">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium leading-none">{user?.name}</p>
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

        {/* 3. O Botão de Logout */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            logout(); // 4. Chame a função de logout do contexto
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

  return (
    <Sidebar>
      <SidebarContent className="justify-between">
        <SidebarGroup>
          <img src={logo} alt="logo" className="mt-12 mb-10 w-36" />
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

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
        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
