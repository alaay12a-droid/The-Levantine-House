import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useDashboardMe, useDashboardLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getDashboardMeQueryKey } from "@workspace/api-client-react";
import { LayoutDashboard, ListOrdered, LogOut, Loader2, Menu, Users, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

function SidebarContent({ currentLocation, onNavigate }: { currentLocation: string, onNavigate?: () => void }) {
  const { mutate: logout } = useDashboardLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getDashboardMeQueryKey() });
        setLocation("/login");
      }
    });
  };

  const navItems = [
    { href: "/", label: "الرئيسية", icon: LayoutDashboard },
    { href: "/orders", label: "الطلبات", icon: ListOrdered },
    { href: "/drivers", label: "المناديب", icon: Users },
    { href: "/menu", label: "القائمة", icon: UtensilsCrossed },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            ر
          </div>
          <span className="text-xl font-bold tracking-tight">روابي المندي</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {navItems.map((item) => {
            const isActive = currentLocation === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <div
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:text-primary ${
                    isActive ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto p-4 border-t">
        <Button variant="outline" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useDashboardMe({
    query: {
      retry: false,
      queryKey: getDashboardMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      setLocation("/login");
    }
  }, [isLoading, isError, user, setLocation]);

  if (isLoading || isError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-l bg-card md:block">
        <SidebarContent currentLocation={location} />
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col p-0">
              <SidebarContent currentLocation={location} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 font-semibold text-primary">
            <span className="text-lg font-bold tracking-tight">روابي المندي</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 lg:p-8 bg-background overflow-auto">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
