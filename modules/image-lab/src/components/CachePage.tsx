import React, { useState, useEffect } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { CacheStats } from '../types';
import { hubFetch } from '../utils/hubApi';

export const CachePage: React.FC = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await hubFetch('/api/cache/stats');
      const data = await res.json();
      setStats(data);
    } catch {
      setFeedback('Error loading cache status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClearUnused = async () => {
    setIsLoading(true);
    try {
      const res = await hubFetch('/api/cache/clear-unused', { method: 'POST' });
      const data = await res.json();
      setFeedback(`Cleaned ${data.removedCount} orphaned cache entries.`);
      fetchStats();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearThumbnails = async () => {
    setIsLoading(true);
    try {
      await hubFetch('/api/cache/clear-thumbnails', { method: 'POST' });
      setFeedback('All UI thumbnail caches cleared.');
      fetchStats();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all persistent optimization fingerprints? Next runs will re-encode existing files.')) {
      return;
    }
    setIsLoading(true);
    try {
      await hubFetch('/api/cache/clear-all', { method: 'POST' });
      setFeedback('Optimization cache database reset.');
      fetchStats();
    } finally {
      setIsLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div id="cache-management-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Persistent Cache &amp; Storage Architecture
              </h2>
              <p className="text-xs text-slate-500">
                Inspect fingerprints, instant re-run hashes, and temporary storage buffers
              </p>
            </div>
          </div>

          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {feedback && (
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-mono text-emerald-800">
            {feedback}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">Cached Optimization Records</span>
            <div className="text-xl font-bold text-amber-800">
              {stats ? stats.totalRecords.toLocaleString() : '--'}
            </div>
            <div className="text-[10px] text-slate-400">
              SHA-256 fingerprint database
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">Optimized WebP Managed</span>
            <div className="text-xl font-bold text-emerald-700">
              {stats ? formatSize(stats.totalOptimizedBytes) : '--'}
            </div>
            <div className="text-[10px] text-slate-400">
              Across tracked outputs
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">UI Thumbnails Cache</span>
            <div className="text-xl font-bold text-blue-700">
              {stats ? formatSize(stats.thumbnailSizeBytes) : '--'}
            </div>
            <div className="text-[10px] text-slate-400">
              {stats?.totalThumbnails || 0} local cached WebP tiles
            </div>
          </div>
        </div>

        {/* Safety Note */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Original files will NEVER be affected or touched by any cache management action.
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleClearUnused}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-2xs"
          >
            Clear Unused / Orphaned Records
          </button>
          <button
            onClick={handleClearThumbnails}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-2xs"
          >
            Clear Thumbnail Cache
          </button>
          <button
            onClick={handleClearAll}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Optimization Cache
          </button>
        </div>
      </div>
    </div>
  );
};
