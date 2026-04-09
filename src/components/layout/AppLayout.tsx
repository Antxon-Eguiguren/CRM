import { Outlet } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Separator } from '@/components/ui/separator';

export function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-6" />
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
