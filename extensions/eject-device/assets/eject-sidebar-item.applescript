-- Ejects one entry of the Finder sidebar by name -- the same thing you do by
-- clicking the little eject arrow next to an iPhone, iPad or disk.
--
-- Usage: osascript eject-sidebar-item.applescript "iPhone de Gerson"
-- Requires Accessibility permission for Raycast.

on run argv
	if (count of argv) is 0 then error "Missing the name of the item to eject."
	set targetName to item 1 of argv
	set didOpenWindow to false

	tell application "Finder"
		if (count of Finder windows) is 0 then
			make new Finder window
			set didOpenWindow to true
		end if
	end tell

	set ejected to false

	tell application "System Events"
		if not (exists process "Finder") then error "Finder is not running."
		tell process "Finder"
			set sidebarOutline to my findSidebarOutline(window 1)
			if sidebarOutline is missing value then error "Could not locate the Finder sidebar."

			repeat with theRow in (rows of sidebarOutline)
				if my nameOfRow(theRow) is targetName then
					-- Preferred route: click the row's own eject button. It does not
					-- steal focus and it is exactly what a click in Finder does.
					-- The eject button is the one carrying a title; a row can also
					-- hold an untitled iCloud sync button, and clicking that would
					-- evict the user's files from local storage instead.
					try
						repeat with b in (buttons of UI element 1 of theRow)
							if my hasTitle(b) then
								click b
								set ejected to true
								exit repeat
							end if
						end repeat
					end try
					if not ejected then
						try
							repeat with b in (buttons of theRow)
								if my hasTitle(b) then
									click b
									set ejected to true
									exit repeat
								end if
							end repeat
						end try
					end if
					-- Fallback: select the row and press Command-E. Keystrokes go to
					-- the front app, so Finder has to come forward for this one.
					if not ejected then
						try
							set selected of theRow to true
							tell application "Finder" to activate
							delay 0.3
							keystroke "e" using command down
							set ejected to true
						end try
					end if
					exit repeat
				end if
			end repeat
		end tell
	end tell

	if didOpenWindow and ejected then
		try
			delay 0.5
			tell application "Finder" to close front Finder window
		end try
	end if

	if not ejected then error "Could not find \"" & targetName & "\" in the Finder sidebar."
	return "ok"
end run

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

on hasTitle(theButton)
	set theTitle to ""
	try
		tell application "System Events" to set theTitle to (title of theButton) as text
	end try
	return theTitle is not ""
end hasTitle

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
