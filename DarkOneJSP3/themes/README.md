# DarkOneJSP3 themes

Theme files are UTF-8 JSON documents. `Default.json` is the protected factory
theme used by **Reset to Default**. Create personal themes through TOOLS > Theme
Manager; do not rename or delete `Default.json`.

Colours use `#AARRGGBB` (alpha, red, green, blue), for example `#FF298FCC`.
Mode values deliberately match the choices shown by each panel's existing
appearance menu. Unknown fields are retained when a theme is loaded and saved,
but only documented, allow-listed fields are applied to panel properties.

Theme Manager validates the format marker, format version, name and appearance
object before applying a file. Numeric values are clamped to safe ranges and
file names are restricted to normal Windows file-name characters.

`appearance.manager.fixedFontSize` and
`appearance.manager.automaticFontScale` customise the Theme Manager interface.
A fixed size of zero selects the automatic 12 px base, adjusted by the stored
50–200% scale. The default is zero and 100%.

Quick Search stores its independent font controls as
`appearance.quickSearch.fixedFontSize` and
`appearance.quickSearch.automaticFontScale`. InfoStack's tab-strip equivalents
remain under `appearance.infoStack.fixedFontSize` and
`appearance.infoStack.automaticFontScale`; Capture current does not merge the
two panels' automatic scales.

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
