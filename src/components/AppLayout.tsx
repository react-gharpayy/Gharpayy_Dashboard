import { ReactNode, useState } from 'react';
import AppSidebar from './AppSidebar';
import { Bell, Search, Menu } from 'lucide-react';

export interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const AppLayout = ({ children, title, subtitle, actions }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[240px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} className="text-foreground" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg md:text-xl text-foreground truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {actions}
            <div className="relative hidden md:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search leads..."
                className="pl-9 pr-4 py-2 text-sm rounded-lg bg-secondary border-0 outline-none focus:ring-2 focus:ring-primary/30 w-[200px] lg:w-[240px] text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button className="relative p-2 rounded-lg bg-secondary hover:bg-muted transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
