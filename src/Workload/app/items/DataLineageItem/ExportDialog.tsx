/**
 * ExportDialog
 *
 * Modal dialog for exporting the lineage graph.
 * Uses FluentUI v9 Dialog component (follows Fabric UX guidelines).
 *
 * Features:
 * - Format: PNG, JPEG
 * - Options: Legend toggle, high resolution
 *
 * Note: Exports current view only (WYSIWYG). "Fit all nodes" removed due to
 * html-to-image edge clipping limitations (GitHub issue xyflow/xyflow#2118).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  RadioGroup,
  Radio,
  Field,
  Checkbox,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowDownload24Regular } from '@fluentui/react-icons';

export type ExportFormat = 'png' | 'jpeg';

export interface ExportSettings {
  format: ExportFormat;
  includeLegend: boolean;
  highResolution: boolean;
}

interface ExportDialogProps {
  onExport: (settings: ExportSettings) => void;
  disabled?: boolean;
}

const useStyles = makeStyles({
  field: {
    marginTop: tokens.spacingVerticalM,
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

export function ExportDialog({ onExport, disabled }: ExportDialogProps) {
  const { t } = useTranslation();
  const styles = useStyles();

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [highResolution, setHighResolution] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    // Small delay to show loading state before export starts
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      onExport({ format, includeLegend, highResolution });
    } finally {
      setIsExporting(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          icon={<ArrowDownload24Regular />}
          disabled={disabled}
        >
          {t('ExportImage')}
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t('ExportGraph')}</DialogTitle>
          <DialogContent>
            <Field label={t('Format')}>
              <RadioGroup
                value={format}
                onChange={(_, data) => setFormat(data.value as ExportFormat)}
              >
                <Radio value="png" label="PNG" />
                <Radio value="jpeg" label="JPEG" />
              </RadioGroup>
            </Field>

            <Field label={t('Options')} className={styles.field}>
              <div className={styles.checkboxGroup}>
                <Checkbox
                  checked={includeLegend}
                  onChange={(_, data) => setIncludeLegend(data.checked as boolean)}
                  label={t('ExportIncludeLegend')}
                />
                <Checkbox
                  checked={highResolution}
                  onChange={(_, data) => setHighResolution(data.checked as boolean)}
                  label={t('ExportHighResolution')}
                />
              </div>
            </Field>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={isExporting}>{t('Cancel')}</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={handleExport} disabled={isExporting}>
              {isExporting ? t('Saving') : t('ExportImage')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
