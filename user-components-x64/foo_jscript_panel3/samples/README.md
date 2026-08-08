# Enhanced JScript Panel 3 samples

This directory contains the upgraded JScript Panel 3 sample suite distributed
with DarkOneJSP3. The samples are also designed to work independently of the
DarkOneJSP3 theme.

## Standalone use

Copy or merge the supplied `foo_jscript_panel3` directory into the active
`user-components-x64` location for JScript Panel 3. The `DarkOneJSP3` project
directory is not required when using the sample entries on their own.

Back up the existing `foo_jscript_panel3\samples` directory first. These files
are enhanced replacements for several stock samples and may be shared by more
than one foobar2000 theme.

## Compatibility guarantees

- Existing sample filenames and internal import paths are preserved.
- The long-standing `helpers.txt` import supplies guarded performance and UI
  cadence fallbacks, allowing older saved JS Playlist and Smooth Playlist
  Manager entry scripts to continue loading.
- Current entries use component-local files under `samples\shared` and do not
  import anything from `%fb2k_profile_path%DarkOneJSP3`.
- Existing property names are retained, including legacy `DARKONEJSP3.*` keys,
  so saved panel settings are not discarded.
- Both `JSP3Enhanced.Reset.Properties` and the legacy
  `DarkOneJSP3.Reset.Properties` reset notifications are accepted.
- `samples\js\darkonejsp3_reset.js` is a generated, self-contained legacy
  adapter containing the sample defaults and neutral bridge needed by saved
  entries created before the standalone-sample refactor.
- The legacy `_panel({ darkonejsp3_page_background: true })` option remains an
  alias for `_panel({ enhanced_page_background: true })`.

## Principal upgraded samples

- JS Playlist
- Smooth Playlist Manager
- Album Notes and its legacy AllMusic slot
- MusicBrainz
- Last.fm Biography and Artist/User Information
- Properties
- Queue Viewer — uses incremental `%queue_indexes%` discovery when run
  standalone; `%queue_total%` allows non-empty scans to stop once all queue
  positions have been found.

DarkOneJSP3 adds coordinated layout, theme defaults and factory-reset controls
on top of the same standalone sample implementations; it no longer owns their
runtime dependencies.
