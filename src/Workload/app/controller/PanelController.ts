// --- Panel API

import { CloseMode, WorkloadClientAPI } from "@ms-fabric/workload-client";

// Standard panel width for settings panels with complex forms and tabs
const PANEL_WIDTH_WIDE = 640;

/**
 * Calls the 'panel.open' function from the WorkloadClientAPI to open a panel.
 *
 * @param {string} workloadName - The name of the workload responsible for the panel.
 * @param {string} path - The path or route within the workload to open.
 * @param {boolean} isLightDismiss - Whether the panel can be dismissed by clicking outside (light dismiss).
 * @param {WorkloadClientAPI} workloadClient - An instance of the WorkloadClientAPI.
 * @param {number} width - Optional custom width for the panel. Defaults to 1/3 of window width.
 */
export async function callPanelOpen(
    workloadClient: WorkloadClientAPI,
    workloadName: string,
    path: string,
    isLightDismiss: boolean,
    width?: number) {

    await workloadClient.panel.open({
        workloadName,
        route: { path },
        options: {
            width: width ?? window.innerWidth / 3,
            isLightDismiss
        }
    });
}

/**
 * Opens a settings panel with appropriate width for complex forms with tabs.
 * Uses PANEL_WIDTH_WIDE (640px) to ensure tabs and content don't truncate.
 */
export async function callSettingsPanelOpen(
    workloadClient: WorkloadClientAPI,
    workloadName: string,
    path: string) {

    await workloadClient.panel.open({
        workloadName,
        route: { path },
        options: {
            width: PANEL_WIDTH_WIDE,
            isLightDismiss: true
        }
    });
}

/**
 * Opens a full-width panel for search experience.
 * Uses full screen width to provide same visual as a page while using reliable panel.open API.
 * This works in dev mode where page.open may fail.
 */
export async function callSearchPanelOpen(
    workloadClient: WorkloadClientAPI,
    workloadName: string,
    path: string) {

    await workloadClient.panel.open({
        workloadName,
        route: { path },
        options: {
            width: window.innerWidth,
            isLightDismiss: false
        }
    });
}

/**
 * Calls the 'panel.close' function from the WorkloadClientAPI to close a panel.
 *
 * @param {WorkloadClientAPI} workloadClient - An instance of the WorkloadClientAPI.
 */
export async function callPanelClose(workloadClient: WorkloadClientAPI) {
    await workloadClient.panel.close({ mode: CloseMode.PopOne });
}