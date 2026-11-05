import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MediaPanel } from './components/MediaPanel';
import { PreviewPlayer } from './components/PreviewPlayer';
import { Timeline } from './components/Timeline';
import { Inspector } from './components/Inspector';
import { ExportModal } from './components/ExportModal';
import { BenchmarkModal } from './components/BenchmarkModal';

import { 
  PhotoAsset, AudioTrack, TimelineClip, 
  StyleProfileName, AspectRatio, QualityPreset, MotionDef, TransitionDef, EffectType 
} from './types';
import { SAMPLE_PHOTOS, SAMPLE_AUDIO, PHONK_AUDIO } from './data/sampleProjects';
import { generateAutoEditTimeline } from './utils/planner';
import { importAndAnalyzeFolder } from './utils/folderImporter';
import { audioPlayer } from './utils/audioPlayer';
import { Sparkles, Cpu, CheckCircle, ShieldCheck, FolderPlus } from 'lucide-react';

export default function App() {
  const [photos, setPhotos] = useState<PhotoAsset[]>(SAMPLE_PHOTOS);
  const [audio, setAudio] = useState<AudioTrack | null>(SAMPLE_AUDIO);
  const [styleName, setStyleName] = useState<StyleProfileName>('CINEMATIC');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('HIGH');

  const [timeline, setTimeline] = useState<TimelineClip[]>(() => 
    generateAutoEditTimeline(SAMPLE_PHOTOS, SAMPLE_AUDIO, 'CINEMATIC', '16:9')
  );

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>('p01');
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip_1');

  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);

  // Folder import & analysis states
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ message: string; percent: number } | null>(null);
  const [importSummaryNotification, setImportSummaryNotification] = useState<string | null>(null);

  const lastTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);

  const totalDuration = timeline.length > 0 
    ? timeline[timeline.length - 1].endTime 
    : (audio ? audio.duration : 30.0);

  // Master time change helper to keep audio engine in sync
  const handleTimeChange = (newTime: number) => {
    audioPlayer.seek(newTime);
    setCurrentTime(newTime);
  };

  // Playhead update loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = (now - lastTimeRef.current) / 1000.0;
      lastTimeRef.current = now;

      setCurrentTime((prevTime) => {
        const nextTime = prevTime + deltaSeconds;
        if (nextTime >= totalDuration) {
          audioPlayer.seek(0);
          return 0; // Seamless loop back to start
        }
        return nextTime;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Handle Style Profile Switch
  const handleStyleChange = (newStyle: StyleProfileName) => {
    setStyleName(newStyle);

    let activeAudio = audio;
    if (newStyle === 'PHONK_DRIFT' && (!audio || audio.id === 'aud_01')) {
      activeAudio = PHONK_AUDIO;
      setAudio(PHONK_AUDIO);
      audioPlayer.setTrack(PHONK_AUDIO);
      setImportSummaryNotification('⚡ Loaded High-Beat Phonk Drift (142 BPM) with fast-paced cuts, energetic flash/warp transitions & dutch angle camera motions!');
      setTimeout(() => setImportSummaryNotification(null), 5000);
    } else if (newStyle !== 'PHONK_DRIFT' && audio?.id === 'aud_phonk') {
      activeAudio = SAMPLE_AUDIO;
      setAudio(SAMPLE_AUDIO);
      audioPlayer.setTrack(SAMPLE_AUDIO);
    }

    const updatedTimeline = generateAutoEditTimeline(photos, activeAudio, newStyle, aspectRatio);
    setTimeline(updatedTimeline);
    handleTimeChange(0);
    setIsPlaying(true);
  };

  // Handle Aspect Ratio Switch
  const handleAspectRatioChange = (newAspect: AspectRatio) => {
    setAspectRatio(newAspect);
    const updatedTimeline = generateAutoEditTimeline(photos, audio, styleName, newAspect);
    setTimeline(updatedTimeline);
  };

  // Auto-Edit Trigger
  const handleAutoEdit = () => {
    let activeAudio = audio;
    if (styleName === 'PHONK_DRIFT' && (!audio || audio.id === 'aud_01')) {
      activeAudio = PHONK_AUDIO;
      setAudio(PHONK_AUDIO);
      audioPlayer.setTrack(PHONK_AUDIO);
    }
    const updatedTimeline = generateAutoEditTimeline(photos, activeAudio, styleName, aspectRatio);
    setTimeline(updatedTimeline);
    handleTimeChange(0);
    setIsPlaying(true);
    if (styleName === 'PHONK_DRIFT') {
      setImportSummaryNotification('⚡ Auto-Applied High-Beat Phonk Edit: 0.4s-0.8s rapid cuts matched to 142 BPM 808 drops!');
      setTimeout(() => setImportSummaryNotification(null), 4000);
    }
  };

  // Load sample dataset
  const handleLoadSample = () => {
    setPhotos(SAMPLE_PHOTOS);
    setAudio(SAMPLE_AUDIO);
    audioPlayer.setTrack(SAMPLE_AUDIO);
    const updatedTimeline = generateAutoEditTimeline(SAMPLE_PHOTOS, SAMPLE_AUDIO, styleName, aspectRatio);
    setTimeline(updatedTimeline);
    handleTimeChange(0);
    setImportSummaryNotification('Loaded "Alpine Odyssey" preloaded project with 8 photos & 120 BPM soundtrack.');
    setTimeout(() => setImportSummaryNotification(null), 4000);
  };

  // Handle Folder Import & Extraction (Images + Audio from the same folder)
  const handleImportFolder = async (files: FileList) => {
    try {
      setIsImporting(true);
      setIsPlaying(false);
      audioPlayer.pause();

      const result = await importAndAnalyzeFolder(files, (message, percent) => {
        setImportStatus({ message, percent });
      });

      if (result.photos.length === 0 && !result.audio) {
        setImportStatus({ message: 'No image or audio files recognized in the selected folder.', percent: 100 });
        setTimeout(() => setIsImporting(false), 2000);
        return;
      }

      const newPhotos = result.photos.length > 0 ? result.photos : photos;
      const newAudio = result.audio || audio;

      setPhotos(newPhotos);
      if (result.audio) {
        setAudio(result.audio);
        audioPlayer.setTrack(result.audio);
      }

      // Automatically construct music-synchronized timeline
      const newTimeline = generateAutoEditTimeline(newPhotos, newAudio, styleName, aspectRatio);
      setTimeline(newTimeline);

      if (newPhotos.length > 0) {
        setSelectedPhotoId(newPhotos[0].id);
      }
      if (newTimeline.length > 0) {
        setSelectedClipId(newTimeline[0].id);
      }

      handleTimeChange(0);
      setIsImporting(false);
      setImportStatus(null);

      // Start preview with audio
      setIsPlaying(true);

      const summaryText = `Imported "${result.folderName}": Analyzed ${result.imageCount} photos (${result.duplicateCount} duplicates grouped) & ${result.audioCount > 0 ? `1 soundtrack (${result.audio?.bpm} BPM)` : 'using ambient audio'}.`;
      setImportSummaryNotification(summaryText);
      setTimeout(() => setImportSummaryNotification(null), 5000);
    } catch (err) {
      console.error('Error importing folder:', err);
      setIsImporting(false);
      setImportStatus(null);
    }
  };

  // Find inspected objects
  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) || photos[0] || null;
  const selectedClip = timeline.find(c => c.id === selectedClipId) || timeline[0] || null;

  // Selected Clip mutation handlers
  const handleUpdateClipMotion = (mType: MotionDef['type']) => {
    if (!selectedClipId) return;
    setTimeline(prev => prev.map(c => {
      if (c.id === selectedClipId) {
        return {
          ...c,
          motion: {
            ...c.motion,
            type: mType
          }
        };
      }
      return c;
    }));
  };

  const handleUpdateClipTransition = (tType: TransitionDef['type']) => {
    if (!selectedClipId) return;
    setTimeline(prev => prev.map(c => {
      if (c.id === selectedClipId) {
        return {
          ...c,
          transition: {
            ...c.transition,
            type: tType,
            duration: tType === 'CUT' ? 0 : 0.6
          }
        };
      }
      return c;
    }));
  };

  const handleUpdateClipEffect = (eType: EffectType, intensity: number = 0.8) => {
    if (!selectedClipId) return;
    setTimeline(prev => prev.map(c => {
      if (c.id === selectedClipId) {
        return {
          ...c,
          effect: {
            type: eType,
            intensity,
            description: `Visual effect: ${eType}`
          }
        };
      }
      return c;
    }));
  };

  const handleUpdateClipDuration = (newDur: number) => {
    if (!selectedClipId) return;
    setTimeline(prev => {
      let curr = 0;
      return prev.map(c => {
        const dur = c.id === selectedClipId ? Math.max(0.5, newDur) : c.duration;
        const clipStart = curr;
        const clipEnd = curr + dur;
        curr += dur;
        return {
          ...c,
          startTime: +clipStart.toFixed(2),
          duration: +dur.toFixed(2),
          endTime: +clipEnd.toFixed(2)
        };
      });
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden font-sans select-none relative">
      {/* 1. Header Toolbar */}
      <Header
        styleName={styleName}
        onStyleChange={handleStyleChange}
        aspectRatio={aspectRatio}
        onAspectRatioChange={handleAspectRatioChange}
        qualityPreset={qualityPreset}
        onQualityPresetChange={setQualityPreset}
        onAutoEdit={handleAutoEdit}
        onOpenExport={() => setIsExportOpen(true)}
        onDirectDownload={() => setIsExportOpen(true)}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onLoadSample={handleLoadSample}
        onImportFolder={handleImportFolder}
        isImporting={isImporting}
      />

      {/* Notification Toast for Import / Load */}
      {importSummaryNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-zinc-900 border border-amber-500/50 text-amber-300 text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{importSummaryNotification}</span>
        </div>
      )}

      {/* 2. Middle Pro Workspace: Media Panel (Left), Preview Player (Center), Inspector (Right) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Scanned Media & Audio Inspector */}
        <MediaPanel
          photos={photos}
          audio={audio}
          selectedPhotoId={selectedPhotoId}
          onSelectPhoto={(id) => {
            setSelectedPhotoId(id);
            const matchingClip = timeline.find(c => c.photoId === id);
            if (matchingClip) {
              setSelectedClipId(matchingClip.id);
              handleTimeChange(matchingClip.startTime);
            }
          }}
          onImportFolder={handleImportFolder}
          isImporting={isImporting}
        />

        {/* Center: Video Preview Canvas with Audible Synchronized Sound */}
        <PreviewPlayer
          timeline={timeline}
          audio={audio}
          aspectRatio={aspectRatio}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeChange={handleTimeChange}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          selectedClipId={selectedClipId}
          onSelectClip={(id) => {
            setSelectedClipId(id);
            const c = timeline.find(item => item.id === id);
            if (c) setSelectedPhotoId(c.photoId);
          }}
          onDirectDownload={() => setIsExportOpen(true)}
          styleName={styleName}
        />

        {/* Right: Technical Scores & Clip Inspector */}
        <Inspector
          selectedPhoto={selectedPhoto}
          selectedClip={selectedClip}
          onUpdateClipMotion={handleUpdateClipMotion}
          onUpdateClipTransition={handleUpdateClipTransition}
          onUpdateClipEffect={handleUpdateClipEffect}
          onUpdateClipDuration={handleUpdateClipDuration}
        />
      </div>

      {/* 3. Bottom: Multi-Track Timeline */}
      <Timeline
        timeline={timeline}
        audio={audio}
        currentTime={currentTime}
        onTimeChange={handleTimeChange}
        selectedClipId={selectedClipId}
        onSelectClip={(id) => {
          setSelectedClipId(id);
          const c = timeline.find(item => item.id === id);
          if (c) {
            setSelectedPhotoId(c.photoId);
            handleTimeChange(c.startTime);
          }
        }}
        onDirectDownload={() => setIsExportOpen(true)}
      />

      {/* 4. Export & Validation Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        timeline={timeline}
        audio={audio}
        aspectRatio={aspectRatio}
        qualityPreset={qualityPreset}
      />

      {/* 5. 8 GB RAM CPU Benchmark Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* 6. Folder Analysis Progress Modal */}
      {isImporting && importStatus && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl text-xs text-zinc-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Folder Extraction &amp; AI Analysis</h3>
                <p className="text-[11px] text-zinc-400">Extracting photos and soundtrack in low-memory pipeline</p>
              </div>
            </div>

            {/* Progress status message */}
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-300 font-medium truncate max-w-[280px]">
                  {importStatus.message}
                </span>
                <span className="font-mono text-amber-400 font-bold">{importStatus.percent}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-200 rounded-full"
                  style={{ width: `${importStatus.percent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-900">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>8 GB RAM Safe (&lt;15 MB Active Working Set)</span>
              </span>
              <span>Fast Offscreen Canvas</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
