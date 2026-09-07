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

	if my waitForSidebar() is missing value then
		my restore(didOpenWindow, missing value)
		error "Could not locate the Finder sidebar."
	end if

	if my findRow(targetName) is missing value then
		my restore(didOpenWindow, missing value)
		error "\"" & targetName & "\" is no longer in the Finder sidebar."
	end if

	-- Reproduce what a person does as closely as possible: Finder in front, the
	-- row selected -- which is what makes Finder draw the eject arrow at all --
	-- and only then the button. Whoever was in front is put back at the end.
	set previousApp to my frontmostApp()
	try
		tell application "Finder" to activate
	end try
	delay 0.3

	set attempted to false
	set cameBack to false

	repeat with strategy from 1 to 3
		-- The row is looked up again every time. A reference taken before an
		-- attempt can be dead after it, and every call here is inside a try, so
		-- a dead one would fail silently and the later strategies would quietly
		-- do nothing at all.
		set theRow to my findRow(targetName)
		if theRow is missing value then exit repeat

		my selectRow(theRow)

		set didAct to false
		if strategy is 1 then
			set didAct to my pressEjectButton(theRow, "AXPress")
		else if strategy is 2 then
			set didAct to my pressEjectButton(theRow, "click")
		else
			set didAct to my ejectViaKeystroke()
		end if

		if didAct then
			set attempted to true
			set outcome to my watchRow(targetName)
			if outcome is "gone" then
				my restore(didOpenWindow, previousApp)
				return "ok"
			end if
			if outcome is "returned" then set cameBack to true
		end if
	end repeat

	my restore(didOpenWindow, previousApp)

	if not attempted then error "Found \"" & targetName & "\" but it has no eject button."
	if cameBack then
		error "\"" & targetName & "\" was ejected and Finder listed it again straight away. A device that is also visible over Wi-Fi comes back on its own; turn off \"Show this device when on Wi-Fi\" in its Finder settings to eject it for good."
	end if
	error "Finder would not let go of \"" & targetName & "\". It may be syncing, backing up, or otherwise busy."
end run

-- Watches what happens to the row: "gone" if it left and stayed gone,
-- "returned" if it left and Finder put it back, "stayed" if it never moved.
-- The difference matters: a row that comes back is not a bug in the click.
on watchRow(targetName)
	set wentAway to false
	repeat 15 times
		delay 0.2
		if my rowStillPresent(targetName) then
			if wentAway then return "returned"
		else
			set wentAway to true
		end if
	end repeat
	if wentAway then return "gone"
	return "stayed"
end watchRow

on restore(didOpenWindow, previousApp)
	if didOpenWindow then
		try
			tell application "Finder" to close front Finder window
		end try
	end if
	try
		if previousApp is not missing value then tell application previousApp to activate
	end try
end restore

on frontmostApp()
	try
		tell application "System Events" to return name of first application process whose frontmost is true
	end try
	return missing value
end frontmostApp

on findRow(targetName)
	try
		tell application "System Events"
			tell process "Finder"
				if (count of windows) is 0 then return missing value
				set sb to my findSidebarOutline(window 1)
				if sb is missing value then return missing value
				repeat with r in (rows of sb)
					if my nameOfRow(r) is targetName then return r
				end repeat
			end tell
		end tell
	end try
	return missing value
end findRow

-- Presses the row's eject button, which is the one carrying a title; an
-- untitled button on the same row belongs to iCloud sync. "AXPress" invokes the
-- accessibility action, which does not care whether the arrow is drawn; "click"
-- synthesizes a press at its position, which does.
on pressEjectButton(theRow, how)
	tell application "System Events"
		try
			repeat with b in (buttons of UI element 1 of theRow)
				if my hasTitle(b) then
					if how is "AXPress" then
						try
							perform action "AXPress" of b
							return true
						end try
					else
						try
							click b
							return true
						end try
					end if
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

-- Finder's own Eject command. Only reports success if the keystroke was
-- actually delivered to Finder while it was frontmost.
on ejectViaKeystroke()
	try
		tell application "System Events"
			if not (frontmost of application process "Finder") then return false
			keystroke "e" using command down
		end tell
		return true
	end try
	return false
end ejectViaKeystroke

-- True when the row is still there, and also when it cannot be checked at all:
-- an unverifiable eject counts as one that did not happen.
on rowStillPresent(targetName)
	return my findRow(targetName) is not missing value
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
