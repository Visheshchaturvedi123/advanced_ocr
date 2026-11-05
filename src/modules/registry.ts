export type BrahmaModuleId = 'autocine' | 'scribble' | 'image-lab';

export type BrahmaModuleIcon = 'clapperboard' | 'pen' | 'image';

export interface BrahmaModule {
  id: BrahmaModuleId;
  name: string;
  tagline: string;
  description: string;
  icon: BrahmaModuleIcon;
  accent: string;
  requiresHub?: boolean;
  available: boolean;
}

export const BRAHMA_MODULES: BrahmaModule[] = [
  {
    id: 'autocine',
    name: 'AutoCine',
    tagline: 'Photo-to-video editor',
    description: 'Turn a folder of photos and a music track into a beat-synced edit, then export from the browser.',
    icon: 'clapperboard',
    accent: '#f97316',
    available: true,
  },
  {
    id: 'scribble',
    name: 'Scribble Studio',
    tagline: 'Whiteboard stories',
    description: 'Script a story, preview hand-drawn scenes, and export a browser video or Python render kit.',
    icon: 'pen',
    accent: '#2563eb',
    available: true,
  },
  {
    id: 'image-lab',
    name: 'Image Lab',
    tagline: 'Batch image optimizer',
    description: 'Scan folders, compress and convert images, and download the results through the local Brahma Hub.',
    icon: 'image',
    accent: '#0f766e',
    requiresHub: true,
    available: true,
  },
];

export const getModule = (id: BrahmaModuleId) =>
  BRAHMA_MODULES.find((module) => module.id === id);

export const getModuleUrl = (id: BrahmaModuleId) => {
  const path = `modules/${id}/index.html?embed=brahma`;
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
};
