/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasCamera, CameraPanMode, CameraPose, SceneOrigin } from './canvasCamera';
import type { SketchDrawing, SketchSettings } from './imageSketch';
import { SketchPainter } from './imageSketch';

export type CanvasViewMode = 'camera' | 'overview';

export interface CanvasManagerStatus {
  activeSceneIndex: number;
  isPanning: boolean;
  panProgress: number;
  currentPose: CameraPose;
  virtualWidth: number;
  virtualHeight: number;
  origins: SceneOrigin[];
}

/**
 * Multi-Scene Panning Engine (CanvasManager)
 *
 * Coordinates multi-scene sketch rendering across a Virtual Infinite Canvas
 * (3840x1080 or larger), driving the CanvasCamera from one completed sketch
 * to the next with smooth panning interpolation.
 */
export class CanvasManager {
  public readonly camera: CanvasCamera;
  public readonly drawings: SketchDrawing[];
  public readonly durations: number[];
  public readonly settings: SketchSettings;
  public readonly marker?: HTMLCanvasElement;
  public viewMode: CanvasViewMode = 'camera';

  private targetCanvas: HTMLCanvasElement;
  private targetCtx: CanvasRenderingContext2D;
  private painters: SketchPainter[];
  private tileCanvases: HTMLCanvasElement[];
  private tileContexts: CanvasRenderingContext2D[];
  private completed: boolean[];
  private bounds: { start: number; end: number; duration: number }[];
  private totalDuration: number;

  constructor(
    targetCanvas: HTMLCanvasElement,
    drawings: SketchDrawing[],
    durations: number[],
    settings: SketchSettings,
    marker?: HTMLCanvasElement,
    panMode: CameraPanMode = 'pan_right',
    transitionDuration: number = 1.2
  ) {
    this.targetCanvas = targetCanvas;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D context from canvas');
    this.targetCtx = ctx;

    this.drawings = drawings;
    this.durations = durations;
    this.settings = settings;
    this.marker = marker;

    const isHd = settings.resolution === '1080';
    const isPortrait = settings.aspectRatio === '9:16';
    const sceneW = isPortrait ? (isHd ? 1080 : 720) : (isHd ? 1920 : 1280);
    const sceneH = isPortrait ? (isHd ? 1920 : 1280) : (isHd ? 1080 : 720);

    this.camera = new CanvasCamera(
      drawings.length,
      sceneW,
      sceneH,
      panMode,
      transitionDuration
    );

    // Prepare tile canvases for each scene
    this.tileCanvases = [];
    this.tileContexts = [];
    this.painters = [];
    this.completed = drawings.map(() => false);

    for (let i = 0; i < drawings.length; i++) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = sceneW;
      tileCanvas.height = sceneH;
      const tileCtx = tileCanvas.getContext('2d')!;
      this.tileCanvases.push(tileCanvas);
      this.tileContexts.push(tileCtx);

      // Create painter targeting this offscreen tile canvas
      const painter = new SketchPainter(tileCanvas, drawings[i], settings, undefined);
      this.painters.push(painter);
    }

    // Compute scene bounds along timeline
    let elapsed = 0;
    this.bounds = durations.map(d => {
      const b = { start: elapsed, end: elapsed + d, duration: d };
      elapsed += d;
      return b;
    });
    this.totalDuration = elapsed;
  }

  public setViewMode(mode: CanvasViewMode) {
    this.viewMode = mode;
  }

  public getStatus(time: number): CanvasManagerStatus {
    const sceneIndex = this.getSceneIndex(time);
    const bound = this.bounds[sceneIndex];
    const localTime = Math.max(0, time - bound.start);
    const isPanning = sceneIndex > 0 && localTime < this.camera.transitionDuration;
    const panProgress = isPanning ? localTime / this.camera.transitionDuration : 1;
    const currentPose = this.camera.at(sceneIndex, localTime, bound.duration);

    return {
      activeSceneIndex: sceneIndex,
      isPanning,
      panProgress,
      currentPose,
      virtualWidth: this.camera.virtualWidth,
      virtualHeight: this.camera.virtualHeight,
      origins: this.camera.origins,
    };
  }

  private getSceneIndex(time: number): number {
    if (!this.bounds.length) return 0;
    let idx = this.bounds.findIndex(b => time < b.end);
    if (idx === -1) idx = this.bounds.length - 1;
    return idx;
  }

  /**
   * Main render method for any timestamp on the timeline.
   */
  public paint(time: number) {
    if (!this.drawings.length) return;

    const sceneIndex = this.getSceneIndex(time);
    const bound = this.bounds[sceneIndex];
    const localTime = Math.max(0, time - bound.start);

    // 1. Ensure all prior scenes are painted to completion
    for (let i = 0; i < sceneIndex; i++) {
      if (!this.completed[i]) {
        this.painters[i].paint(1.0);
        this.completed[i] = true;
      }
    }

    // 2. Compute current scene drawing fraction
    const transition = sceneIndex > 0 ? this.camera.transitionDuration : 0;
    let drawFraction = 0;
    if (localTime <= transition) {
      drawFraction = 0;
    } else {
      const drawDuration = Math.max(0.1, bound.duration - transition);
      drawFraction = Math.min(1, Math.max(0, (localTime - transition) / drawDuration));
    }

    // Paint active scene tile
    this.painters[sceneIndex].paint(drawFraction);
    if (drawFraction >= 1) {
      this.completed[sceneIndex] = true;
    } else {
      this.completed[sceneIndex] = false;
    }

    // 3. Obtain camera pose
    const pose = this.camera.at(sceneIndex, localTime, bound.duration);

    // 4. Render to target canvas
    const w = this.targetCanvas.width;
    const h = this.targetCanvas.height;

    if (this.viewMode === 'overview') {
      this.camera.renderOverview(
        this.targetCtx,
        w,
        h,
        pose,
        idx => this.tileCanvases[idx] || null,
        sceneIndex,
        this.settings.paper
      );
    } else {
      // Camera Director View (1920x1080 Viewport)
      this.camera.composite(
        this.targetCtx,
        pose,
        w,
        h,
        idx => this.tileCanvases[idx] || null,
        sceneIndex,
        this.settings.paper
      );

      // Render marker hand in camera coordinates if drawing is in progress
      if (
        this.settings.hand &&
        this.marker &&
        drawFraction > 0 &&
        drawFraction < 1 &&
        this.painters[sceneIndex].tip
      ) {
        const localTip = this.painters[sceneIndex].tip!;
        const origin = this.camera.origins[sceneIndex];
        const worldTip = {
          x: origin.x + localTip.x,
          y: origin.y + localTip.y,
        };
        const viewTip = this.camera.worldToView(worldTip, pose, w, h);

        const handWidth = (w * 0.28 * this.camera.width) / pose.width;
        const handHeight = (handWidth * this.marker.height) / this.marker.width;

        this.targetCtx.save();
        this.targetCtx.drawImage(
          this.marker,
          viewTip.x - handWidth * 0.279,
          viewTip.y - handHeight * 0.278,
          handWidth,
          handHeight
        );
        this.targetCtx.restore();
      }
    }
  }

  /** Gets an individual completed tile canvas */
  public getTileCanvas(index: number): HTMLCanvasElement | undefined {
    return this.tileCanvases[index];
  }
}
