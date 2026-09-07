-- Lists every entry of the Finder sidebar together with whether it carries an
-- eject button. Rows with an eject button are the ones Finder considers
-- ejectable: iPhones, iPads, external disks, disk images and network shares.
--
-- Output: one row per line, "name<TAB>1" (ejectable) or "name<TAB>0".
-- Requires Accessibility permission for Raycast.

on run
	set didOpenWindow to false

	-- The sidebar only exists inside a window. Open one if the user has none,
	-- and close it again at the end so we leave the desktop as we found it.
	tell application "Finder"
		if (count of Finder windows) is 0 then
			make new Finder window
			set didOpenWindow to true
		end if
	end tell

	set outputLines to {}

	tell application "System Events"
		if not (exists process "Finder") then error "Finder is not running."
		tell process "Finder"
			set sidebarOutline to my findSidebarOutline(window 1)
			if sidebarOutline is missing value then error "Could not locate the Finder sidebar."

			repeat with theRow in (rows of sidebarOutline)
				set rowName to my nameOfRow(theRow)
				if rowName is not "" then
					set end of outputLines to rowName & tab & my ejectFlagOfRow(theRow)
				end if
			end repeat
		end tell
	end tell

	if didOpenWindow then
		try
			tell application "Finder" to close front Finder window
		end try
	end if

	set AppleScript's text item delimiters to linefeed
	set theResult to outputLines as text
	set AppleScript's text item delimiters to ""
	return theResult
end run

-- The sidebar sits at a well-known path in every macOS version we know of, but
-- the path has shifted between releases. Try the fast route first, then fall
-- back to walking the window, which is slow but layout-independent.
on findSidebarOutline(theWindow)
	tell application "System Events"
		try
			return outline 1 of scroll area 1 of splitter group 1 of theWindow
		end try
		try
			return outline 1 of scroll area 1 of group 1 of splitter group 1 of theWindow
		end try
		try
			repeat with anElement in (entire contents of theWindow)
				if class of anElement is outline then return anElement
			end repeat
		end try
	end tell
	return missing value
end findSidebarOutline

-- Row labels live one or two levels down depending on the macOS release.
on nameOfRow(theRow)
	tell application "System Events"
		try
			return value of static text 1 of UI element 1 of theRow
		end try
		try
			return value of static text 1 of theRow
		end try
		try
			return name of UI element 1 of theRow
		end try
	end tell
	return ""
end nameOfRow

on ejectFlagOfRow(theRow)
	tell application "System Events"
		try
			if (count of buttons of UI element 1 of theRow) > 0 then return "1"
		end try
		try
			if (count of buttons of theRow) > 0 then return "1"
		end try
	end tell
	return "0"
end ejectFlagOfRow
