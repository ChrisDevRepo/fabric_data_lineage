/**
 * Export Utilities for Data Lineage Graph
 *
 * Exports current view as PNG or JPEG (WYSIWYG).
 * Options: Legend toggle, high resolution (2x)
 *
 * Reference: https://reactflow.dev/examples/misc/download-image
 * Note: html-to-image locked to version 1.11.11 (last working version)
 *
 * Known limitation: "Fit all nodes" feature removed due to edge clipping
 * issues with html-to-image (GitHub issue xyflow/xyflow#2118).
 */

import { toPng, toJpeg } from 'html-to-image';
import { ReactFlowInstance } from 'reactflow';
import { getThemeColors } from './useReactFlowTheme';
import type { ExportSettings } from './ExportDialog';

// Re-export for convenience
export type { ExportSettings, ExportFormat } from './ExportDialog';

export interface ExportOptions {
  /** ReactFlow instance */
  reactFlowInstance: ReactFlowInstance;
  /** Export settings from dialog */
  settings: ExportSettings;
  /** Title for the filename */
  title?: string;
}

/**
 * Helper function to get date string for filename
 */
function getDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Helper function to trigger download
 */
function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Filter function to exclude unwanted elements from export
 */
function createExportFilter(excludeLegend: boolean) {
  return (node: HTMLElement): boolean => {
    // Skip link elements pointing to external stylesheets (causes CORS issues)
    if (node.tagName === 'LINK') {
      const href = node.getAttribute('href') || '';
      if (href.includes('cdn.jsdelivr.net') || href.includes('cdn.office.net')) {
        return false;
      }
    }

    const cl = node.classList;
    if (!cl) return true;

    // Always exclude minimap and controls
    if (cl.contains('react-flow__minimap')) return false;
    if (cl.contains('react-flow__controls')) return false;

    // Optionally exclude panels (legend, toolbar)
    if (excludeLegend && cl.contains('react-flow__panel')) return false;

    return true;
  };
}

/**
 * Get the export function based on format
 */
function getExportFunction(format: 'png' | 'jpeg') {
  return format === 'jpeg' ? toJpeg : toPng;
}

/**
 * Get file extension for format
 */
function getFileExtension(format: 'png' | 'jpeg'): string {
  return format === 'jpeg' ? 'jpg' : format;
}

/**
 * Export the graph as an image (current view only)
 *
 * @param options Export options including settings from dialog
 */
export async function exportGraphToImage(options: ExportOptions): Promise<void> {
  const themeColors = getThemeColors();
  const {
    reactFlowInstance,
    settings,
    title = 'data-lineage',
  } = options;

  const { format, includeLegend, highResolution } = settings;

  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) {
    console.warn('No nodes to export');
    return;
  }

  const container = document.querySelector('.react-flow') as HTMLElement;
  if (!container) {
    console.error('ReactFlow container not found');
    return;
  }

  const dateStr = getDateStr();
  const exportFn = getExportFunction(format);
  const extension = getFileExtension(format);

  // Pixel ratio for high resolution (2x for retina/print)
  const pixelRatio = highResolution ? 2 : 1;

  try {
    // Capture the container as-is (WYSIWYG)
    const rect = container.getBoundingClientRect();
    const imageOptions = {
      backgroundColor: themeColors.exportBackground,
      width: rect.width,
      height: rect.height,
      pixelRatio,
      quality: 0.92, // For JPEG
      skipFonts: true,
      filter: createExportFilter(!includeLegend),
    };

    const dataUrl = await exportFn(container, imageOptions);
    downloadImage(dataUrl, `${title}-${dateStr}.${extension}`);
  } catch (error) {
    console.error('Failed to export graph:', error);
    throw error;
  }
}
