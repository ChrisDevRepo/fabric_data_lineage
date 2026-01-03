/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the entire application.
 *
 * Usage:
 *   <ErrorBoundary fallbackMessage="Graph failed to load">
 *     <ReactFlow ... />
 *   </ErrorBoundary>
 */

import React, { Component, ReactNode } from 'react';
import { Button, Text, tokens } from '@fluentui/react-components';
import { ErrorCircle24Regular, ArrowClockwise24Regular } from '@fluentui/react-icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Message shown when error occurs */
  fallbackMessage?: string;
  /** Optional custom fallback component */
  fallback?: ReactNode;
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback takes precedence
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI using Fabric tokens
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: tokens.spacingVerticalXXL,
            gap: tokens.spacingVerticalM,
            height: '100%',
            minHeight: '200px',
            textAlign: 'center',
            background: `var(--colorNeutralBackground2)`,
          }}
        >
          <ErrorCircle24Regular
            style={{
              fontSize: '48px',
              color: `var(--colorPaletteRedForeground1)`,
            }}
          />
          <Text
            size={400}
            weight="semibold"
            style={{ color: `var(--colorNeutralForeground1)` }}
          >
            {this.props.fallbackMessage || 'Something went wrong'}
          </Text>
          {this.state.error && (
            <Text
              size={200}
              style={{
                color: `var(--colorNeutralForeground3)`,
                maxWidth: '400px',
              }}
            >
              {this.state.error.message}
            </Text>
          )}
          <Button
            appearance="primary"
            icon={<ArrowClockwise24Regular />}
            onClick={this.handleRetry}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
