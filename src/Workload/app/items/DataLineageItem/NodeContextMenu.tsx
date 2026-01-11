/**
 * NodeContextMenu Component
 * Right-click context menu for lineage nodes
 * Uses FluentUI v9 MenuList for Fabric UX compliance
 */

import React, { useEffect, useRef } from 'react';
import {
  MenuList,
  MenuItem,
  MenuDivider,
} from '@fluentui/react-components';
import {
  BranchFork24Regular,
  Code24Regular,
  Info24Regular,
} from '@fluentui/react-icons';

export interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  schemaName: string;
  onStartTrace: () => void;
  onShowDetails?: () => void;
  onShowSql?: () => void;
  isTraceModeActive?: boolean;
  hasSql?: boolean;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeName,
  schemaName,
  onStartTrace,
  onShowDetails,
  onShowSql,
  isTraceModeActive,
  hasSql,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close on the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close menu on ESC key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 250;
    const menuHeight = 150;
    const padding = 10;

    let adjustedX = x;
    let adjustedY = y;

    // Check if menu would overflow right edge
    if (x + menuWidth + padding > window.innerWidth) {
      adjustedX = x - menuWidth;
    }

    // Check if menu would overflow bottom edge
    if (y + menuHeight + padding > window.innerHeight) {
      adjustedY = y - menuHeight;
    }

    return { x: adjustedX, y: adjustedY };
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="node-context-menu"
      style={{
        position: 'fixed',
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: 1000,
      }}
    >
      <MenuList>
        {/* Header showing node name */}
        <div className="node-context-menu__header">
          <span className="node-context-menu__schema">{schemaName}</span>
          <span className="node-context-menu__name">{nodeName}</span>
        </div>

        <MenuDivider />

        {/* Start Trace - only available when not in trace mode */}
        {!isTraceModeActive && (
          <MenuItem
            icon={<BranchFork24Regular />}
            onClick={() => {
              onStartTrace();
              onClose();
            }}
          >
            Trace lineage from here
          </MenuItem>
        )}

        {/* Show SQL (if available) */}
        {hasSql && onShowSql && (
          <MenuItem
            icon={<Code24Regular />}
            onClick={() => {
              onShowSql();
              onClose();
            }}
          >
            View SQL definition
          </MenuItem>
        )}

        {/* Show Details */}
        {onShowDetails && (
          <MenuItem
            icon={<Info24Regular />}
            onClick={() => {
              onShowDetails();
              onClose();
            }}
          >
            View details
          </MenuItem>
        )}
      </MenuList>
    </div>
  );
}
