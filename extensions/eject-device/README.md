# Eject Device

Eject a connected iPhone or iPad — and unmount external disks — without opening Finder.

## Why a separate extension

The existing eject extensions all drive `diskutil`, which only sees **mounted volumes**. An
iPhone connected by cable is not one: it never appears in `/Volumes`, never shows up in
`diskutil list`, and Finder does not expose it as a `disk` in AppleScript. Finder talks to it
over its own device protocol and draws it in the sidebar under _Locations_.

So this extension reads from two sources and ejects through whichever one owns the item:

| Item                               | Detected via                   | Ejected via                         |
| ---------------------------------- | ------------------------------ | ----------------------------------- |
| iPhone, iPad, iPod                 | Finder sidebar (accessibility) | Click of the sidebar's eject button |
| External disk, SD card, disk image | `diskutil info -plist`         | `diskutil eject`                    |

Disks therefore work with no special permission at all. Only devices need the permissions below.

## Permissions

macOS gates this behind **two different** permissions, and they fail with different errors, so
the extension tells them apart and offers to open the right pane:

1. **Automation** — Raycast must be allowed to control _Finder_ and _System Events_. macOS
   prompts for this the first time; if it was denied, re-enable it under
   _System Settings → Privacy & Security → Automation_.
2. **Accessibility** — reading and clicking the sidebar is UI scripting. Add Raycast under
   _System Settings → Privacy & Security → Accessibility_.

Nothing leaves your Mac; the extension only runs `osascript`, `diskutil` and `system_profiler`
locally.

## Commands

- **Eject Device** — devices, disks and network shares in one list, grouped by kind. `Enter`
  ejects the selected row and nothing else. `Cmd+Shift+D` opens a detail panel with capacity,
  free space, format, connection and mount point; `Cmd+Enter` reveals a disk in Finder.
- **Eject All Disks** — unmounts every disk, disk image and network share at once, after
  confirming with the names of everything it is about to touch. Leaves devices connected on
  purpose, since ejecting a device pulls Finder forward.
- **Diagnose Finder Sidebar** — dumps what each source reported plus the accessibility tree of
  the Finder window. Use it if a device is not detected; the report is copyable.

## Notes and limits

- **The sidebar lives inside a window.** If no Finder window is open, the extension opens one
  and closes it again afterwards. A window is not usable the instant it exists, so the scripts
  poll for a sidebar that has rows before reading it.
- **Finder only draws the eject arrow on the row under the cursor or the selected one.** A
  positional click on any other row lands on nothing and looks exactly like a click that
  worked, so the eject goes through the button's accessibility action instead, which does not
  care whether the arrow is drawn. If that does not move the device, the row is selected and
  clicked, and finally Finder's own Eject command is used -- each checked before the next, and
  none of them reporting success until the row is seen leaving.
- **Ejecting a device is not required for safety.** Unlike a USB drive, an iPhone can be
  unplugged at any time. The eject button just ends Finder's session with it.
- **A device synced over Wi-Fi** appears in the sidebar and can be ejected, even though it will
  not show on the USB bus.
- **A disk in use will refuse to eject.** `diskutil` reports which process is holding it; the
  failure toast passes that message through.
- **The accessibility tree has changed shape between macOS releases.** The scripts try the known
  layouts first and then fall back to walking the whole window, but a release that moves things
  again will need the diagnose command's output to fix.
- **Not every button in the sidebar ejects.** An iCloud folder such as Desktop or Documents
  carries a sync button, and clicking it evicts local copies of files. Rows are matched on
  carrying a button with a _title_, which is what Finder gives the eject arrow and withholds
  from the sync one. The check is for the title's presence, never its wording, so it holds in
  every language.

## Assets

The AppleScript lives in `assets/` as plain, readable files rather than strings inside the
TypeScript, so it can be inspected and adjusted directly:

- `list-sidebar-items.applescript` — reads the sidebar rows and which carry an eject button.
- `eject-sidebar-item.applescript` — ejects one row by name.
- `dump-sidebar.applescript` — dumps the accessibility tree for the diagnose command.

Names are passed to `osascript` as arguments, never interpolated into the script source.
