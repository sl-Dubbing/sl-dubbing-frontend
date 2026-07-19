# js/tts/ — TTS Studio JavaScript Modules

## Overview
Modular JavaScript files for the standalone Text-to-Speech studio page (`tts.html`). Covers state, UI modes, audio player, voice selection, generation, and recent works history.

## Files

| File | Purpose |
|------|---------|
| `01-state.js` | TTS page state management |
| `02-helpers.js` | TTS utility functions |
| `03-ui-modes.js` | UI mode toggling (quick vs studio) |
| `04-player.js` | Audio playback player |
| `05-stt.js` | Speech-to-Text (upload audio for transcription) |
| `06-lang-picker.js` | Language selection for TTS |
| `07-voice.js` | Voice selection and management |
| `08-generate.js` | TTS generation trigger + API call |
| `09-recent-works.js` | Recent TTS history list |
| `10-input-toolbar.js` | Text input toolbar (formatting, clear) |
| `11-voice-save-modal.js` | Save generated voice modal |
| `99-init.js` | TTS page initialization |

## Notes
- Supports two modes: `quick` (Edge TTS, synchronous) and `modal` (Modal GPU, async)
- Audio player supports streaming playback
- STT feature allows uploading audio for speech recognition
