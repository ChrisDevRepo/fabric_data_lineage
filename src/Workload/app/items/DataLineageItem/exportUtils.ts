/**
 * Export Utilities for Data Lineage Graph
 *
 * Captures the actual ReactFlow viewport and exports as SVG/PNG.
 * Uses html-to-image library to export exactly what's on screen.
 * NO duplicate rendering code - what you see is what you export.
 *
 * Reference: https://reactflow.dev/examples/misc/download-image
 * Note: html-to-image locked to version 1.11.11 (last working version)
 */

import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, ReactFlowInstance } from 'reactflow';
import { getThemeColors } from './useReactFlowTheme';

export interface ExportOptions {
  /** ReactFlow instance for bounds calculation */
  reactFlowInstance: ReactFlowInstance;
  /** Export format */
  format?: 'svg' | 'png';
  /** Image width (default: 1920) */
  width?: number;
  /** Image height (default: 1080) */
  height?: number;
  /** Background color (default: theme-aware) */
  backgroundColor?: string;
  /** Title for the filename */
  title?: string;
}

/**
 * Export the graph as an image (SVG or PNG)
 * Captures exactly what's rendered on screen - no duplicate code
 * Background color adapts to current theme (light/dark)
 */
export async function exportGraphToImage(options: ExportOptions): Promise<void> {
  // Get theme-aware default background
  const themeColors = getThemeColors();

  const {
    reactFlowInstance,
    format = 'png',
    width = 1920,
    height = 1080,
    backgroundColor = themeColors.exportBackground,
    title = 'data-lineage',
  } = options;

  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) {
    console.warn('No nodes to export');
    return;
  }

  // Get the viewport element (contains the actual rendered graph)
  const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
  if (!viewportElement) {
    console.error('ReactFlow viewport not found');
    return;
  }

  // Calculate bounds to fit all nodes in the export
  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(
    nodesBounds,
    width,
    height,
    0.5, // minZoom
    2,   // maxZoom
    0.25 // padding (25%)
  );

  // Prepare filename with date
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${title}-${dateStr}.${format}`;

  try {
    const imageOptions = {
      backgroundColor,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
      // Skip external fonts to avoid CORS errors with Office CDN fonts
      skipFonts: true,
      // Filter out elements that cause CORS issues
      filter: (node: HTMLElement) => {
        // Skip link elements pointing to external stylesheets
        if (node.tagName === 'LINK') {
          const href = node.getAttribute('href') || '';
          if (href.includes('cdn.jsdelivr.net') || href.includes('cdn.office.net')) {
            return false;
          }
        }
        return true;
      },
    };

    let dataUrl: string;
    if (format === 'svg') {
      dataUrl = await toSvg(viewportElement, imageOptions);
    } else {
      dataUrl = await toPng(viewportElement, imageOptions);
    }

    // Trigger browser download
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to export graph:', error);
    throw error;
  }
}
