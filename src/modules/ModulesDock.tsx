import React from 'react';
import { ArrowUpRight, Clapperboard, Image as ImageIcon, LayoutGrid, PenLine } from 'lucide-react';
import { BRAHMA_MODULES, BrahmaModule, BrahmaModuleIcon, BrahmaModuleId } from './registry';

const MODULE_ICONS: Record<BrahmaModuleIcon, React.ReactNode> = {
  clapperboard: <Clapperboard className="w-5 h-5" />,
  pen: <PenLine className="w-5 h-5" />,
  image: <ImageIcon className="w-5 h-5" />,
};

interface ModulesDockProps {
  onOpen: (id: BrahmaModuleId) => void;
  onOpenHubSettings?: () => void;
}

const ModuleCard: React.FC<{ module: BrahmaModule; onOpen: () => void }> = ({ module, onOpen }) => (
  <button
    onClick={onOpen}
    disabled={!module.available}
    className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all ${
      module.available
        ? 'hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]'
        : 'cursor-not-allowed opacity-60'
    }`}
  >
    <span
      className="absolute inset-x-0 top-0 h-px opacity-60"
      style={{ background: `linear-gradient(90deg, transparent, ${module.accent}, transparent)` }}
    />
    <div className="flex items-start justify-between gap-3">
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center border"
        style={{ backgroundColor: `${module.accent}18`, borderColor: `${module.accent}44`, color: module.accent }}
      >
        {MODULE_ICONS[module.icon]}
      </span>
      {module.available ? (
        <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
      ) : (
        <span className="text-[9px] uppercase tracking-[0.18em] text-amber-300/80 border border-amber-400/25 rounded-full px-2 py-0.5">Phase 3</span>
      )}
    </div>
    <div className="mt-3 text-sm font-semibold text-white">{module.name}</div>
    <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mt-0.5">{module.tagline}</div>
    <p className="mt-2 text-[11px] leading-relaxed text-gray-400 line-clamp-2">{module.description}</p>
    {module.requiresHub && (
      <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-emerald-300/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Uses Brahma Hub
      </span>
    )}
  </button>
);

export const ModulesDock: React.FC<ModulesDockProps> = ({ onOpen, onOpenHubSettings }) => (
  <section id="brahma-modules" className="launch-dock rounded-3xl p-5">
    <div className="flex items-center justify-between px-2 mb-4">
      <span className="text-[11px] font-display uppercase tracking-[0.25em] text-gray-400 font-semibold flex items-center gap-2">
        <LayoutGrid className="w-3.5 h-3.5 text-jarvis-accent" />
        Modules
      </span>
      {onOpenHubSettings ? (
        <button
          onClick={onOpenHubSettings}
          className="text-[10px] text-gray-500 hover:text-jarvis-accent transition-colors"
        >
          Hub settings
        </button>
      ) : (
        <span className="text-[10px] text-gray-500 font-mono">{BRAHMA_MODULES.length} apps</span>
      )}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {BRAHMA_MODULES.map((module) => (
        <ModuleCard key={module.id} module={module} onOpen={() => onOpen(module.id)} />
      ))}
    </div>
  </section>
);
