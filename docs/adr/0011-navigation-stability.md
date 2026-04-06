# 11. Navigation Stability via Active Step Tracking

Date: 2026-04-06

## Status

Accepted

## Context

Partial shell updates on navigation can trigger redundant DOM destructions, resulting in flickering and loss of ephemeral UI state (e.g., open dialogs).

## Decision

Shell clients must use `data-active-step` tracking on content containers to identify already-rendered states. If the target `stepId` matches the `data-active-step` attribute, DOM destruction is skipped, and only the `onActivate` hook of the extension is triggered.

## Consequences

*   **Zero Flickering**: Seamless transitions for background service updates.
*   **State Preservation**: Overlays and dialogs remain active during navigation.
*   **Performance**: Skips expensive Alpine initialization for redundant shell calls.
