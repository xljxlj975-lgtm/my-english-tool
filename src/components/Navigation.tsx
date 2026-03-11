'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const desktopNavItems = [
  { href: '/', label: '首页' },
  { href: '/review', label: '复习' },
  { href: '/add', label: '添加' },
  { href: '/library', label: '题库' },
  { href: '/calendar', label: '日历' },
  { href: '/settings', label: '设置' },
];

const mobileNavItems = [
  {
    href: '/',
    label: '首页',
    icon: (
      <path
        d="M3 10.75 12 3l9 7.75v9.25a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
  },
  {
    href: '/review',
    label: '复习',
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 13h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </>
    ),
  },
  {
    href: '/add',
    label: '添加',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </>
    ),
  },
  {
    href: '/library',
    label: '题库',
    icon: (
      <>
        <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v18H7.5A2.5 2.5 0 0 0 5 23z" transform="scale(1 .913)" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 7.5h7M8 11h7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </>
    ),
  },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden border-b bg-white/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <Link href="/" className="py-4 text-sm font-semibold text-slate-900">
            English Review
          </Link>
          <div className="flex gap-6">
            {desktopNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/96 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
