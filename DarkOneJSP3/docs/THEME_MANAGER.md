# DarkOneJSP3 Theme Manager

## Status

Theme Manager is available in v1.2.0. It is an optional seventh
InfoStack page, opened from **TOOLS > Theme Manager**. The updated bundled FCL includes this page. For an existing layout without it,
add the panel manually using the steps below.

## Add the InfoStack page

Add a JScript Panel 3 instance as the seventh child of `DOJSP3.InfoStack` and
set its exact Columns UI custom title to:

```text
DOJSP3.ThemeManager
```

Load this script into that panel:

```text
<profile>\DarkOneJSP3\jscript\DarkOneJSP3 - Theme Manager.txt
```

Reload the InfoStack splitter or restart foobar2000. The page announces itself
to InfoStack after loading. Because JScript Panel 3-to-JSplitter notifications
are not guaranteed during component startup, it also writes a short-lived
presence beacon. InfoStack checks that beacon during bounded deferred retries,
then resolves the child outside the notification callback. Selecting
**TOOLS > Theme Manager** remains an authoritative guarded lookup.

Normal six-child startup never probes for the optional title, draws a
placeholder tab or waits for Theme Manager. Without either a current beacon or
an availability reply, no startup lookup occurs. If the child is genuinely
absent, TOOLS shows setup instructions and the rest of the interface remains
usable.

The page is labelled **Theme** in InfoStack menus. Availability and visibility
are intentionally separate: an unavailable page is omitted from INFOSTACK and
Tab settings, while an installed, resolved page appears in both. Use **Tab
settings > Visible tabs > Theme** to show or hide only its horizontal tab.
Hiding that tab does not disable the resolved page: **TOOLS > Theme Manager**
and the optional INFOSTACK button can still open it without changing the saved
visibility preference.

## Theme operations

- **Apply** previews the selected draft across every available DarkOneJSP3
  panel and supported enhanced sample.
- **Save** updates the selected personal JSON file. `Default.json` is protected,
  so Save opens Save as when the factory theme is selected.
- **Save as** creates a named personal theme.
- **Rename** writes the renamed file first and removes the old file only after
  the new write succeeds.
- **Delete** requires confirmation. `Default.json` cannot be renamed or deleted.
- **Capture current** reads DarkOneJSP3-owned appearance settings from every
  available panel and merges them into the unsaved draft. It does not apply or
  save the result automatically.
- **Reset default** reloads and applies `Default.json` as the factory appearance.

Save as commits its new name only after the JSON write succeeds. Apply uses the
draft as it was when Apply was clicked; subsequent edits cannot change an
in-flight request. Capture current waits until Apply completes so it cannot
collect an intermediate mixture of panel settings. Apply uses the
validated command file as its reliable cross-component transport. Theme Manager
writes the theme request, bottom commit and canonical state, then waits for
Bottom Controls to stage the matching JSplitter work and acknowledge an
attainable absolute apply time. Only then does it stage the JScript-owned values
and release both host domains at that boundary. A 750 ms bounded fallback keeps
Apply usable if Bottom Controls is absent or unresponsive.

Each bottom panel now commits its theme and background through one timer.
The stage prepares properties without repainting; the commit refreshes live
caches once. Colour-only changes avoid rebuilding control geometry and the
volume knob. Quick Search uses the commit's parent colour and retains its
current query and user data.

The wider theme broadcast waits for paint-callback receipts from the four
JScript bottom panels and the Bottom Controls backing. This gives their paints
an opportunity to complete before other panels reload. An unchanged backing
acknowledges completion without requesting another paint. Missing receipts
release the wider broadcast after 1.5 seconds; the JSplitter relay also has an
independent 2-second recovery path. The status line reports fallback use.

These receipts confirm script callbacks, not Windows compositor presentation.
Perfect frame synchronisation still requires native testing. Repeated identical
requests preserve any pending cache refresh, and obsolete receipts cannot
release a newer request. The final normal Apply avoids an extra repaint after
a completed stage.
A failed commit or canonical-state write cancels the matching theme command.

For timing diagnosis, set `DARKONEJSP3.THEME.DEBUG.TIMING` to `true` in the
participating panels' properties, including the Bottom Controls JSplitter.
The foobar2000 console then logs the request ID, role and timestamps for
property preparation, commit and paint callback (or unchanged backing).
Disable the property after recording a test. Logging is off by default.

Capture current uses a bounded request/response pass across the loaded JScript
Panel 3 and JSplitter roles. Because the two hosts have separate notification
domains, it combines direct JScript Panel responses with a short-lived
file-backed JSplitter query/response bridge coordinated by Bottom Controls.
Unique values update the draft, including live properties omitted from a
manually trimmed JSON file. When several panels map to one shared theme field
but currently disagree, that field is left unchanged and the status line
reports the conflict; response order can therefore never silently decide the
result. A missing core JSplitter response is also reported, so a stale draft
value cannot masquerade as a successful capture. Use Save or Save as after
reviewing the captured draft.

InfoStack availability is not a captured theme setting. **Theme tab visible**
is read only from the saved `DarkOneJSP3.InfoStack.Tab.ThemeManager.Visible`
property. Merely finding the `DOJSP3.ThemeManager` child does not turn the
horizontal tab on. Applying a theme refreshes InfoStack appearance in place;
it does not reload the controller, discard the resolved child or write a false
availability value to `darkonejsp3.infostack-menu-state.json`.

Theme files are stored in:

```text
<profile>\DarkOneJSP3\themes\
```

## JSON format

Files are UTF-8, indented JSON with descriptive groups for palette,
typography, controls, bottom area, InfoStack, information pages, playlists,
artwork and layout. Colours use `#AARRGGBB`; `#RRGGBB` is also accepted when a
file is edited manually.

The sixth **Manager** category controls this interface itself:

- **Font size (0 = automatic)** sets a fixed base size from 8–24 px; zero uses
  automatic scaling.
- **Automatic base scale (%)** scales the normal 12 px base from 50–200% when
  no fixed size is set.

Font resources, spacing, row heights, controls, hit targets and scroll steps
update together so larger text does not overflow fixed geometry. These values
are stored descriptively under `appearance.manager` in each theme.

Button fills and outlines share the same scaled corner radius. Colour fields
keep their hexadecimal value immediately to the left of a right-anchored
preview swatch; the value, gap and swatch are calculated as one unit so their
order and spacing remain stable throughout the 50–200% scale range.

The Controls category exposes **Button roundness (%)** using the same presets
as **TOOLS > Buttons > Button roundness**: Automatic, Square (0%), Subtle (20%),
Classic DarkOne (33%), Rounded (60%), Maximum/pill (100%) and a custom 0–100%
entry. Automatic follows the selected button style and is stored as `-1` in
JSON for compatibility, but Theme Manager displays the descriptive word rather
than exposing that sentinel.

### Panel-specific colours

The **Colours** category keeps the general palette and adds independent panel
settings:

- **Playlist colour type**: Custom, Dynamic or Off.
- **Playlist text**, **highlight**, **background**, **selected background**,
  **mood** and **rating**.
- **Playlist Manager colour type**: Custom, Dynamic or Off.
- **Playlist Manager text**, **background** and **selected background**.

Colour types are stored as the readable JSON strings `"Custom"`, `"Dynamic"`
and `"Off"`. Apply translates each value to the two native panel switches and
always writes a mutually exclusive pair. Capture treats Dynamic as authoritative
if an older panel state has both switches enabled, otherwise it selects Custom
or Off. The colour values remain editable even when their type is not Custom,
so a theme can be prepared before enabling it.

The **Controls** category also exposes **Quick Search text colour**, **Quick
Search background colour** and **Quick Search border colour** beside their
respective mode selectors. **Quick Search fixed font size (0 = auto)** and
**Quick Search automatic base scale (%)** map to that panel's independent font
properties. The InfoStack category calls its equivalents **Fixed tab font size
(0 = auto)** and **Tab automatic base scale (%)** because those values affect
only the tab strip. These and the playlist fields use dedicated JSON paths, so
Capture current cannot confuse independent panel values. Themes from earlier
Earlier development builds that omit the new paths still read their former shared-palette
and shared-font-scale values during Apply; the next Capture current writes the
dedicated form.

The required header is:

```json
{
  "format": "DarkOneJSP3 Theme",
  "formatVersion": 1,
  "name": "My Theme",
  "appearance": {}
}
```

Start by copying `Default.json`. Unknown fields are preserved when the file is
loaded and saved, but are never applied. Known numeric values are clamped to
safe ranges, unsupported format versions are rejected, and theme data is never
evaluated as JavaScript.

## Cross-panel behaviour

JScript Panel 3 and JSplitter have separate notification domains. Theme Manager
applies immediately to other JScript panels and writes a short-lived validated
command under `js_data`. Bottom Controls consumes it, applies its own settings,
rebroadcasts the theme to the six JSplitter controllers and removes the command.
Expired, malformed and duplicate commands are ignored.

Capture uses the reverse of that transport: Theme Manager writes a short-lived
query, Bottom Controls gathers first responses from the JSplitter roles and
writes one request-bound response bundle, and Theme Manager imports then removes
only files matching its active request. Both transports use exact role/path
allow-lists, normalise values through the forward-apply rules and reject stale,
oversized, mismatched or duplicate data.

Native-component preferences that DarkOneJSP3 does not own—such as Enhanced
Spectrum Analyser visualisation settings and Waveform Minibar renderer options—
remain under those components' own menus. Theme Manager changes only explicit
DarkOneJSP3-owned appearance properties. Capture current follows the same
allow-list and cannot import those native-component preferences.

## Theme details and included presets

Open the **Manager** category to edit **Theme author** and **Theme description**.
Use **Save** or **Save as** to keep the changes in the JSON file. Blank values
are allowed; cancelling keeps the previous text. Author supports up to 160
characters and description up to 2,048; longer entries are rejected without
truncating the existing text. Use **Save as** for edits to the protected default.

The supplied presets are `Default.json` (display name **Default**) and
`DarkOne v4 Revival.json` (display name **DarkOne v4 Revival**). Their filenames
and embedded names are preserved as supplied. **Reset default** still loads
`Default.json`.
