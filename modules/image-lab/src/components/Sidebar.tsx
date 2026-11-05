import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Image as ImageIcon,
  History,
  Database,
  Gauge,
  Settings,
  FolderSync,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'optimize'
  | 'gallery'
  | 'benchmark'
  | 'cache'
  | 'history'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isProcessing: boolean;
  totalImagesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isProcessing,
  totalImagesCount,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'optimize' as NavTab,
      label: 'Optimize',
      icon: Zap,
      badge: isProcessing ? 'ACTIVE' : undefined,
      badgeColor: 'bg-emerald-600 text-white font-bold animate-pulse',
    },
    {
      id: 'gallery' as NavTab,
      label: 'Image Browser',
      icon: ImageIcon,
      count: totalImagesCount > 0 ? totalImagesCount : undefined,
    },
    { id: 'benchmark' as NavTab, label: 'Benchmark', icon: Gauge },
    { id: 'cache' as NavTab, label: 'Cache & Disk', icon: Database },
    { id: 'history' as NavTab, label: 'Job History', icon: History },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      id="app-sidebar"
      className="w-56 bg-white border-r border-slate-200 flex flex-col justify-between select-none shrink-0"
    >
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}

              {item.count !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                  {item.count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer information */}
      <div className="p-3 border-t border-slate-200">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-800 font-semibold">
            <span className="flex items-center gap-1.5">
              <FolderSync className="w-3.5 h-3.5 text-emerald-600" />
              Engine Status
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
              ONLINE
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            libwebp 1.6 / Lanczos3 Resizer / CPU-Only Mode
          </p>
        </div>
      </div>
    </aside>
  );
};
