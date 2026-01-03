import { DatahubCompactViewConfig, DatahubCompactViewPageConfig, DatahubHeaderDialogConfig, DatahubSelectorDialogConfig, 
    DatahubSelectorDialogResult, 
    DatahubWizardDialogConfig, 
    DatahubWizardDialogResult, 
    ExtendedItemTypeV2, 
    OnelakeExplorerConfig, 
    OneLakeExplorerPageConfig, 
    OnelakeExplorerType, 
    WorkloadClientAPI } from "@ms-fabric/workload-client";
import { Item } from "../clients/FabricPlatformTypes";

export interface ItemAndPath extends Item {
    selectedPath: string;
}

export async function callDatahubWizardOpen(    
    workloadClient: WorkloadClientAPI,
    supportedTypes: ExtendedItemTypeV2[],
    dialogSubmittButtonName: string,
    dialogDescription: string,    
    multiSelectionEnabled: boolean = false,
    showFilesFolder: boolean = true,
    workspaceNavigationEnabled: boolean = true): Promise<ItemAndPath> {

   const datahubWizardConfig: DatahubWizardDialogConfig = {
        datahubCompactViewPageConfig: {
            datahubCompactViewConfig: {
                supportedTypes: supportedTypes,
                multiSelectionEnabled: multiSelectionEnabled,
                workspaceNavigationEnabled: workspaceNavigationEnabled,
                hostDetails: {
                    experience: 'sample experience 3rd party', // Change this to reflect your team's process, e.g., "Create Shortcut for itemType" 
                    scenario: 'sample scenario 3rd party', // Adjust this to the specific action, e.g., "Select Lakehouse" 
                }
            } as DatahubCompactViewConfig
        } as DatahubCompactViewPageConfig,
        oneLakeExplorerPageConfig: {
            headerDialogConfig: {
                dialogTitle: 'Select Item',
                dialogDescription: dialogDescription,
            } as DatahubHeaderDialogConfig,
            onelakeExplorerConfig: {
                onelakeExplorerTypes: Object.values(OnelakeExplorerType),
                showFilesFolder: showFilesFolder,
            } as OnelakeExplorerConfig,
        } as OneLakeExplorerPageConfig,
        submitButtonName: dialogSubmittButtonName,
    }
 
    const result: DatahubWizardDialogResult = await workloadClient.datahub.openDatahubWizardDialog(datahubWizardConfig);
    if (!result.onelakeExplorerResult) {
        return null;
    }

    const selectedItem = result.onelakeExplorerResult;
    const { itemObjectId, workspaceObjectId } = selectedItem;
    // Note: displayName/description/itemType not exposed in DatahubWizardDialogResult.onelakeExplorerResult
    // These properties are only available in DatahubSelectorDialogResult.selectedDatahubItem.datahubItemUI
    return {
        id: itemObjectId,
        workspaceId: workspaceObjectId,
        type: "Unknown", // Item type not available in wizard result (SDK limitation)
        displayName: "",
        description: "",
        selectedPath: selectedItem.selectedPath.split('/').slice(2).join('/') // Remove the first two segments (workspace and item)
    };
}


/**
 * Opens a OneLake data hub dialog to select Lakehouse item(s).
 * @param workloadClient - WorkloadClientAPI instance
 * @param supportedTypes - Item types supported by the datahub dialog
 * @param dialogDescription - Sub-title of the datahub dialog
 * @param multiSelectionEnabled - Whether multi-selection is enabled
 * @param workspaceNavigationEnabled - Whether workspace navigation bar is shown
 */
export async function callDatahubOpen(
    workloadClient: WorkloadClientAPI,
    supportedTypes: ExtendedItemTypeV2[],
    dialogDescription: string,
    multiSelectionEnabled: boolean,
    
    workspaceNavigationEnabled: boolean = true): Promise<Item> {

    const datahubConfig: DatahubSelectorDialogConfig = {
        supportedTypes: supportedTypes,
        multiSelectionEnabled: multiSelectionEnabled,
        dialogDescription: dialogDescription,
        workspaceNavigationEnabled: workspaceNavigationEnabled,
        // not in use in the regular selector, but required to be non-empty for validation
        hostDetails: {
            experience: 'sample experience 3rd party', // Change this to reflect your team's process, e.g., "Build notebook" 
            scenario: 'sample scenario 3rd party', // Adjust this to the specific action, e.g., "Select Lakehouse" 
        }
    };

    const result: DatahubSelectorDialogResult = await workloadClient.datahub.openDialog(datahubConfig);
    if (!result.selectedDatahubItem) {
        return null;
    }

    const selectedItem = result.selectedDatahubItem[0];
    const { itemObjectId, workspaceObjectId } = selectedItem;
    const { displayName, description } = selectedItem.datahubItemUI;
    return {
        id: itemObjectId,
        workspaceId: workspaceObjectId,
        type: selectedItem.datahubItemUI.itemType,
        displayName,
        description
    };
}