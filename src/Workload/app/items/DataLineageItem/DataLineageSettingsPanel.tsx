/**
 * DataLineageSettingsPanel
 *
 * Settings panel for configuring the Data Lineage item.
 * Opened via Fabric's panel.open() API from the Ribbon Settings button.
 *
 * Tabs:
 * - Connection: GraphQL endpoint, sample data toggle
 * - Data Model: Classification patterns (Dimension, Fact, etc.), exclude patterns
 * - Preferences: UI preferences, focus schemas
 *
 * Following MS Fabric UX guidelines with TabList component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Field,
  Text,
  Spinner,
  Badge,
  Divider,
  Switch,
  TabList,
  Tab,
  SelectTabData,
  SelectTabEvent,
  makeStyles,
  tokens,
  Tooltip,
  Dropdown,
  Option,
} from '@fluentui/react-components';
import {
  Settings24Regular,
  Dismiss24Regular,
  Dismiss16Regular,
  PlugConnected24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  ArrowSyncCircle24Regular,
  DataTreemap24Regular,
  Options24Regular,
  Add24Regular,
  Delete24Regular,
  Save24Regular,
  Filter24Regular,
  // Shape icons for data model types (Regular = outline, Filled = solid)
  Circle24Regular,
  Square24Regular,
  Square24Filled,
  Diamond24Regular,
  Diamond24Filled,
  Triangle24Regular,
  Triangle24Filled,
  Hexagon24Regular,
  Hexagon24Filled,
  Star24Regular,
  Star24Filled,
} from '@fluentui/react-icons';
import { PageProps, ContextProps } from '../../App';
import { callPanelClose } from '../../controller/PanelController';
import { callNotificationOpen } from '../../controller/NotificationController';
import { getWorkloadItem, saveWorkloadItem, ItemWithDefinition } from '../../controller/ItemCRUDController';
import { NotificationType } from '@ms-fabric/workload-client';
import { createLineageService, GraphQLTestResult, DEFAULT_GRAPHQL_ENDPOINT } from './LineageService';
import {
  DataLineageItemDefinition,
  DataModelIcon,
  EdgeType,
  DEFAULT_DEFINITION,
  DEFAULT_DATA_MODEL_TYPES,
  DEFAULT_PREFERENCES,
  AVAILABLE_ICONS,
  AVAILABLE_EDGE_TYPES,
  mergeWithDefaults,
} from './DataLineageItemDefinition';

/**
 * Icon component map for rendering shape icons
 * Uses filled icons for all types except Circle (Other = outline only)
 */
const ICON_COMPONENTS: Record<DataModelIcon, React.ComponentType> = {
  Circle: Circle24Regular,  // Other type stays outline
  Square: Square24Filled,
  Diamond: Diamond24Filled,
  Triangle: Triangle24Filled,
  Hexagon: Hexagon24Filled,
  Star: Star24Filled,
};

/**
 * Outline icons for dropdown options (to show all options consistently)
 */
const ICON_COMPONENTS_OUTLINE: Record<DataModelIcon, React.ComponentType> = {
  Circle: Circle24Regular,
  Square: Square24Regular,
  Diamond: Diamond24Regular,
  Triangle: Triangle24Regular,
  Hexagon: Hexagon24Regular,
  Star: Star24Regular,
};

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: '620px',  // Ensure tabs don't truncate
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    padding: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForegroundOnBrand,
  },
  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  tabList: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalL,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingVerticalL,
  },
  section: {
    marginBottom: tokens.spacingVerticalXL,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  urlInput: {
    width: '100%',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  buttonRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  statusCard: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalM,
  },
  statusSuccess: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  statusError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS,
  },
  infoBox: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalM,
  },
  infoText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  footer: {
    padding: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  // Data Model tab styles
  typeCard: {
    marginBottom: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  typeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  typeNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  iconSwatch: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground1,
  },
  iconDropdown: {
    minWidth: '120px',
  },
  typeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
  },
  patternsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  patternBadge: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
  },
  // Preferences tab styles
  preferenceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  preferenceLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
});

type SettingsTab = 'connection' | 'dataModel' | 'preferences';

export function DataLineageSettingsPanel({ workloadClient }: PageProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const pageContext = useParams<ContextProps>();

  // Tab state
  const [selectedTab, setSelectedTab] = useState<SettingsTab>('connection');

  // Item state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [item, setItem] = useState<ItemWithDefinition<DataLineageItemDefinition> | null>(null);
  const [definition, setDefinition] = useState<DataLineageItemDefinition>(DEFAULT_DEFINITION);
  const [hasChanges, setHasChanges] = useState(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<GraphQLTestResult | null>(null);

  // Load item on mount
  useEffect(() => {
    async function loadItem() {
      if (pageContext.itemObjectId) {
        try {
          const loadedItem = await getWorkloadItem<DataLineageItemDefinition>(
            workloadClient,
            pageContext.itemObjectId,
            DEFAULT_DEFINITION
          );

          const merged = mergeWithDefaults(loadedItem.definition || {});

          setItem(loadedItem);
          setDefinition(merged);

          // Warm-up: Fire-and-forget query to wake up SQL database
          if (!merged.useSampleData && merged.graphqlEndpoint) {
            createLineageService(workloadClient, merged.graphqlEndpoint)
              .getSources()
              .catch(() => {});
          }
        } catch (error) {
          console.error('Failed to load item for settings:', error);
          setDefinition(DEFAULT_DEFINITION);
        }
      }
      setIsLoading(false);
    }
    loadItem();
  }, [pageContext.itemObjectId, workloadClient]);

  // Handle tab change
  const handleTabSelect = useCallback((event: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as SettingsTab);
  }, []);

  // Update definition helper
  const updateDefinition = useCallback((updates: Partial<DataLineageItemDefinition>) => {
    setDefinition(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // Update preferences helper
  const updatePreferences = useCallback((updates: Partial<typeof DEFAULT_PREFERENCES>) => {
    setDefinition(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...updates },
    }));
    setHasChanges(true);
  }, []);

  // Update data model config helper
  const updateDataModelConfig = useCallback((updates: Partial<DataLineageItemDefinition['dataModelConfig']>) => {
    setDefinition(prev => ({
      ...prev,
      dataModelConfig: { ...prev.dataModelConfig, ...updates },
    }));
    setHasChanges(true);
  }, []);

  // Close panel
  const handleClose = useCallback(async () => {
    await callPanelClose(workloadClient);
  }, [workloadClient]);

  // Test connection
  const handleTestConnection = useCallback(async () => {
    const endpoint = definition.graphqlEndpoint?.trim() || DEFAULT_GRAPHQL_ENDPOINT;

    setIsTesting(true);
    setTestResult(null);

    try {
      const service = createLineageService(workloadClient, endpoint);
      const result = await service.testConnectionWithDetails();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTesting(false);
    }
  }, [definition.graphqlEndpoint, workloadClient]);

  // Save settings
  const handleSave = useCallback(async () => {
    if (!item) {
      callNotificationOpen(
        workloadClient,
        t('Settings_Error'),
        t('Settings_NoItem'),
        NotificationType.Error,
        undefined
      );
      return;
    }

    setIsSaving(true);

    try {
      await saveWorkloadItem<DataLineageItemDefinition>(workloadClient, {
        ...item,
        definition,
      });

      // Small delay to ensure Fabric has committed the change (eventual consistency)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set sessionStorage flag to notify Editor (works across iframe boundaries)
      sessionStorage.setItem('lineage-settings-saved', pageContext.itemObjectId || 'demo');

      setHasChanges(false);
      callNotificationOpen(
        workloadClient,
        t('Settings_Saved'),
        t('Settings_SavedMessage'),
        undefined,
        undefined
      );
      await handleClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      callNotificationOpen(
        workloadClient,
        t('Settings_Error'),
        t('Settings_SaveError'),
        NotificationType.Error,
        undefined
      );
    } finally {
      setIsSaving(false);
    }
  }, [item, definition, workloadClient, t, handleClose]);

  // Reset preferences to defaults
  const handleResetPreferences = useCallback(() => {
    setDefinition(prev => ({
      ...prev,
      preferences: DEFAULT_PREFERENCES,
    }));
    setHasChanges(true);
  }, []);

  // Render Connection Tab
  const renderConnectionTab = () => (
    <>
      {/* Demo Mode Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <DataTreemap24Regular />
          <Text weight="semibold" size={400}>
            {t('Settings_DataSource')}
          </Text>
        </div>

        <div className={styles.fieldGroup}>
          <Field
            label={t('Settings_DemoMode')}
            hint={t('Settings_DemoModeHint')}
          >
            <Switch
              checked={definition.useSampleData ?? false}
              onChange={(_, data) => updateDefinition({ useSampleData: data.checked })}
              label={definition.useSampleData ? 'On - Using sample data' : 'Off - Using GraphQL'}
            />
          </Field>
        </div>
      </div>

      <Divider />

      {/* GraphQL Connection Section */}
      <div className={styles.section} style={{ opacity: definition.useSampleData ? 0.5 : 1 }}>
        <div className={styles.sectionTitle}>
          <PlugConnected24Regular />
          <Text weight="semibold" size={400}>
            {t('Settings_GraphQL')}
          </Text>
          {testResult && (
            <Badge
              appearance="filled"
              color={testResult.success ? 'success' : 'danger'}
              size="small"
            >
              {testResult.success ? 'Connected' : 'Error'}
            </Badge>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <Field
            label={t('Settings_GraphQLEndpoint')}
            hint={definition.useSampleData
              ? t('Settings_GraphQLDisabledHint')
              : t('Settings_GraphQLHint')}
          >
            <Input
              className={styles.urlInput}
              placeholder="https://...graphql.fabric.microsoft.com/v1/workspaces/.../graphqlapis/.../graphql"
              value={definition.graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT}
              onChange={(_, data) => updateDefinition({ graphqlEndpoint: data.value })}
              disabled={definition.useSampleData}
            />
          </Field>

          <div className={styles.buttonRow}>
            <Button
              appearance="primary"
              icon={isTesting ? <Spinner size="tiny" /> : <ArrowSyncCircle24Regular />}
              onClick={handleTestConnection}
              disabled={isTesting || definition.useSampleData}
            >
              {isTesting ? t('Settings_Testing') : t('Settings_TestConnection')}
            </Button>
          </div>

          {/* Connection Result */}
          {testResult && (
            <div className={`${styles.statusCard} ${testResult.success ? styles.statusSuccess : styles.statusError}`}>
              <div className={styles.statusRow}>
                {testResult.success ? (
                  <CheckmarkCircle24Regular primaryFill={tokens.colorPaletteGreenForeground1} />
                ) : (
                  <ErrorCircle24Regular primaryFill={tokens.colorPaletteRedForeground1} />
                )}
                <Text weight="semibold">
                  {testResult.success ? t('Settings_Connected') : t('Settings_ConnectionFailed')}
                </Text>
              </div>
              <Text size={200}>
                {testResult.message}
              </Text>
              {testResult.error && (
                <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: tokens.spacingVerticalXS }}>
                  {testResult.error}
                </Text>
              )}
              {testResult.availableTypes && testResult.availableTypes.length > 0 && (
                <Text size={200} style={{ marginTop: tokens.spacingVerticalXS }}>
                  {t('Settings_AvailableTables')} {testResult.availableTypes.join(', ')}
                </Text>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className={styles.infoBox}>
            <Text weight="semibold" size={200}>
              {t('Settings_HowToConnect')}
            </Text>
            <ol style={{ margin: '8px 0 0 16px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 }}>
              <li>{t('Settings_Step1')}</li>
              <li>{t('Settings_Step2')}</li>
              <li>{t('Settings_Step3')}</li>
              <li>{t('Settings_Step4')}</li>
              <li>{t('Settings_Step5')}</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );

  // Render Data Model Tab
  const renderDataModelTab = () => {
    const types = definition.dataModelConfig?.types || DEFAULT_DATA_MODEL_TYPES;
    // Separate default type from user-defined types
    const defaultType = types.find(t => t.isDefault);
    const userTypes = types.filter(t => !t.isDefault);

    return (
      <>
        {/* Classification Types Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <DataTreemap24Regular />
            <Text weight="semibold" size={400}>
              {t('Settings_ClassificationTypes')}
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
            {t('Settings_ClassificationDesc')}
          </Text>

          <div className={styles.fieldGroup}>
            {/* User-defined types */}
            {userTypes.map((type, index) => {
              const IconComponent = ICON_COMPONENTS[type.icon] || Circle24Regular;
              return (
                <div key={type.name + index} className={styles.typeCard}>
                  <div className={styles.typeHeader}>
                    <div className={styles.typeNameRow}>
                      <div className={styles.iconSwatch}>
                        <IconComponent />
                      </div>
                      <Input
                        value={type.name}
                        onChange={(_, data) => {
                          const newTypes = [...types];
                          const actualIndex = types.findIndex(t => t === type);
                          newTypes[actualIndex] = { ...type, name: data.value };
                          updateDataModelConfig({ types: newTypes });
                        }}
                        style={{ fontWeight: tokens.fontWeightSemibold, maxWidth: '150px' }}
                      />
                    </div>
                    <Tooltip content={t('Settings_DeleteType')} relationship="label">
                      <Button
                        appearance="subtle"
                        icon={<Delete24Regular />}
                        size="small"
                        onClick={() => {
                          const newTypes = types.filter(t => t !== type);
                          updateDataModelConfig({ types: newTypes });
                        }}
                      />
                    </Tooltip>
                  </div>

                  <Field
                    label={t('Settings_Patterns')}
                    hint={t('Settings_PatternsHint')}
                    style={{ marginTop: tokens.spacingVerticalS }}
                  >
                    <Input
                      value={type.patterns.join('; ')}
                      onChange={(_, data) => {
                        const newTypes = [...types];
                        const actualIndex = types.findIndex(t => t === type);
                        newTypes[actualIndex] = {
                          ...type,
                          patterns: data.value.split(';').map(p => p.trim()).filter(p => p),
                        };
                        updateDataModelConfig({ types: newTypes });
                      }}
                    />
                  </Field>

                  <div className={styles.typeRow}>
                    <Field label={t('Settings_Icon')}>
                      <Dropdown
                        className={styles.iconDropdown}
                        value={type.icon}
                        selectedOptions={[type.icon]}
                        onOptionSelect={(_, data) => {
                          const newTypes = [...types];
                          const actualIndex = types.findIndex(t => t === type);
                          newTypes[actualIndex] = { ...type, icon: data.optionValue as DataModelIcon };
                          updateDataModelConfig({ types: newTypes });
                        }}
                      >
                        {AVAILABLE_ICONS.map(iconName => {
                          const Icon = ICON_COMPONENTS_OUTLINE[iconName];
                          return (
                            <Option key={iconName} value={iconName} text={iconName}>
                              <Icon /> {iconName}
                            </Option>
                          );
                        })}
                      </Dropdown>
                    </Field>
                  </div>
                </div>
              );
            })}

            {/* Default "Other" type - non-deletable */}
            {defaultType && (
              <div className={styles.typeCard} style={{ opacity: 0.8 }}>
                <div className={styles.typeHeader}>
                  <div className={styles.typeNameRow}>
                    <div className={styles.iconSwatch}>
                      {React.createElement(ICON_COMPONENTS[defaultType.icon] || Circle24Regular)}
                    </div>
                    <Text weight="semibold">{defaultType.name}</Text>
                    <Badge appearance="outline" size="small" color="informative">
                      {t('Settings_Default')}
                    </Badge>
                  </div>
                </div>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
                  {t('Settings_DefaultDesc')}
                </Text>
                <div className={styles.typeRow}>
                  <Field label={t('Settings_Icon')}>
                    <Dropdown
                      className={styles.iconDropdown}
                      value={defaultType.icon}
                      selectedOptions={[defaultType.icon]}
                      onOptionSelect={(_, data) => {
                        const newTypes = types.map(t =>
                          t.isDefault ? { ...t, icon: data.optionValue as DataModelIcon } : t
                        );
                        updateDataModelConfig({ types: newTypes });
                      }}
                    >
                      {AVAILABLE_ICONS.map(iconName => {
                        const Icon = ICON_COMPONENTS_OUTLINE[iconName];
                        return (
                          <Option key={iconName} value={iconName} text={iconName}>
                            <Icon /> {iconName}
                          </Option>
                        );
                      })}
                    </Dropdown>
                  </Field>
                </div>
              </div>
            )}

            <Button
              appearance="subtle"
              icon={<Add24Regular />}
              onClick={() => {
                // Find an unused icon (prefer filled icons, not Circle)
                const usedIcons = types.map(t => t.icon);
                const preferredIcons: DataModelIcon[] = ['Diamond', 'Square', 'Triangle', 'Hexagon', 'Star'];
                const availableIcon = preferredIcons.find(i => !usedIcons.includes(i)) || 'Circle';
                // Insert before the default type
                const newType = { name: 'New Type', patterns: [] as string[], icon: availableIcon as DataModelIcon };
                const newTypes = [...userTypes, newType];
                if (defaultType) newTypes.push(defaultType);
                updateDataModelConfig({ types: newTypes });
              }}
            >
              {t('Settings_AddType')}
            </Button>
          </div>
        </div>

        <Divider />

        {/* Exclude Patterns Section */}
        <div className={styles.section} style={{ marginTop: tokens.spacingVerticalL }}>
          <div className={styles.sectionTitle}>
            <Filter24Regular />
            <Text weight="semibold" size={400}>
              {t('Settings_ExcludePatterns')}
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
            {t('Settings_ExcludeSyntax')}
          </Text>

          <Field
            label={t('Settings_ExcludePatternsLabel')}
            hint={t('Settings_ExcludeHint')}
          >
            <Input
              value={(definition.dataModelConfig?.excludePatterns || []).join('; ')}
              onChange={(_, data) => {
                const patterns = data.value.split(';').map(p => p.trim()).filter(p => p);
                updateDataModelConfig({ excludePatterns: patterns });
              }}
              contentAfter={
                (definition.dataModelConfig?.excludePatterns?.length > 0) && (
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Dismiss16Regular />}
                    onClick={() => updateDataModelConfig({ excludePatterns: [] })}
                    aria-label="Clear all patterns"
                    style={{ minWidth: 'auto', padding: '2px' }}
                  />
                )
              }
              style={{ fontFamily: tokens.fontFamilyMonospace, width: '100%' }}
            />
          </Field>
        </div>
      </>
    );
  };

  // Render Preferences Tab
  const renderPreferencesTab = () => (
    <>
      {/* UI Preferences Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Options24Regular />
          <Text weight="semibold" size={400}>
            {t('Settings_UIPreferences')}
          </Text>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.preferenceRow}>
            <div className={styles.preferenceLabel}>
              <Text weight="semibold">{t('Settings_LayoutDirection')}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {t('Settings_LayoutDirectionDesc')}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
              <Button
                appearance={definition.preferences?.layoutDirection === 'LR' ? 'primary' : 'subtle'}
                onClick={() => updatePreferences({ layoutDirection: 'LR' })}
              >
                LR
              </Button>
              <Button
                appearance={definition.preferences?.layoutDirection === 'TB' ? 'primary' : 'subtle'}
                onClick={() => updatePreferences({ layoutDirection: 'TB' })}
              >
                TB
              </Button>
            </div>
          </div>

          <div className={styles.preferenceRow}>
            <div className={styles.preferenceLabel}>
              <Text weight="semibold">{t('Settings_ShowMinimap')}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {t('Settings_ShowMinimapDesc')}
              </Text>
            </div>
            <Switch
              checked={definition.preferences?.showMinimap ?? true}
              onChange={(_, data) => updatePreferences({ showMinimap: data.checked })}
            />
          </div>

          <div className={styles.preferenceRow}>
            <div className={styles.preferenceLabel}>
              <Text weight="semibold">{t('Settings_ShowControls')}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {t('Settings_ShowControlsDesc')}
              </Text>
            </div>
            <Switch
              checked={definition.preferences?.showControls ?? true}
              onChange={(_, data) => updatePreferences({ showControls: data.checked })}
            />
          </div>

          <div className={styles.preferenceRow}>
            <div className={styles.preferenceLabel}>
              <Text weight="semibold">{t('Settings_EdgeType')}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {t('Settings_EdgeTypeDesc')}
              </Text>
            </div>
            <Dropdown
              value={AVAILABLE_EDGE_TYPES.find(e => e.value === (definition.preferences?.edgeType ?? 'bezier'))?.label ?? 'Curved (Bezier)'}
              selectedOptions={[definition.preferences?.edgeType ?? 'bezier']}
              onOptionSelect={(_, data) => updatePreferences({ edgeType: data.optionValue as EdgeType })}
              style={{ minWidth: '160px' }}
            >
              {AVAILABLE_EDGE_TYPES.map(edge => (
                <Option key={edge.value} value={edge.value} text={edge.label}>
                  {edge.label}
                </Option>
              ))}
            </Dropdown>
          </div>

          <div className={styles.preferenceRow}>
            <div className={styles.preferenceLabel}>
              <Text weight="semibold">{t('Settings_RememberFilters')}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {t('Settings_RememberFiltersDesc')}
              </Text>
            </div>
            <Switch
              checked={definition.preferences?.rememberFilters ?? true}
              onChange={(_, data) => updatePreferences({ rememberFilters: data.checked })}
            />
          </div>

          <div className={styles.preferenceRow}>
            <div className={styles.preferenceLabel}>
              <Text weight="semibold">{t('Settings_DefaultTraceLevels')}</Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {t('Settings_DefaultTraceLevelsDesc')}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
                <Text size={200}>↑</Text>
                <Input
                  type="number"
                  value={String(definition.preferences?.defaultUpstreamLevels ?? 1)}
                  min={1}
                  max={99}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 99) {
                      updatePreferences({ defaultUpstreamLevels: value });
                    }
                  }}
                  style={{ width: '70px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
                <Text size={200}>↓</Text>
                <Input
                  type="number"
                  value={String(definition.preferences?.defaultDownstreamLevels ?? 1)}
                  min={1}
                  max={99}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 99) {
                      updatePreferences({ defaultDownstreamLevels: value });
                    }
                  }}
                  style={{ width: '70px' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.buttonRow}>
        <Button
          appearance="subtle"
          onClick={handleResetPreferences}
        >
          {t('Settings_ResetDefaults')}
        </Button>
      </div>
    </>
  );

  if (isLoading) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Spinner size="large" label={t('Loading')} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <Settings24Regular />
            </div>
            <Text className={styles.title}>
              {t('Settings_Title')}
            </Text>
          </div>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={handleClose}
            aria-label={t('Close')}
          />
        </div>
      </div>

      {/* Tab List */}
      <TabList
        className={styles.tabList}
        selectedValue={selectedTab}
        onTabSelect={handleTabSelect}
      >
        <Tab value="connection" icon={<PlugConnected24Regular />}>
          {t('Settings_Tab_Connection')}
        </Tab>
        <Tab value="dataModel" icon={<DataTreemap24Regular />}>
          {t('Settings_Tab_DataModel')}
        </Tab>
        <Tab value="preferences" icon={<Options24Regular />}>
          {t('Settings_Tab_Preferences')}
        </Tab>
      </TabList>

      {/* Content */}
      <div className={styles.content}>
        {selectedTab === 'connection' && renderConnectionTab()}
        {selectedTab === 'dataModel' && renderDataModelTab()}
        {selectedTab === 'preferences' && renderPreferencesTab()}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Button appearance="subtle" onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <Button
          appearance="primary"
          icon={isSaving ? <Spinner size="tiny" /> : <Save24Regular />}
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? t('Saving') : t('Save')}
        </Button>
      </div>
    </div>
  );
}
