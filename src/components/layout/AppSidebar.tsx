import { NavLink, useMatch } from 'react-router';
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Users,
} from 'lucide-react';
import { AppearanceMenu } from '@/components/layout/AppearanceMenu';
import { useAuth } from '@/lib/auth-context';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Building2, end: true },
  { to: '/contacts', label: 'Contacts', icon: Users, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: true },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: (typeof navItems)[number]) {
  const match = useMatch({ path: to, end });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={!!match} tooltip={label}>
        <NavLink to={to}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <AppearanceMenu
              trigger={
                <SidebarMenuButton tooltip="Theme">
                  <Sun className="size-4 dark:hidden" />
                  <Moon className="hidden size-4 dark:block" />
                  <span>Theme</span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
