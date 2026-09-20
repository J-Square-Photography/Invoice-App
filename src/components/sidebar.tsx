'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  Bell,
  UserCog,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Clients', href: '/admin/clients', icon: Users },
  { name: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { name: 'Invoices', href: '/admin/invoices', icon: FileText },
  { name: 'Contracts', href: '/admin/contracts', icon: FileSignature },
  { name: 'Alerts', href: '/admin/alerts', icon: Bell },
];

const adminNavigation = [
  { name: 'Team', href: '/admin/team', icon: UserCog },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 p-1.5 shrink-0">
          <img src="/logo-white.png" alt="J Square" className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-sm font-semibold">J Square Photography</p>
          <p className="text-xs text-neutral-500">CRM</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Menu
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}

        {/* Admin-only section */}
        {(!user || user.role === 'SUPER_ADMIN') && (
          <>
            <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Administration
            </p>
            {adminNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User info & Logout */}
      <div className="border-t border-neutral-200 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          </div>
        ) : user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-neutral-500">{user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Manager'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
