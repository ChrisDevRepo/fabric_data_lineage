import React from "react";
import { Route, Router, Switch } from "react-router-dom";
import { History } from "history";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { DataLineageItemEditor } from "./items/DataLineageItem";
import { DataLineageItemExpandedView } from "./items/DataLineageItem/DataLineageItemExpandedView";
import { DataLineageHelpPanel } from "./items/DataLineageItem/DataLineageHelpPanel";
import { DataLineageSettingsPanel } from "./items/DataLineageItem/DataLineageSettingsPanel";
import { DataLineageSearchPage } from "./items/DataLineageItem/DataLineageSearchPage";

/*
    Add your Item Editor in the Route section of the App function below
*/

interface AppProps {
    history: History;
    workloadClient: WorkloadClientAPI;
}

export interface PageProps {
    workloadClient: WorkloadClientAPI;
    history?: History
}

export interface ContextProps {
    itemObjectId?: string;
    workspaceObjectId?: string
    source?: string;
}

export interface SharedState {
    message: string;
}

export function App({ history, workloadClient }: AppProps) {
    return <Router history={history}>
        {/* Test route for debugging */}
        <Route exact path="/">
            <div style={{ padding: '20px', backgroundColor: '#f0f0f0' }}>
                <h1>🎉 Workload is running!</h1>
                <p>Current URL: {window.location.href}</p>
                <p>Workload Name: {process.env.WORKLOAD_NAME}</p>
            </div>
        </Route>    
        <Switch>
            {/* Routings for Data Lineage Item */}
            <Route path="/DataLineageItem-editor/:itemObjectId">
                <DataLineageItemEditor
                    workloadClient={workloadClient} data-testid="DataLineageItem-editor" />
            </Route>
            {/* Demo route for testing without Fabric connection */}
            <Route path="/DataLineageItem-demo">
                <DataLineageItemEditor
                    workloadClient={workloadClient} data-testid="DataLineageItem-demo" />
            </Route>

            {/* Expanded (fullscreen-like) view for Data Lineage */}
            <Route path="/DataLineageItem-expanded/:itemObjectId">
                <DataLineageItemExpandedView
                    workloadClient={workloadClient} data-testid="DataLineageItem-expanded" />
            </Route>

            {/* Help panel for Data Lineage (opened via panel.open from Ribbon) */}
            <Route path="/DataLineageItem-help">
                <DataLineageHelpPanel
                    workloadClient={workloadClient} data-testid="DataLineageItem-help" />
            </Route>

            {/* Settings panel for Data Lineage (opened via panel.open from Ribbon) */}
            {/* Route includes itemObjectId per MS best practices: /{ItemType}Item-settings/{itemId} */}
            <Route path="/DataLineageItem-settings/:itemObjectId">
                <DataLineageSettingsPanel
                    workloadClient={workloadClient} data-testid="DataLineageItem-settings" />
            </Route>

            {/* Detail Search page for Data Lineage (opened via page.open from Ribbon) */}
            <Route path="/DataLineageItem-search/:itemObjectId">
                <DataLineageSearchPage
                    workloadClient={workloadClient} data-testid="DataLineageItem-search" />
            </Route>
        </Switch>
    </Router>;
}