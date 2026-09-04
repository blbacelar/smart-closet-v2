import React, { Component, ErrorInfo, PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { observability, ObservabilityClient } from '../lib/observability';
import { colors, fonts } from '../theme';

type AppErrorBoundaryProps = PropsWithChildren<{
  observability?: ObservabilityClient;
}>;

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    (this.props.observability ?? observability).captureError(error, {
      operation: 'react_render',
      code: 'unexpected_render_error',
      fatal: true,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View accessible accessibilityRole="alert" style={styles.screen}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Fitly hit an unexpected problem. Your private photos were not included in the report.
        </Text>
        <Pressable
          accessibilityLabel="Try again"
          accessibilityRole="button"
          onPress={() => this.setState({ hasError: false })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 360,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 48,
    minWidth: 140,
    paddingHorizontal: 22,
  },
  buttonText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
