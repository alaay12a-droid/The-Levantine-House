---
name: GitHub Actions EAS authentication
description: Safe GitHub Actions setup for EAS builds across separately branded mobile apps.
---

Set `EXPO_TOKEN` in the `env` of every GitHub Actions step that invokes the EAS CLI directly. The Expo GitHub action can validate the account but does not reliably make that token available to later arbitrary `run` steps.

**Why:** A workflow can install and authenticate the Expo action successfully while `eas build` still fails with “An Expo user account is required.” Also, an EAS project belongs to one app identity: reusing a customer project's ID for a driver app fails when their slugs differ.

**How to apply:** Store the token as a GitHub Actions secret, reference it only in build-related step environments, and ensure each mobile app has its own EAS project whose slug matches its app configuration. Use `eas init --account … --non-interactive` once to create or link a missing project, then persist the returned project ID in that app's configuration.