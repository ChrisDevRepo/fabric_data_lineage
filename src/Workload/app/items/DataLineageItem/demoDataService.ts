/**
 * Demo Data Service
 *
 * Fetches pre-generated demo data from static JSON file.
 * Used when useSampleData=true in settings.
 *
 * This provides a working demo experience without any database
 * or GraphQL connection configured.
 */

import { DataNode } from './types';

// Demo source ID (must match generator script)
export const DEMO_SOURCE_ID = 999;

// Path to static demo data JSON
const DEMO_DATA_PATH = '/assets/demo-data.json';

// Cache for demo data (avoid refetching)
let cachedDemoData: DataNode[] | null = null;

/**
 * Fetch demo data from static JSON file
 * Returns cached data if available
 */
export async function fetchDemoData(): Promise<DataNode[]> {
  if (cachedDemoData) {
    return cachedDemoData;
  }

  try {
    const response = await fetch(DEMO_DATA_PATH);

    if (!response.ok) {
      throw new Error(`Failed to fetch demo data: ${response.status} ${response.statusText}`);
    }

    const data: DataNode[] = await response.json();
    cachedDemoData = data;
    return data;
  } catch (error) {
    console.error('Failed to load demo data:', error);
    throw new Error(
      `Could not load demo data from ${DEMO_DATA_PATH}. ` +
        'Make sure the file exists in app/assets/demo-data.json'
    );
  }
}

/**
 * Clear cached demo data (for testing)
 */
export function clearDemoCache(): void {
  cachedDemoData = null;
}

/**
 * Check if a source ID indicates demo mode
 */
export function isDemoSource(sourceId?: number): boolean {
  return sourceId === DEMO_SOURCE_ID;
}

/**
 * Demo source info (for database dropdown)
 */
export const DEMO_SOURCE = {
  source_id: DEMO_SOURCE_ID,
  database_name: 'Demo Enterprise DW',
  description: 'Demo data - no database connection required',
  is_active: true,
  created_at: new Date().toISOString(),
};
