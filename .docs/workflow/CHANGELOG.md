# Changelog

## 2026-03-22

- Fixed `prompts.updatePrompt` authorization to enforce both prompt ownership and active organization match before updates.
- Added focused unit tests for prompt update access outcomes: not found, wrong user, wrong org, and success.
- Added day-shift follow-up TODOs for `canEdit` and `deletePrompt` authorization consistency.
- Normalized update not-found error copy to include the prompt id for easier debugging and support.
