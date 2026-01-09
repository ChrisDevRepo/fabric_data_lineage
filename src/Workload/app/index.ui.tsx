import { createBrowserHistory } from "history";
import React from "react";
import { createRoot } from 'react-dom/client';

import { FluentProvider } from "@fluentui/react-components";
import { createWorkloadClient, InitParams, ItemTabActionContext } from '@ms-fabric/workload-client';

import { fabricLightTheme } from "./theme";
import { App } from "./App";
import { callGetItem } from "./controller/ItemCRUDController"
import { createLineageService, DEFAULT_GRAPHQL_ENDPOINT } from "./items/DataLineageItem/LineageService";

export async function initialize(params: InitParams) {
    const workloadClient = createWorkloadClient();
    const history = createBrowserHistory();

    // Warm-up: Fire-and-forget query to wake up SQL database early
    createLineageService(workloadClient, DEFAULT_GRAPHQL_ENDPOINT)
        .getSources()
        .catch(() => {}); // Silent failure - warm-up served its purpose

    workloadClient.navigation.onNavigate((route) => {
        history.replace(route.targetUrl);
    });

    workloadClient.action.onAction(async function ({ action, data }) {
        const { id } = data as ItemTabActionContext;
        switch (action) {
            case 'item.tab.onInit':
                try {
                    const itemResult = await callGetItem(workloadClient, id);
                    if (itemResult?.item?.displayName) {
                        return { title: itemResult.item.displayName };
                    }
                    return { title: 'Untitled Item' };
                } catch {
                    return {};
                }
            case 'item.tab.canDeactivate':
                return { canDeactivate: true };
            case 'item.tab.onDeactivate':
                return {};
            case 'item.tab.canDestroy':
                return { canDestroy: true };
            case 'item.tab.onDestroy':
                return {};
            case 'item.tab.onDelete':
                return {};
            default:
                throw new Error('Unknown action received');
        }
    });

    const rootElement = document.getElementById('root');
    if (!rootElement) {
        document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element not found</div>';
        return;
    }

    const root = createRoot(rootElement);
    root.render(
        <FluentProvider theme={fabricLightTheme}>
            <App history={history} workloadClient={workloadClient} />
        </FluentProvider>
    );
}
