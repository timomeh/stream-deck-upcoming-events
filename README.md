# Upcoming Events for Stream Deck

_macOS only_

A plugin for Elgato's Stream Deck to show the next calendar event on a key, and when you press the key, it opens Google Meet or Zoom or any video call connected to the event. Only shows the next event when it is about to start soon. Only for macOS.

Uses macOS' native calendar integration. It works with any events that are connected to your Calendar.app.

## Install

1. [Download the latest version](https://github.com/timomeh/stream-deck-upcoming-events/releases/latest)
2. Double-click to install

## Usage

### Behavior

- Checks for upcoming events every 30 seconds.
- When an event is about to start, it shows the start time and title of the event on the key. Clicking the key will open the first link in the event's description, which is often a link to a meeting.
- When no event is about to start, it shows a static image, which you can override. Clicking the key will re-check upcoming events.

### Screenshots

![](/.github/upcoming.png)
![](/.github/idle.png)

### Configuration

- **Wake before** (in minutes) allows you to configure when the key should start to show the next event. Default: 10
- **Sleep after** (in minutes) allows you to configure when the key shouldn't anymore show the next event after it started. Default: 10

## Development

1. Install dependencies: `pnpm install`
2. Link the plugin to Stream Deck: `pnpm deck:link`
3. Start dev: `pnpm dev`

## Releasing

1. Bump `manifest.json`
2. Create a new tag name with the version in the manifest: `vX.Y.Z.B`
3. Let GitHub Action create, build and upload the new release
4. Update release notes

## License

Unlicensed. 2024 Timo Mämecke
