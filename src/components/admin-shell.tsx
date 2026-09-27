'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  ClipboardList,
  Wallet,
  FileSignature,
  Bell,
  UserCog,
  Settings,
  LogOut,
  Loader2,
  Menu,
  X,
  Shield,
  ShieldCheck,
  Search,
  Briefcase,
  Clock,
  Banknote,
  ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoToggle } from '@/components/logo-toggle';
import { GlobalSearch } from '@/components/global-search';
import { AppearanceButton } from '@/components/appearance-dialog';
import type { PermissionKey } from '@/lib/permissions';

// `permission: null` means always visible to any signed-in account (just the Dashboard landing page).
const navigation: Array<{ name: string; href: string; icon: typeof LayoutDashboard; permission: PermissionKey | null }> = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: null },
  { name: 'Clients', href: '/admin/clients', icon: Users, permission: 'clients' },
  { name: 'Projects', href: '/admin/projects', icon: FolderKanban, permission: 'projects' },
  { name: 'Quotes', href: '/admin/quotes', icon: ClipboardList, permission: 'quotes' },
  { name: 'Invoices', href: '/admin/invoices', icon: FileText, permission: 'invoices' },
  { name: 'Payments', href: '/admin/payments', icon: Wallet, permission: 'payments' },
  { name: 'Contracts', href: '/admin/contracts', icon: FileSignature, permission: 'contracts' },
  { name: 'Alerts', href: '/admin/alerts', icon: Bell, permission: 'alerts' },
];

function adminNavItems(showSettings: boolean, showTeam: boolean) {
  const items: Array<{ name: string; href: string; icon: typeof Settings; developerOnly: boolean }> = [];
  if (showSettings) items.push({ name: 'Settings', href: '/admin/settings', icon: Settings, developerOnly: false });
  if (showTeam) items.push({ name: 'Team', href: '/admin/team', icon: UserCog, developerOnly: true });
  if (showTeam) items.push({ name: 'Logs', href: '/admin/logs', icon: ScrollText, developerOnly: true });
  return items;
}

// Part-timer/freelancer profiles, job allocation and payslips - its own sidebar section since it's
// a distinct area of the app from client/billing work, gated by the single 'staff' permission.
const staffNavigation = [
  { name: 'Staff', href: '/admin/staff', icon: Briefcase },
  { name: 'Timesheets', href: '/admin/timesheets', icon: Clock },
  { name: 'Payslips', href: '/admin/payslips', icon: Banknote },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, logout, can } = useAuth();
  const visibleNav = navigation.filter((item) => item.permission === null || can(item.permission));
  const showTeam = user?.role === 'SUPER_ADMIN';
  const showSettings = can('settings');
  const showStaff = can('staff');

  // Close mobile drawer automatically when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Ctrl+K / Cmd+K, or "/" outside a text field, opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* 1. DESKTOP SIDEBAR (Visible on md screens and up) */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r border-neutral-200 bg-white shrink-0">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-6">
          <LogoToggle className="h-9 w-9 p-1.5" />
          <div>
            <p className="text-sm font-semibold text-neutral-900">J Square Photography</p>
            <p className="text-xs text-neutral-500">CRM</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="rounded border border-neutral-300 bg-white px-1.5 text-[10px] font-medium text-neutral-500">Ctrl K</kbd>
          </button>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Menu
          </p>
          {visibleNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}

          {/* Staff Management Section */}
          {showStaff && (
            <>
              <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Staff Management
              </p>
              {staffNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-neutral-100 text-neutral-900 font-semibold'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}

          {/* Admin Section */}
          {(showTeam || showSettings) && (
            <>
              <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Administration
              </p>
              {adminNavItems(showSettings, showTeam).map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-neutral-100 text-neutral-900 font-semibold'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </div>
                    {item.developerOnly && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                        Developer
                      </span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-neutral-200 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          ) : user ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="truncate text-sm font-medium text-neutral-900">{user.name}</p>
                <p className="truncate text-xs text-neutral-500">
                  {user.role === 'SUPER_ADMIN' ? 'Developer' : 'Manager'}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <AppearanceButton />
                <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY & PANEL (md:hidden) */}
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer Header with Close Button */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-5">
          <div className="flex items-center gap-3">
            <LogoToggle className="h-8 w-8 p-1.5" />
            <div>
              <p className="text-sm font-bold text-neutral-900">J Square CRM</p>
              <p className="text-[11px] text-neutral-500">Studio Management</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="h-8 w-8 rounded-lg"
          >
            <X className="h-5 w-5 text-neutral-600" />
          </Button>
        </div>

        {/* Drawer Navigation Links */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Navigation
          </p>
          {visibleNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}

          {/* Staff Management Section */}
          {showStaff && (
            <>
              <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Staff Management
              </p>
              {staffNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                        : 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}

          {/* Admin Section */}
          {(showTeam || showSettings) && (
            <>
              <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Administration
              </p>
              {adminNavItems(showSettings, showTeam).map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                        : 'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </div>
                    {item.developerOnly && (
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
                          isActive
                            ? 'bg-neutral-800 text-neutral-200'
                            : 'bg-neutral-100 text-neutral-600'
                        )}
                      >
                        Developer
                      </span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Drawer Footer / User */}
        <div className="border-t border-neutral-200 p-4 bg-neutral-50/50">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          ) : user ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="truncate text-sm font-semibold text-neutral-900">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {user.role === 'SUPER_ADMIN' ? (
                    <ShieldCheck className="h-3 w-3 text-neutral-600" />
                  ) : (
                    <Shield className="h-3 w-3 text-neutral-600" />
                  )}
                  <p className="truncate text-xs text-neutral-500">
                    {user.role === 'SUPER_ADMIN' ? 'Developer' : 'Manager'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                title="Sign out"
                className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-neutral-200"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. MAIN CONTENT CONTAINER (Full-width on mobile, offset on desktop) */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        {/* Sticky Mobile Top Bar (md:hidden) */}
        <header className="flex md:hidden h-14 w-full items-center justify-between border-b border-neutral-200 bg-white/95 px-3 sticky top-0 z-30 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="h-9 w-9 rounded-lg hover:bg-neutral-100"
            >
              <Menu className="h-5 w-5 text-neutral-800" />
            </Button>
            <div className="flex items-center gap-2">
              <LogoToggle className="h-7 w-7 p-1" />
              <span className="text-sm font-bold text-neutral-900 tracking-tight">J Square</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AppearanceButton className="h-9 w-9 text-neutral-500 hover:text-neutral-900" />
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search" className="h-9 w-9 text-neutral-500 hover:text-neutral-900">
              <Search className="h-4 w-4" />
            </Button>
            {user && (
              <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-2 py-1 rounded-md">
                {user.role === 'SUPER_ADMIN' ? 'Developer' : 'Manager'}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sign out"
              className="h-9 w-9 text-neutral-500 hover:text-neutral-900"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable Page Content with Responsive Padding */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-neutral-50 p-3 sm:p-5 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
