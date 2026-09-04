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
- Album Notes, including the optional `Album Notes + Album Art.txt` composition
- MusicBrainz
- Last.fm Biography, its image-backed composition, and Artist/User Information
- Properties
- Queue Viewer — uses incremental `%queue_indexes%` discovery when run
  standalone; `%queue_total%` allows non-empty scans to stop once all queue
  positions have been found.

DarkOneJSP3 adds coordinated layout, theme defaults and factory-reset controls
on top of the same standalone sample implementations; it no longer owns their
runtime dependencies.

## Combined image layouts

`Last.fm Bio + Images.txt` places downloaded Last.fm artist images beside the
biography. When its visible playing-artist view needs artwork, automatic
downloads start without relying on one exact playback second, avoid duplicate
active requests and retry at a bounded cadence. Completed downloads appear
immediately; the image-cycle timer pauses while the panel is hidden and is
released with its Direct2D resources when the script unloads. The empty image
region centres its downloading, retry/error or confirmed-unavailable state, and
the JScript Panel console records each request, result, file and completion.
Gallery extraction uses both the normal DOM path and a raw-markup fallback for
current Last.fm pages. An unrecognised response remains an error/retry state and
cannot be mistaken for a confirmed-empty artist gallery. HTTP status and headers
are retained so non-2xx responses are classified before parsing. Transient
transport, 408/425/429 and 5xx failures stay retryable; diagnostics include the
HTTP reason, response length, selected safe headers and a short sanitised body
preview rather than dumping an arbitrary page to the console.

`Album Notes + Album Art.txt` provides the same two-region presentation for the
consolidated Album Notes providers and the current album artwork. It retains the
Album Notes source, cache, MusicBrainz and diagnostics menus while reusing Album
Art's lazy blur generation and artwork controls.

For either combined sample, right-click the image region to switch between a
left/right or top/bottom layout. Hold Ctrl while using the mouse wheel to adjust
the image-to-text ratio; ordinary wheel input continues to scroll text or cycle
artwork according to the region under the pointer.

Both combined entries use `header_gap = _scale(0)` as the visually aligned
baseline between the title and upper scroll arrow. Increase the value near the
top of the entry script to add display-scaled spacing. The separate two-pixel
scroll-button inset compensates for the arrow glyph's built-in top padding.

Both compositions expose Colours and Background Wallpaper. They also provide
independent image controls before their download or content commands:

- Display images or Display album art toggles the foreground image and collapses
  its region completely when disabled. Right-click the text region to restore it.
- Image background can use the displayed artwork behind the complete panel, with
  optional blur and Light, Medium or Dark shading. Disable it to reveal the
  selected page colour or generic Background Wallpaper instead.
- Image border offers None, Solid or Sunken styles with the default grey or a
  custom colour.

Last.fm Bio + Images also places Hide if no images available below Download now.
It collapses the region only after a successful Last.fm response confirms that
no usable artist images exist. Network and parsing failures stay visible, and a
manual retry reveals the region while it is active.
