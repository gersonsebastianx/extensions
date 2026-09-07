-- Prints the accessibility tree of the front Finder window. Used by the
-- "Diagnose Finder Sidebar" command so that a layout we have not seen before
-- can be reported and fixed without guesswork.

on run
	tell application "Finder"
		if (count of Finder windows) is 0 then make new Finder window
	end tell

	set outputLines to {}

	tell application "System Events"
		if not (exists process "Finder") then error "Finder is not running."
		tell process "Finder"
			set end of outputLines to "window count: " & (count of windows)
			try
				set end of outputLines to "role of window 1: " & (role of window 1)
			end try

			set elementCount to 0
			try
				repeat with anElement in (entire contents of window 1)
					set elementCount to elementCount + 1
					if elementCount > 400 then
						set end of outputLines to "... truncated at 400 elements"
						exit repeat
					end if
					set elementClass to "?"
					try
						set elementClass to (role of anElement) as text
					end try
					if elementClass is "?" then
						try
							set elementClass to (class of anElement) as text
						end try
					end if
					set elementLabel to ""
					try
						set elementLabel to (value of anElement) as text
					end try
					if elementLabel is "" then
						try
							set elementLabel to (name of anElement) as text
						end try
					end if
					set end of outputLines to elementClass & " :: " & elementLabel
				end repeat
			on error errorMessage
				set end of outputLines to "error while walking the window: " & errorMessage
			end try
		end tell
	end tell

	set AppleScript's text item delimiters to linefeed
	set theResult to outputLines as text
	set AppleScript's text item delimiters to ""
	return theResult
end run
