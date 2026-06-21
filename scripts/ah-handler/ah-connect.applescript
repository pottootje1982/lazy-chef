-- Local handler for the Albert Heijn OAuth redirect.
--
-- AH only allows redirecting to the native `appie://login-exit?code=…` scheme,
-- which a desktop browser can't open. This tiny app registers itself as the
-- macOS handler for `appie://` links, takes the query string (code + state) and
-- re-opens it against the recipe-manager callback so the account links itself.

on open location this_URL
	try
		set AppleScript's text item delimiters to "?"
		set parts to text items of this_URL
		set AppleScript's text item delimiters to ""
		if (count of parts) > 1 then
			set theQuery to item 2 of parts
			set targetURL to "http://localhost:3000/api/ah/callback?" & theQuery
		else
			set targetURL to "http://localhost:3000/settings"
		end if
		do shell script "open " & quoted form of targetURL
	end try
end open location

on run
	-- Launched directly (not via a link): just open Settings.
	do shell script "open " & quoted form of "http://localhost:3000/settings"
end run
