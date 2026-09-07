# Eject Device Changelog

## [Initial Version] - {PR_MERGE_DATE}

- Eject connected iPhones and iPads from Raycast, through Finder's sidebar
- Eject mounted disks, SD cards and disk images through `diskutil`, with no permission needed
- Unmount network shares (SMB, AFP, NFS, WebDAV), which `diskutil` cannot describe
- Distinguish the Automation and Accessibility permissions and link to the right settings pane
- Add "Eject All Disks" for unmounting every ejectable disk at once
- Group the list by kind, with icons that tell a disk image from a card, a stick or a share
- Add a detail panel with capacity, free space, format, connection and mount point
- Remove an ejected row immediately rather than waiting for a reload
- Confirm "Eject All Disks" against the names of everything it is about to touch
- Wait for Finder's sidebar to be ready, so the first eject works rather than the second
- Tell an eject button from an iCloud sync button, so folders never offer to eject
- Classify permission errors by numeric code, so they are recognised in any language
- Add "Diagnose Finder Sidebar", reporting each sidebar row's buttons, to troubleshoot detection
