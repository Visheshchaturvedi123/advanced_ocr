import React, { useState, useMemo } from 'react';
import {
  Image as ImageIcon,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Database,
  Copy,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { ImageItem } from '../types';
import { hubAssetUrl } from '../utils/hubApi';

interface GalleryPageProps {
  items: ImageItem[];
  onOpenPreviewItem: (item: ImageItem) => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({
  items,
  onOpenPreviewItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.relativePath.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, statusFilter]);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getStatusBadge = (status: ImageItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'cached':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs">
            <Database className="w-3 h-3 text-amber-600" />
            Cached
          </span>
        );
      case 'skipped':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded">
            <Copy className="w-3 h-3 text-slate-500" />
            Duplicate
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-100/90 border border-rose-300 px-1.5 py-0.5 rounded shadow-2xs">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-800 bg-blue-100/90 border border-blue-300 px-1.5 py-0.5 rounded animate-pulse">
            Processing
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-white/90 border border-slate-300 px-1.5 py-0.5 rounded">
            <Clock className="w-3 h-3 text-slate-400" />
            Pending
          </span>
        );
    }
  };

  return (
    <div id="gallery-browser-view" className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Top Bar with Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Image Browser ({items.length.toLocaleString()} items)
            </h2>
            <p className="text-xs text-slate-500">
              High-resolution thumbnails with instant preview inspection
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cached">Cached</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Grid of Images */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-2 shadow-xs">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500">
            {items.length === 0
              ? 'No images loaded. Import or scan a folder in the Optimize tab first.'
              : 'No images match the current filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredItems.slice(0, 100).map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-emerald-400 hover:shadow-sm transition-all group flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative h-36 bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-100">
                <img
                  src={hubAssetUrl(`/api/thumbnail?path=${encodeURIComponent(item.fullPath)}&size=256`)}
                  alt={item.filename}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                <div className="absolute top-2 left-2">
                  {getStatusBadge(item.status)}
                </div>

                <button
                  onClick={() => onOpenPreviewItem(item)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-emerald-700 border border-slate-200 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Compare Side-by-Side"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Meta information */}
              <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                <div>
                  <div
                    className="font-medium text-xs text-slate-800 truncate"
                    title={item.filename}
                  >
                    {item.filename}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate" title={item.relativePath}>
                    {item.relativePath}
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{formatSize(item.sizeBytes)}</span>
                  <span>
                    {item.width && item.height ? `${item.width}×${item.height}` : item.extension.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
