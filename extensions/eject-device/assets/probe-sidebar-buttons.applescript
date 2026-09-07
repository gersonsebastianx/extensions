-- Reports every sidebar row with its disclosure level and, for each button on
-- it, the description, title and help text. Finder puts a button on rows that
-- have nothing to do with ejecting -- an iCloud folder carries a sync button --
-- so "has a button" is not the same as "is ejectable", and this is how the
-- difference gets identified on a Mac we cannot see.

tell application "Finder"
	if (count of Finder windows) is 0 then make new Finder window
end tell

set out to {}

tell application "System Events"
	tell process "Finder"
		-- Poll: a freshly created Finder window has no sidebar for a moment.
		set sb to missing value
		repeat 40 times
			try
				set sb to outline 1 of scroll area 1 of splitter group 1 of window 1
			end try
			if sb is missing value then
				try
					repeat with el in (entire contents of window 1)
						if class of el is outline then
							set sb to el
							exit repeat
						end if
					end repeat
				end try
			end if
			if sb is not missing value then
				if (count of rows of sb) > 0 then exit repeat
			end if
			delay 0.1
		end repeat
		if sb is missing value then error "No encuentro la barra lateral"

		repeat with r in (rows of sb)
			set nm to ""
			try
				set nm to value of static text 1 of UI element 1 of r
			end try
			if nm is "" then
				try
					set nm to value of static text 1 of r
				end try
			end if

			if nm is not "" then
				set lvl to "?"
				try
					set lvl to (value of attribute "AXDisclosureLevel" of r) as text
				end try
				set info to "[" & lvl & "] " & nm
				set btns to {}
				try
					set btns to buttons of UI element 1 of r
				end try
				set info to info & "  botones=" & (count of btns)
				repeat with b in btns
					set d to ""
					try
						set d to (description of b) as text
					end try
					set t to ""
					try
						set t to (title of b) as text
					end try
					set hlp to ""
					try
						set hlp to (help of b) as text
					end try
					set info to info & "  {desc=" & d & "|title=" & t & "|help=" & hlp & "}"
				end repeat
				set end of out to info
			end if
		end repeat
	end tell
end tell

set AppleScript's text item delimiters to linefeed
return out as text
