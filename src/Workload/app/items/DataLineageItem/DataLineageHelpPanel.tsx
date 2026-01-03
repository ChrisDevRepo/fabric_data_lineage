/**
 * DataLineageHelpPanel
 *
 * Help panel component for the Data Lineage item.
 * Opened via Fabric's panel.open() API from the Ribbon.
 *
 * Content adapted from legacy InfoModal with shortened descriptions
 * to fit the Fabric panel UX pattern.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Button,
  Link,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ChartMultiple24Regular,
  ArrowMove24Regular,
  Search24Regular,
  Filter24Regular,
  ArrowRight24Regular,
  Code24Regular,
  Dismiss24Regular,
  Settings24Regular,
  PlugConnected24Regular,
} from '@fluentui/react-icons';
import { PageProps } from '../../App';
import { callPanelClose } from '../../controller/PanelController';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
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
  subtitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingVerticalM,
  },
  featureIcon: {
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralBackground3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: tokens.colorNeutralForeground2,
  },
  featureHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  featureContent: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
  },
  footer: {
    padding: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  footerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: tokens.spacingVerticalM,
  },
});

interface DataLineageHelpPanelProps extends PageProps {}

export function DataLineageHelpPanel({ workloadClient }: DataLineageHelpPanelProps) {
  const { t } = useTranslation();
  const styles = useStyles();

  const handleClose = async () => {
    await callPanelClose(workloadClient);
  };

  const features = [
    {
      icon: <ChartMultiple24Regular />,
      title: t('Help_Visualize_Title'),
      content: t('Help_Visualize_Content'),
    },
    {
      icon: <ArrowMove24Regular />,
      title: t('Help_Navigate_Title'),
      content: t('Help_Navigate_Content'),
    },
    {
      icon: <Search24Regular />,
      title: t('Help_Search_Title'),
      content: t('Help_Search_Content'),
    },
    {
      icon: <Filter24Regular />,
      title: t('Help_Filter_Title'),
      content: t('Help_Filter_Content'),
    },
    {
      icon: <ArrowRight24Regular />,
      title: t('Help_Trace_Title'),
      content: t('Help_Trace_Content'),
    },
    {
      icon: <Settings24Regular />,
      title: t('Help_Config_Title'),
      content: t('Help_Config_Content'),
    },
    {
      icon: <PlugConnected24Regular />,
      title: t('Help_DataSource_Title'),
      content: t('Help_DataSource_Content'),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <ChartMultiple24Regular />
            </div>
            <Text className={styles.title}>
              {t('Help_Title')}
            </Text>
          </div>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={handleClose}
            aria-label={t('Close')}
          />
        </div>
        <Text className={styles.subtitle}>
          {t('Help_Subtitle')}
        </Text>
      </div>

      {/* Content - Feature Accordion */}
      <div className={styles.content}>
        <Accordion multiple collapsible defaultOpenItems={['visualize']}>
          {features.map((feature, index) => (
            <AccordionItem key={index} value={feature.title.toLowerCase().replace(/\s+/g, '-')}>
              <AccordionHeader>
                <div className={styles.featureHeader}>
                  <div className={styles.featureIcon}>{feature.icon}</div>
                  <Text weight="semibold">{feature.title}</Text>
                </div>
              </AccordionHeader>
              <AccordionPanel>
                <Text className={styles.featureContent}>{feature.content}</Text>
              </AccordionPanel>
            </AccordionItem>
          ))}

          {/* Developer Section */}
          <AccordionItem value="developer">
            <AccordionHeader>
              <div className={styles.featureHeader}>
                <div className={styles.featureIcon}>
                  <Code24Regular />
                </div>
                <Text weight="semibold">{t('Help_Developer_Title')}</Text>
              </div>
            </AccordionHeader>
            <AccordionPanel>
              <Text className={styles.featureContent}>
                {t('Help_Developer_Content')}
              </Text>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerRow}>
            <Text>{t('Help_CreatedBy')}</Text>
            <Link
              href="https://at.linkedin.com/in/christian-wagner-11aa8614b"
              target="_blank"
              rel="noopener noreferrer"
            >
              Christian Wagner
            </Link>
            <Text>- Data Architect & Engineer</Text>
          </div>
          <div className={styles.footerRow}>
            <Link
              href="https://chwagneraltyca.github.io/fabric-datalineage/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </Link>
            <Text>|</Text>
            <Link
              href="https://chwagneraltyca.github.io/fabric-datalineage/QUICKSTART.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Quick Start
            </Link>
            <Text>|</Text>
            <Link
              href="https://claude.ai/code"
              target="_blank"
              rel="noopener noreferrer"
            >
              Built with Claude Code
            </Link>
          </div>
        </div>
        <div className={styles.footerActions}>
          <Button appearance="primary" onClick={handleClose}>
            {t('Help_GotIt')}
          </Button>
        </div>
      </div>
    </div>
  );
}
