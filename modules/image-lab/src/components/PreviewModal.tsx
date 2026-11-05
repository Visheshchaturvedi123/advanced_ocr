import React, { useState, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { PreviewComparison } from '../types';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PreviewComparison | null;
  isLoading: boolean;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  data,
  isLoading,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="preview-comparison-modal"
        className="bg-white border border-slate-200 w-full max-w-6xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                Side-by-Side Quality Preview
                {data && (
                  <span className="text-xs font-normal text-slate-500">
                    ({data.original.filename})
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500">
                Inspect visual fidelity, downsampling sharpness, and byte reduction before batch encoding
              </p>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200 text-slate-700 text-xs shadow-2xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 hover:bg-slate-200 rounded transition-colors font-mono"
                title="Reset to 100%"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Fit to Screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Canvas Area: Split Screen */}
        <div
          className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden bg-slate-100 select-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isLoading ? (
            <div className="col-span-2 flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm">Encoding sample image with target settings...</p>
            </div>
          ) : !data ? (
            <div className="col-span-2 flex items-center justify-center text-slate-400 text-sm">
              No preview data available.
            </div>
          ) : (
            <>
              {/* ORIGINAL Pane */}
              <div className="flex flex-col h-full relative overflow-hidden bg-slate-50">
                <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
                  ORIGINAL ({data.original.format})
                </div>
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                  <img
                    src={data.original.url}
                    alt="Original Preview"
                    className="max-w-none transition-transform pointer-events-none origin-center"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                      maxHeight: zoomLevel === 1 ? '70vh' : 'none',
                      maxWidth: zoomLevel === 1 ? '90%' : 'none',
                      objectFit: 'contain',
                    }}
                  />
                </div>
                {/* Stats Bar */}
                <div className="p-3 bg-white border-t border-slate-200 text-xs flex items-center justify-between text-slate-700 shrink-0">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900">
                      {data.original.width} × {data.original.height} px
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatSize(data.original.sizeBytes)}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Source File
                  </span>
                </div>
              </div>

              {/* OPTIMIZED Pane */}
              <div className="flex flex-col h-full relative overflow-hidden bg-slate-50">
                <div className="absolute top-3 left-3 z-10 bg-emerald-50 backdrop-blur-xs px-2.5 py-1 rounded-md border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  OPTIMIZED (WebP Quality: {data.optimized.quality}%)
                </div>
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                  <img
                    src={data.optimized.url}
                    alt="Optimized WebP Preview"
                    className="max-w-none transition-transform pointer-events-none origin-center"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                      maxHeight: zoomLevel === 1 ? '70vh' : 'none',
                      maxWidth: zoomLevel === 1 ? '90%' : 'none',
                      objectFit: 'contain',
                    }}
                  />
                </div>
                {/* Stats Bar */}
                <div className="p-3 bg-white border-t border-slate-200 text-xs flex items-center justify-between text-slate-700 shrink-0">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-emerald-700">
                      {data.optimized.width} × {data.optimized.height} px
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatSize(data.optimized.sizeBytes)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                      -{data.optimized.reductionPercent}% Reduction
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Summary */}
        {data && (
          <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-3 text-slate-500 text-[11px]">
              <span>Tip: Click and drag to pan both viewports simultaneously</span>
              <span>•</span>
              <span>Downsampled via Lanczos3</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-2xs"
            >
              Close Preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
