/**
 * DataLineageItem Ribbon
 *
 * Single Home tab with all actions (per user preference).
 * MS Fabric requires Home tab to exist and be first - additional tabs are optional.
 *
 * Follows Fabric UX Guidelines:
 * - Single ribbon interface
 * - All buttons use "subtle" appearance
 * - Save button is icon-only
 * - Database dropdown after Save for source selection
 * - Export dialog for professional image export
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowSyncCircle24Regular,
  ZoomFit24Regular,
  ArrowMaximize24Regular,
  QuestionCircle24Regular,
  SearchSquare24Regular,
  Database16Regular,
} from '@fluentui/react-icons';
import {
  Dropdown,
  Option,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Ribbon,
  RibbonAction,
  ViewContext,
  createSaveAction,
  createSettingsAction,
} from '../../components/ItemEditor';
import { ExportDialog } from './ExportDialog';
import type { ExportSettings } from './exportUtils';
import { VwSource } from './LineageService';

const useStyles = makeStyles({
  databaseDropdownContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  databaseDropdown: {
    minWidth: '200px',
    maxWidth: '280px',
    // Compact dropdown styling
    '& button': {
      minHeight: '24px',
      paddingTop: '2px',
      paddingBottom: '2px',
      paddingLeft: tokens.spacingHorizontalS,
      paddingRight: tokens.spacingHorizontalS,
      fontSize: tokens.fontSizeBase200,
    },
  },
  databaseLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'nowrap',
  },
  extraActionsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginLeft: tokens.spacingHorizontalS,
  },
});

interface DataLineageItemRibbonProps {
  viewContext: ViewContext;
  isSaveEnabled: boolean;
  onSave: () => Promise<void>;
  onSettings: () => Promise<void>;
  onRefresh: () => void;
  onFitView?: () => void;
  onExpand?: () => void;
  onDetailSearch?: () => void;
  onExportImage?: (settings: ExportSettings) => void;
  onHelp?: () => void;
  // Database selector props
  sources?: VwSource[];
  activeSourceId?: number;
  onDatabaseChange?: (sourceId: number) => void;
  isLoadingSources?: boolean;
}

export function DataLineageItemRibbon({
  viewContext,
  isSaveEnabled,
  onSave,
  onSettings,
  onRefresh,
  onFitView,
  onExpand,
  onDetailSearch,
  onExportImage,
  onHelp,
  sources = [],
  activeSourceId,
  onDatabaseChange,
  isLoadingSources = false,
}: DataLineageItemRibbonProps) {
  const { t } = useTranslation();
  const styles = useStyles();

  // Check if we're in the graph view
  const isGraphView = viewContext.currentView === 'default';

  // Find active source name
  const activeSource = sources.find(s => s.source_id === activeSourceId);
  const activeSourceName = activeSource?.database_name || '';

  // Handle dropdown selection
  const handleDatabaseSelect = (_: unknown, data: { optionValue?: string }) => {
    if (data.optionValue && onDatabaseChange) {
      const sourceId = parseInt(data.optionValue, 10);
      if (!isNaN(sourceId)) {
        onDatabaseChange(sourceId);
      }
    }
  };

  // ============================================
  // HOME TAB - All actions in single tab
  // ============================================
  const homeToolbarActions: RibbonAction[] = [
    createSaveAction(onSave, !isSaveEnabled),
    createSettingsAction(onSettings),
    {
      key: 'refresh',
      icon: ArrowSyncCircle24Regular,
      label: t('Refresh'),
      onClick: onRefresh,
      testId: 'ribbon-refresh-btn',
    },
    // Graph view actions (only shown when in graph view)
    ...(isGraphView ? [
      {
        key: 'fitView',
        icon: ZoomFit24Regular,
        label: t('FitView'),
        onClick: onFitView || (() => {}),
        testId: 'ribbon-fitview-btn',
      },
      {
        key: 'expand',
        icon: ArrowMaximize24Regular,
        label: t('Expand'),
        onClick: onExpand || (() => {}),
        testId: 'ribbon-expand-btn',
      },
      {
        key: 'detailSearch',
        icon: SearchSquare24Regular,
        label: t('DetailSearch'),
        onClick: onDetailSearch || (() => {}),
        testId: 'ribbon-detailsearch-btn',
      },
      // Note: Export button moved to ExportDialog component (rendered separately)
    ] : []),
    {
      key: 'help',
      icon: QuestionCircle24Regular,
      label: t('Help'),
      onClick: onHelp || (() => {}),
      testId: 'ribbon-help-btn',
    },
  ];

  // Render database dropdown (only if sources are available)
  const renderDatabaseDropdown = () => {
    if (sources.length === 0 && !isLoadingSources) {
      return null; // No sources, no dropdown
    }

    return (
      <div className={styles.databaseDropdownContainer}>
        <span className={styles.databaseLabel}>
          <Database16Regular />
          {t('Database')}:
        </span>
        {isLoadingSources ? (
          <Spinner size="tiny" />
        ) : (
          <Dropdown
            className={styles.databaseDropdown}
            value={activeSourceName}
            selectedOptions={activeSourceId ? [String(activeSourceId)] : []}
            onOptionSelect={handleDatabaseSelect}
            data-testid="ribbon-database-dropdown"
          >
            {sources.map(source => (
              <Option
                key={source.source_id}
                value={String(source.source_id)}
              >
                {source.database_name}
              </Option>
            ))}
          </Dropdown>
        )}
      </div>
    );
  };

  return (
    <div className="data-lineage-ribbon-wrapper">
      {/* Database dropdown positioned in the ribbon header area */}
      <div className="data-lineage-ribbon-database">
        {renderDatabaseDropdown()}
        {/* Export dialog - only shown in graph view */}
        {isGraphView && onExportImage && (
          <div className={styles.extraActionsContainer}>
            <ExportDialog onExport={onExportImage} />
          </div>
        )}
      </div>
      <Ribbon
        homeToolbarActions={homeToolbarActions}
        additionalToolbars={[]}
        viewContext={viewContext}
      />
    </div>
  );
}
