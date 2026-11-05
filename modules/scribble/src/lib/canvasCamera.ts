/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Multi-Scene Panning Engine (Canvas Camera)
 *
 * Implements a Virtual Infinite Whiteboard Canvas (3840x1080 or larger)
 * with continuous subpixel camera interpolation, multi-scene layout orchestration,
 * and smooth transitions between sketches.
 *
 * Layout Diagram:
 * ┌──────────────────────────────┬──────────────────────────────┐
 * │ Scene 1 (X: 0 -> 1920)       │ Scene 2 (X: 1920 -> 3840)    │
 * │ [Draw Sketch 1] ───────────► │ [Camera Pans Right] ───────► │ [Draw Sketch 2]
 * └──────────────────────────────┴──────────────────────────────┘
 */

export type CameraPanMode = 'pan_right' | 'pan_down' | 'grid' | 'zoom_pan';

export interface CameraPose {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom?: number;
}

export interface SceneOrigin {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface PageMetadata {
  title?: string;
  tag?: string;
  subtitle?: string;
}

export interface PageRenderOptions {
  ruledLines?: boolean;
  showBanners?: boolean;
  showSubtitles?: boolean;
}

/** Ken Perlin's smootherstep function: 6t^5 - 15t^4 + 10t^3 */
export function smootherstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/** Standard smoothstep: 3t^2 - 2t^3 */
export function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Subpixel interpolation between two camera viewports */
export function interpolateCameraPose(start: CameraPose, end: CameraPose, progress: number): CameraPose {
  const t = smootherstep(progress);
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    width: start.width + (end.width - start.width) * t,
    height: start.height + (end.height - start.height) * t,
    zoom: (start.zoom ?? 1) + ((end.zoom ?? 1) - (start.zoom ?? 1)) * t,
  };
}

export class CanvasCamera {
  public readonly sceneCount: number;
  public readonly width: number;
  public readonly height: number;
  public readonly panMode: CameraPanMode;
  public readonly transitionDuration: number;
  public readonly pageGap: number;
  public readonly origins: SceneOrigin[];
  public readonly virtualWidth: number;
  public readonly virtualHeight: number;
  public readonly columns: number;

  constructor(
    sceneCount: number,
    width: number = 1920,
    height: number = 1080,
    panMode: CameraPanMode = 'pan_right',
    transitionDuration: number = 1.2,
    customColumns?: number,
    pageGap: number = 160
  ) {
    this.sceneCount = Math.max(1, sceneCount);
    this.width = width;
    this.height = height;
    this.panMode = panMode;
    this.transitionDuration = Math.max(0.2, transitionDuration);
    this.pageGap = Math.max(0, pageGap);

    let cols = 1;
    if (panMode === 'pan_right') {
      cols = this.sceneCount;
    } else if (panMode === 'pan_down') {
      cols = 1;
    } else if (panMode === 'grid') {
      cols = customColumns ?? (this.sceneCount >= 4 ? 2 : Math.min(this.sceneCount, 2));
    } else {
      cols = customColumns ?? Math.min(this.sceneCount, 2);
    }
    this.columns = Math.max(1, cols);

    // Compute origins on the virtual infinite canvas with page gaps
    this.origins = [];
    const stepX = width + this.pageGap;
    const stepY = height + this.pageGap;

    for (let index = 0; index < this.sceneCount; index++) {
      let x = 0;
      let y = 0;

      if (panMode === 'pan_right') {
        x = index * stepX;
        y = 0;
      } else if (panMode === 'pan_down') {
        x = 0;
        y = index * stepY;
      } else if (panMode === 'grid') {
        const row = Math.floor(index / this.columns);
        let col = index % this.columns;
        // Serpentine: alternate right-to-left on odd rows
        if (row % 2 === 1) {
          col = this.columns - 1 - col;
        }
        x = col * stepX;
        y = row * stepY;
      } else {
        // Default horizontal strip
        x = index * stepX;
        y = 0;
      }

      this.origins.push({
        index,
        x,
        y,
        width,
        height,
        label: `Scene ${index + 1}`,
      });
    }

    const maxX = Math.max(...this.origins.map(o => o.x + o.width));
    const maxY = Math.max(...this.origins.map(o => o.y + o.height));

    // Ensure virtual infinite canvas covers all scenes with comfortable margins
    this.virtualWidth = Math.max(3840, maxX + this.pageGap);
    this.virtualHeight = Math.max(1080, maxY + this.pageGap);
  }

  /** Gets the target pose for a specific scene index */
  public pose(index: number, zoom: number = 1.0): CameraPose {
    const safeIndex = Math.max(0, Math.min(index, this.origins.length - 1));
    const origin = this.origins[safeIndex];
    const safeZoom = Math.max(0.2, Math.min(3.0, zoom));
    const w = this.width / safeZoom;
    const h = this.height / safeZoom;
    return {
      x: origin.x + (this.width - w) / 2,
      y: origin.y + (this.height - h) / 2,
      width: w,
      height: h,
      zoom: safeZoom,
    };
  }

  /** Subtle drift zoom during drawing */
  public finalZoom(index: number): number {
    return 1.02; // Subtle 2% drift zoom while sketch is being drawn
  }

  /**
   * Calculates the camera pose at a given local scene time.
   * If index > 0 and localTime < transitionDuration, smoothly interpolates
   * from the previous scene's pose to the current scene's pose.
   */
  public at(
    index: number,
    localTime: number,
    duration: number,
    overrideTransition?: number
  ): CameraPose {
    const transition = overrideTransition ?? this.transitionDuration;
    const safeIndex = Math.max(0, Math.min(index, this.origins.length - 1));

    if (safeIndex > 0 && localTime < transition) {
      const prevIndex = safeIndex - 1;
      const prevPose = this.pose(prevIndex, 1.0);
      const targetPose = this.pose(safeIndex, 1.0);
      const panProgress = Math.min(1, Math.max(0, localTime / transition));
      return interpolateCameraPose(prevPose, targetPose, panProgress);
    }

    // Inside current scene sketch drawing: camera locked stably on active frame
    return this.pose(safeIndex, 1.0);
  }

  /** Transforms a point from Virtual Infinite Canvas coordinates to Viewport coordinates */
  public worldToView(
    point: { x: number; y: number },
    pose: CameraPose,
    targetWidth: number,
    targetHeight: number
  ): { x: number; y: number } {
    const scaleX = targetWidth / pose.width;
    const scaleY = targetHeight / pose.height;
    return {
      x: (point.x - pose.x) * scaleX,
      y: (point.y - pose.y) * scaleY,
    };
  }

  /** Transforms a point from Viewport coordinates back to Virtual Infinite Canvas coordinates */
  public viewToWorld(
    point: { x: number; y: number },
    pose: CameraPose,
    targetWidth: number,
    targetHeight: number
  ): { x: number; y: number } {
    const scaleX = pose.width / targetWidth;
    const scaleY = pose.height / targetHeight;
    return {
      x: pose.x + point.x * scaleX,
      y: pose.y + point.y * scaleY,
    };
  }

  /**
   * Composites tiles from the Virtual Infinite Canvas to a target 2D canvas context.
   * Only tiles that overlap the camera viewport are painted.
   */
  public composite(
    ctx: CanvasRenderingContext2D,
    pose: CameraPose,
    targetWidth: number,
    targetHeight: number,
    getTile: (index: number) => HTMLCanvasElement | ImageBitmap | null,
    maxIndex: number,
    background: string = '#fcfbf5',
    pagesMeta?: PageMetadata[],
    pageOptions?: PageRenderOptions
  ) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Infinite whiteboard wall backdrop (neutral warm desk backdrop)
    ctx.fillStyle = '#f3f1e9';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Scale and translate according to camera pose
    const scaleX = targetWidth / pose.width;
    const scaleY = targetHeight / pose.height;

    ctx.scale(scaleX, scaleY);
    ctx.translate(-pose.x, -pose.y);

    const ruled = pageOptions?.ruledLines !== false;
    const showBanners = pageOptions?.showBanners !== false;
    const showSubtitles = pageOptions?.showSubtitles !== false;

    // Draw all visible page tiles
    for (let i = 0; i <= maxIndex && i < this.origins.length; i++) {
      const origin = this.origins[i];
      // AABB overlap check
      if (
        origin.x + origin.width >= pose.x &&
        origin.x <= pose.x + pose.width &&
        origin.y + origin.height >= pose.y &&
        origin.y <= pose.y + pose.height
      ) {
        // 1. Page card shadow & base
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = background;
        ctx.fillRect(origin.x, origin.y, origin.width, origin.height);
        ctx.restore();

        // 2. Page card clean border
        ctx.strokeStyle = 'rgba(45, 55, 40, 0.12)';
        ctx.lineWidth = 2;
        ctx.strokeRect(origin.x, origin.y, origin.width, origin.height);

        // 3. Ruled notebook paper lines (horizontal lines spaced every 42px)
        if (ruled) {
          ctx.save();
          ctx.strokeStyle = 'rgba(50, 60, 45, 0.065)';
          ctx.lineWidth = 1.2;
          const lineStart = origin.y + 130;
          const lineEnd = origin.y + origin.height - 96;
          for (let ly = lineStart; ly < lineEnd; ly += 42) {
            ctx.beginPath();
            ctx.moveTo(origin.x + 28, ly);
            ctx.lineTo(origin.x + origin.width - 28, ly);
            ctx.stroke();
          }
          ctx.restore();
        }

        const meta = pagesMeta?.[i];

        // 4. Top Framed Header Banner (like in video)
        if (showBanners && (meta?.title || meta?.tag)) {
          const hx = origin.x + 36;
          const hy = origin.y + 24;
          const hw = origin.width - 72;
          const hh = 94;

          ctx.save();
          // Framed card container
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(hx, hy, hw, hh);
          ctx.strokeStyle = '#2d3329';
          ctx.lineWidth = 2.4;
          ctx.strokeRect(hx, hy, hw, hh);

          // Scene Title
          const title = meta?.title || `Scene ${i + 1}`;
          ctx.fillStyle = '#1c221a';
          ctx.font = "bold 32px 'DM Sans', 'Noto Sans', system-ui, sans-serif";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(title, hx + 22, hy + 30, hw - 44);

          // Red/accent underline
          ctx.strokeStyle = '#b83b30';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(hx + 22, hy + 52);
          ctx.lineTo(hx + hw - 22, hy + 52);
          ctx.stroke();

          // Subtitle / category tag below underline
          const tag = meta?.tag || 'Photosynthesis';
          ctx.fillStyle = '#586354';
          ctx.font = "600 15px 'DM Sans', system-ui, sans-serif";
          ctx.fillText(tag, hx + 22, hy + 74);
          ctx.restore();
        }

        // 5. Sketch Artwork from painter
        const tile = getTile(i);
        if (tile) {
          ctx.drawImage(tile, origin.x, origin.y, origin.width, origin.height);
        }

        // 6. Bottom Dark Subtitle Card (like in video)
        if (showSubtitles && meta?.subtitle) {
          const sx = origin.x + 36;
          const sy = origin.y + origin.height - 84;
          const sw = origin.width - 72;
          const sh = 56;

          ctx.save();
          // Dark rounded pill container
          ctx.fillStyle = 'rgba(24, 28, 32, 0.94)';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(sx, sy, sw, sh, 10);
          } else {
            ctx.rect(sx, sy, sw, sh);
          }
          ctx.fill();

          // Subtitle caption text
          ctx.fillStyle = '#ffffff';
          ctx.font = "600 20px 'DM Sans', system-ui, sans-serif";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(meta.subtitle, sx + 22, sy + sh / 2, sw - 44);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  /**
   * Renders the entire Virtual Infinite Canvas (Bird's Eye Overview)
   * with a glowing indicator of the camera's current viewport frame.
   */
  public renderOverview(
    ctx: CanvasRenderingContext2D,
    targetWidth: number,
    targetHeight: number,
    pose: CameraPose,
    getTile: (index: number) => HTMLCanvasElement | ImageBitmap | null,
    maxIndex: number,
    background: string = '#fcfbf5',
    pagesMeta?: PageMetadata[],
    pageOptions?: PageRenderOptions
  ) {
    ctx.save();
    ctx.setTransform(1, 0, 1, 0, 0, 0); // reset
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Dark workspace backdrop
    ctx.fillStyle = '#1e241e';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Padding around infinite board
    const pad = 40;
    const availW = targetWidth - pad * 2;
    const availH = targetHeight - pad * 2;

    const scale = Math.min(availW / this.virtualWidth, availH / this.virtualHeight);
    const offsetX = (targetWidth - this.virtualWidth * scale) / 2;
    const offsetY = (targetHeight - this.virtualHeight * scale) / 2;

    // Draw virtual whiteboard shadow and base
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ebe8dc';
    ctx.fillRect(offsetX, offsetY, this.virtualWidth * scale, this.virtualHeight * scale);
    ctx.restore();

    // Draw subtle grid lines on the virtual infinite canvas
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    const gridStep = 240 * scale;
    for (let gx = offsetX; gx <= offsetX + this.virtualWidth * scale; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, offsetY);
      ctx.lineTo(gx, offsetY + this.virtualHeight * scale);
      ctx.stroke();
    }
    for (let gy = offsetY; gy <= offsetY + this.virtualHeight * scale; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(offsetX, gy);
      ctx.lineTo(offsetX + this.virtualWidth * scale, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Draw each scene tile as a distinct presentation page
    for (let i = 0; i <= maxIndex && i < this.origins.length; i++) {
      const origin = this.origins[i];
      const tile = getTile(i);
      const tx = offsetX + origin.x * scale;
      const ty = offsetY + origin.y * scale;
      const tw = origin.width * scale;
      const th = origin.height * scale;

      // Page card background
      ctx.save();
      ctx.fillStyle = background;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 8 * scale;
      ctx.fillRect(tx, ty, tw, th);
      ctx.restore();

      // Top banner mini representation
      const meta = pagesMeta?.[i];
      if (meta?.title) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tx + 4 * scale, ty + 4 * scale, tw - 8 * scale, 12 * scale);
        ctx.fillStyle = '#1c221a';
        ctx.font = `bold ${Math.max(7, Math.round(9 * scale))}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.title, tx + 6 * scale, ty + 10 * scale, tw - 12 * scale);
      }

      if (tile) {
        ctx.drawImage(tile, tx, ty, tw, th);
      }

      // Draw subtle boundary and scene label
      ctx.strokeStyle = 'rgba(73, 104, 61, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx, ty, tw, th);

      // Label pill at top right
      ctx.fillStyle = 'rgba(45, 55, 40, 0.9)';
      ctx.beginPath();
      const badgeW = Math.max(60, 84 * scale);
      const badgeH = Math.max(16, 22 * scale);
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(tx + tw - badgeW - 8 * scale, ty + 8 * scale, badgeW, badgeH, 4);
      } else {
        ctx.rect(tx + tw - badgeW - 8 * scale, ty + 8 * scale, badgeW, badgeH);
      }
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.max(9, Math.round(11 * scale))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Scene ${i + 1}`, tx + tw - badgeW / 2 - 8 * scale, ty + 8 * scale + badgeH / 2);
    }

    // Draw Camera Viewport indicator rectangle
    const camX = offsetX + pose.x * scale;
    const camY = offsetY + pose.y * scale;
    const camW = pose.width * scale;
    const camH = pose.height * scale;

    ctx.save();
    // Glowing active camera border
    ctx.shadowColor = '#e15241';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#e15241';
    ctx.lineWidth = 3;
    ctx.strokeRect(camX, camY, camW, camH);

    // Corner crosshairs / brackets
    const bracketSize = Math.min(20, camW * 0.15);
    ctx.strokeStyle = '#e15241';
    ctx.lineWidth = 4;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(camX, camY + bracketSize);
    ctx.lineTo(camX, camY);
    ctx.lineTo(camX + bracketSize, camY);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(camX + camW - bracketSize, camY);
    ctx.lineTo(camX + camW, camY);
    ctx.lineTo(camX + camW, camY + bracketSize);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(camX, camY + camH - bracketSize);
    ctx.lineTo(camX, camY + camH);
    ctx.lineTo(camX + bracketSize, camY + camH);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(camX + camW - bracketSize, camY + camH);
    ctx.lineTo(camX + camW, camY + camH);
    ctx.lineTo(camX + camW, camY + camH - bracketSize);
    ctx.stroke();

    // Camera badge
    ctx.fillStyle = '#e15241';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(camX + 6, camY - 22, 108, 20, 4);
    } else {
      ctx.rect(camX + 6, camY - 22, 108, 20);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ACTIVE CAMERA', camX + 60, camY - 12);
    ctx.restore();

    ctx.restore();
  }
}
