import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardPage } from './components/DashboardPage';
import { OptimizePage } from './components/OptimizePage';
import { GalleryPage } from './components/GalleryPage';
import { BenchmarkPage } from './components/BenchmarkPage';
import { CachePage } from './components/CachePage';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';
import { SafetyModal } from './components/SafetyModal';
import { PreviewModal } from './components/PreviewModal';
import { ReportModal } from './components/ReportModal';
import { ProgressView } from './components/ProgressView';
import { FolderImportModal } from './components/FolderImportModal';
import { downloadOptimizedZip, onZipDownloadStatus, ZipDownloadStatus } from './utils/zipDownloader';
import { hubFetch } from './utils/hubApi';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  OptimizationSettings,
  FolderAnalysisSummary,
  OptimizationEstimate,
  ImageItem,
  JobProgress,
  JobReport,
  SystemStatus,
  PreviewComparison,
} from './types';

const DEFAULT_SETTINGS: OptimizationSettings = {
  mode: 'high_quality',
  resolutionMode: '75%',
  customResolutionPercent: 75,
  maxDimensionMode: '2880',
  customMaxDimension: 2880,
  webpQuality: 90,
  lossless: false,
  smartQuality: true,
  validationLevel: 'smart',
  metadataPolicy: 'preserve_useful',
  colorManagement: 'preserve_icc',
  workerCount: 'auto',
  memoryMode: '8gb',
  outputStructure: 'preserve',
  duplicateHandling: 'skip',
  allowUpscaling: false,
  recursiveScan: true,
  autoDownloadZip: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [inputFolder, setInputFolder] = useState<string>('./sample_photos');
  const [outputFolder, setOutputFolder] = useState<string>('./optimized_webp');
  const [settings, setSettings] = useState<OptimizationSettings>(DEFAULT_SETTINGS);

  const [summary, setSummary] = useState<FolderAnalysisSummary | null>(null);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [estimate, setEstimate] = useState<OptimizationEstimate | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [activeReportModal, setActiveReportModal] = useState<JobReport | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobReport[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewModalData, setPreviewModalData] = useState<PreviewComparison | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // Folder Import modal state
  const [importState, setImportState] = useState<{
    isOpen: boolean;
    folderName: string;
    processedCount: number;
    totalCount: number;
    isCompleted: boolean;
    error: string | null;
  }>({
    isOpen: false,
    folderName: '',
    processedCount: 0,
    totalCount: 0,
    isCompleted: false,
    error: null,
  });

  // ZIP Download Status
  const [zipStatus, setZipStatus] = useState<ZipDownloadStatus>({
    state: 'idle',
    message: '',
  });

  useEffect(() => {
    const unsubscribe = onZipDownloadStatus((status) => {
      setZipStatus(status);
      if (status.state === 'success') {
        const timer = setTimeout(() => {
          setZipStatus((curr) => (curr.state === 'success' ? { state: 'idle', message: '' } : curr));
        }, 5000);
        return () => clearTimeout(timer);
      }
    });
    return unsubscribe;
  }, []);

  const progressPollRef = useRef<NodeJS.Timeout | null>(null);
  const downloadedJobsRef = useRef<Set<string>>(new Set());

  // 1. Fetch system status & history on initial load
  const fetchStatusAndHistory = async () => {
    try {
      const [sysRes, histRes] = await Promise.all([
        hubFetch('/api/system/status'),
        hubFetch('/api/history'),
      ]);
      if (sysRes.ok) setSystemStatus(await sysRes.json());
      if (histRes.ok) {
        const histData = await histRes.json();
        setRecentJobs(histData.history || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatusAndHistory();
    const interval = setInterval(fetchStatusAndHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. Scan Folder Handler
  const handleScanFolder = async (folderToScan = inputFolder) => {
    if (!folderToScan) return;
    setIsScanning(true);
    try {
      const res = await hubFetch('/api/folders/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folderToScan,
          recursive: settings.recursiveScan,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Scan failed');
      }
      const data = await res.json();
      setSummary(data.summary);
      setItems(data.items);

      // Trigger estimate
      fetchEstimate(data.items, settings);
    } catch (e: any) {
      alert(`Folder Scan Error: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Estimate Output Calculation
  const fetchEstimate = async (targetItems: ImageItem[], targetSettings: OptimizationSettings) => {
    if (targetItems.length === 0) {
      setEstimate(null);
      return;
    }
    try {
      const res = await hubFetch('/api/optimize/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: targetItems, settings: targetSettings }),
      });
      if (res.ok) {
        const data = await res.json();
        setEstimate(data);
      }
    } catch {}
  };

  // Re-estimate on settings update
  useEffect(() => {
    if (items.length > 0) {
      fetchEstimate(items, settings);
    }
  }, [
    items,
    settings.mode,
    settings.resolutionMode,
    settings.customResolutionPercent,
    settings.maxDimensionMode,
    settings.customMaxDimension,
    settings.webpQuality,
    settings.lossless,
    settings.smartQuality,
  ]);

  // 4. Sample Dataset Generation
  const handleGenerateSample = async (count: number) => {
    try {
      const res = await hubFetch('/api/folders/generate-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDir: inputFolder, count }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setItems(data.items);
        fetchEstimate(data.items, settings);
        setActiveTab('optimize');
      }
    } catch (e: any) {
      alert(`Sample Generation Error: ${e.message}`);
    }
  };

  // 5. Folder Import from User PC (Chunks to guarantee stability)
  const handleImportFolderFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const validExts = /\.(jpe?g|png|webp|tiff?|avif|bmp|gif)$/i;
    const imageFiles = files.filter((f) => validExts.test(f.name));

    if (imageFiles.length === 0) {
      alert('No supported image files (JPG, PNG, WebP, TIFF, AVIF) were found in the selected folder.');
      return;
    }

    const firstRel = imageFiles[0].webkitRelativePath || imageFiles[0].name;
    const rawFolderName = firstRel.includes('/') ? firstRel.split('/')[0] : 'Imported_Folder';
    const folderName = rawFolderName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Imported_Folder';

    setImportState({
      isOpen: true,
      folderName,
      processedCount: 0,
      totalCount: imageFiles.length,
      isCompleted: false,
      error: null,
    });

    const CHUNK_SIZE = 15;
    let targetFolderPath = `./imported_photos/${folderName}`;

    try {
      for (let i = 0; i < imageFiles.length; i += CHUNK_SIZE) {
        const chunk = imageFiles.slice(i, i + CHUNK_SIZE);
        const chunkPaths = chunk.map((f) => f.webkitRelativePath || f.name);

        const formData = new FormData();
        formData.append('folderName', folderName);
        formData.append('paths', JSON.stringify(chunkPaths));
        chunk.forEach((f) => formData.append('files', f));

        const res = await hubFetch('/api/folders/upload-batch', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Upload interrupted at image ${i + 1}`);
        }

        const resData = await res.json();
        if (resData.folderPath) {
          targetFolderPath = resData.folderPath;
        }

        setImportState((prev) => ({
          ...prev,
          processedCount: Math.min(prev.totalCount, i + chunk.length),
        }));
      }

      setImportState((prev) => ({
        ...prev,
        isCompleted: true,
        processedCount: prev.totalCount,
      }));

      setInputFolder(targetFolderPath);
      await handleScanFolder(targetFolderPath);
      setActiveTab('optimize');
    } catch (err: any) {
      setImportState((prev) => ({
        ...prev,
        error: err.message || 'Folder upload interrupted. Check your network or file permissions.',
      }));
    }
  };

  // 6. Preview Generation
  const handleOpenPreviewItem = async (targetItem: ImageItem) => {
    setIsPreviewLoading(true);
    setIsPreviewModalOpen(true);
    try {
      const res = await hubFetch('/api/optimize/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: targetItem, settings }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewModalData(data);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Preview failed');
      }
    } catch (e: any) {
      alert(`Preview Error: ${e.message}`);
      setIsPreviewModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleOpenGeneralPreview = () => {
    if (items.length === 0) return;
    const sample = items.find((i) => !i.isCorrupted) || items[0];
    handleOpenPreviewItem(sample);
  };

  // 7. Real-Time Batch Progress Polling & Automated ZIP Download
  const pollProgress = useCallback(async () => {
    try {
      const res = await hubFetch('/api/optimize/progress');
      if (res.ok) {
        const data = await res.json();
        if (data.progress) {
          setProgress(data.progress);
          if (data.progress.status === 'completed' && data.completedReport) {
            setActiveReportModal(data.completedReport);
            fetchStatusAndHistory();

            // Auto-trigger direct ZIP download to PC
            if (
              settings.autoDownloadZip !== false &&
              !downloadedJobsRef.current.has(data.completedReport.jobId)
            ) {
              downloadedJobsRef.current.add(data.completedReport.jobId);
              downloadOptimizedZip(data.completedReport.jobId);
            }
          }
        }
      }
    } catch {}
  }, [settings.autoDownloadZip]);

  useEffect(() => {
    if (progress && (progress.status === 'running' || progress.status === 'paused')) {
      progressPollRef.current = setInterval(pollProgress, 600);
    } else {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
    }
    return () => {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
    };
  }, [progress?.status, pollProgress]);

  // 8. Batch Actions: Start, Pause, Resume, Cancel
  const handleStartBatch = async () => {
    if (items.length === 0) return;
    try {
      const res = await hubFetch('/api/optimize/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputFolder,
          outputFolder,
          items,
          settings,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start');
      }
      setActiveTab('optimize');
      pollProgress();
    } catch (e: any) {
      alert(`Optimization Launch Error: ${e.message}`);
    }
  };

  const handlePause = async () => {
    await hubFetch('/api/optimize/pause', { method: 'POST' });
    pollProgress();
  };

  const handleResume = async () => {
    await hubFetch('/api/optimize/resume', { method: 'POST' });
    pollProgress();
  };

  const handleCancel = async () => {
    if (window.confirm('Cancel the active batch optimization? Any completed WebP files will remain saved.')) {
      await hubFetch('/api/optimize/cancel', { method: 'POST' });
      pollProgress();
    }
  };

  const handleClearHistory = async () => {
    await hubFetch('/api/history', { method: 'DELETE' });
    setRecentJobs([]);
  };

  const isProcessing = Boolean(
    progress && (progress.status === 'running' || progress.status === 'paused')
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* TitleBar */}
      <TitleBar systemStatus={systemStatus} />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isProcessing={isProcessing}
          totalImagesCount={items.length}
        />

        {/* Dynamic Content Pane */}
        <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900">
          {/* Active progress monitor appears persistently at top of Optimize tab if running or just finished */}
          {activeTab === 'optimize' && progress && (
            <div className="p-6 pb-0 max-w-6xl mx-auto">
              <ProgressView
                progress={progress}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={handleCancel}
              />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardPage
              onStartNewJob={() => {
                setActiveTab('optimize');
                if (items.length === 0) handleScanFolder();
              }}
              onSelectFolder={(folder) => {
                setInputFolder(folder);
                handleScanFolder(folder);
                setActiveTab('optimize');
              }}
              recentJobs={recentJobs}
              systemStatus={systemStatus}
              onOpenReport={(report) => setActiveReportModal(report)}
              onGenerateSample={handleGenerateSample}
              onImportFolderFiles={handleImportFolderFiles}
            />
          )}

          {activeTab === 'optimize' && (
            <OptimizePage
              inputFolder={inputFolder}
              setInputFolder={setInputFolder}
              outputFolder={outputFolder}
              setOutputFolder={setOutputFolder}
              settings={settings}
              setSettings={setSettings}
              summary={summary}
              items={items}
              estimate={estimate}
              isScanning={isScanning}
              onScanFolder={() => handleScanFolder()}
              onOpenPreview={handleOpenGeneralPreview}
              onRequestStart={() => setIsSafetyModalOpen(true)}
              isProcessing={isProcessing}
              onImportFolderFiles={handleImportFolderFiles}
              onDownloadZip={() => downloadOptimizedZip(undefined, outputFolder)}
              hasOutput={Boolean(recentJobs.length > 0 || (progress && progress.processed > 0))}
            />
          )}

          {activeTab === 'gallery' && (
            <GalleryPage
              items={items}
              onOpenPreviewItem={handleOpenPreviewItem}
            />
          )}

          {activeTab === 'benchmark' && <BenchmarkPage />}

          {activeTab === 'cache' && <CachePage />}

          {activeTab === 'history' && (
            <HistoryPage
              history={recentJobs}
              onOpenReport={(report) => setActiveReportModal(report)}
              onClearHistory={handleClearHistory}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              setSettings={setSettings}
              onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
            />
          )}
        </main>
      </div>

      {/* User Safety Confirmation Modal */}
      <SafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        onConfirm={handleStartBatch}
        inputFolder={inputFolder}
        outputFolder={outputFolder}
        totalImages={items.length}
        settings={settings}
        estimate={estimate}
      />

      {/* Side-by-Side Quality Preview Modal */}
      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        data={previewModalData}
        isLoading={isPreviewLoading}
      />

      {/* Final Completion Report Modal */}
      <ReportModal
        isOpen={Boolean(activeReportModal)}
        onClose={() => setActiveReportModal(null)}
        report={activeReportModal}
      />

      {/* Folder Import Progress Modal */}
      <FolderImportModal
        isOpen={importState.isOpen}
        folderName={importState.folderName}
        processedCount={importState.processedCount}
        totalCount={importState.totalCount}
        isCompleted={importState.isCompleted}
        error={importState.error}
        onClose={() => setImportState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Floating ZIP Download Toast Notification */}
      {zipStatus.state !== 'idle' && (
        <div
          id="zip-download-toast"
          className="fixed bottom-6 right-6 z-50 max-w-sm bg-white border border-slate-200 shadow-xl rounded-xl p-4 flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
        >
          {zipStatus.state === 'downloading' && (
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0 mt-0.5" />
          )}
          {zipStatus.state === 'verifying' && (
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0 mt-0.5" />
          )}
          {zipStatus.state === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          )}
          {zipStatus.state === 'error' && (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">
                {zipStatus.state === 'downloading' && 'Packaging & Downloading ZIP'}
                {zipStatus.state === 'verifying' && 'Verifying Archive Integrity'}
                {zipStatus.state === 'success' && 'ZIP Saved to PC'}
                {zipStatus.state === 'error' && 'ZIP Download Notice'}
              </h4>
              <button
                type="button"
                onClick={() => setZipStatus({ state: 'idle', message: '' })}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 break-words leading-relaxed">
              {zipStatus.message}
            </p>
            {zipStatus.filename && (
              <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                {zipStatus.filename}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
