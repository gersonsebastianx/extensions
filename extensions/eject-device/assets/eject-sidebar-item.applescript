-- Ejects one entry of the Finder sidebar by name -- the same thing you do by
-- clicking the little eject arrow next to an iPhone, iPad or disk.
--
-- Usage: osascript eject-sidebar-item.applescript "iPhone de Gerson"
-- Requires Automation and Accessibility permission for the calling app.

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

	set sidebarOutline to my waitForSidebar()
	if sidebarOutline is missing value then
		my closeWindowIfOpened(didOpenWindow)
		error "Could not locate the Finder sidebar."
	end if

	set theRow to my findRow(sidebarOutline, targetName)
	if theRow is missing value then
		my closeWindowIfOpened(didOpenWindow)
		error "\"" & targetName & "\" is no longer in the Finder sidebar."
	end if

	-- Three ways in, in order of how little they disturb the user, each checked
	-- before moving on. The accessibility action goes first because it does not
	-- depend on the arrow being drawn -- Finder only renders it under the cursor
	-- or on the selected row, so a positional click on any other row lands on
	-- nothing and reports success exactly like a click that worked.
	set attempted to false

	if my pressEjectButton(theRow) then
		set attempted to true
		if my waitForRowToGo(targetName) then return my finish(didOpenWindow)
	end if

	-- Selecting the row makes Finder draw the arrow, so now a real click has
	-- something to hit.
	my selectRow(theRow)
	if my pressEjectButton(theRow) then
		set attempted to true
		if my waitForRowToGo(targetName) then return my finish(didOpenWindow)
	end if

	-- Last resort: Finder's own Eject command. This one needs Finder in front,
	-- so it is only worth the interruption once the quieter routes have failed.
	if my ejectViaMenu(theRow) then
		set attempted to true
		if my waitForRowToGo(targetName) then return my finish(didOpenWindow)
	end if

	my closeWindowIfOpened(didOpenWindow)
	if not attempted then error "Found \"" & targetName & "\" but it has no eject button."
	error "Finder would not let go of \"" & targetName & "\". It may be syncing or otherwise busy."
end run

on finish(didOpenWindow)
	my closeWindowIfOpened(didOpenWindow)
	return "ok"
end finish

on closeWindowIfOpened(didOpenWindow)
	if didOpenWindow then
		try
			tell application "Finder" to close front Finder window
		end try
	end if
end closeWindowIfOpened

on findRow(sidebarOutline, targetName)
	tell application "System Events"
		try
			repeat with theRow in (rows of sidebarOutline)
				if my nameOfRow(theRow) is targetName then return theRow
			end repeat
		end try
	end tell
	return missing value
end findRow

-- Presses the row's eject button, which is the one carrying a title; an
-- untitled button on the same row belongs to iCloud sync. The accessibility
-- action is tried before a click because it does not care where the button is
-- drawn, or whether it is drawn at all.
on pressEjectButton(theRow)
	tell application "System Events"
		try
			repeat with b in (buttons of UI element 1 of theRow)
				if my hasTitle(b) then
					try
						perform action "AXPress" of b
						return true
					end try
					try
						click b
						return true
					end try
				end if
			end repeat
		end try
	end tell
	return false
end pressEjectButton

on selectRow(theRow)
	try
		tell application "System Events" to set selected of theRow to true
		delay 0.3
	end try
end selectRow

on ejectViaMenu(theRow)
	try
		my selectRow(theRow)
		tell application "Finder" to activate
		delay 0.4
		tell application "System Events" to keystroke "e" using command down
		return true
	end try
	return false
end ejectViaMenu

-- Watches the row leave. Success is only reported once it has.
on waitForRowToGo(targetName)
	repeat 10 times
		delay 0.2
		if not my rowStillPresent(targetName) then return true
	end repeat
	return false
end waitForRowToGo

-- Returns true when the row is still there, and also when it cannot be checked
-- at all: an unverifiable eject has to count as one that did not happen, or the
-- extension goes back to announcing successes it has not confirmed.
on rowStillPresent(targetName)
	try
		tell application "System Events"
			tell process "Finder"
				if (count of windows) is 0 then return true
				set sb to my findSidebarOutline(window 1)
				if sb is missing value then return true
				repeat with r in (rows of sb)
					if my nameOfRow(r) is targetName then return true
				end repeat
			end tell
		end tell
		return false
	end try
	return true
end rowStillPresent

-- A window that has just been created is not usable the instant it exists: its
-- sidebar is populated a moment later. Poll for one that actually has rows.
on waitForSidebar()
	repeat 40 times
		try
			tell application "System Events"
				tell process "Finder"
					if (count of windows) > 0 then
						set candidate to my findSidebarOutline(window 1)
						if candidate is not missing value then
							if (count of rows of candidate) > 0 then return candidate
						end if
					end if
				end tell
			end tell
		end try
		delay 0.1
	end repeat
	return missing value
end waitForSidebar

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

on hasTitle(theButton)
	set theTitle to ""
	try
		tell application "System Events" to set theTitle to (title of theButton) as text
	end try
	return theTitle is not ""
end hasTitle
