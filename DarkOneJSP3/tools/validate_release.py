#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
project = root / 'DarkOneJSP3'
samples = root / 'user-components-x64' / 'foo_jscript_panel3' / 'samples'
docs = project / 'docs'
errors: list[str] = []


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def text(path: Path) -> str:
    return path.read_text(encoding='utf-8-sig')


def require(path: Path) -> None:
    if not path.exists():
        errors.append('Missing: ' + rel(path))


required = [
    root / 'README.md',
    project / 'build-info.json',
    project / 'darkonejsp3-layout-manifest.json',
    project / 'shared' / 'reset_defaults.js',
    project / 'shared' / 'colour_utils.js',
    project / 'shared' / 'jsplitter_protocols.js',
    project / 'jsplitter' / 'info_stack_colours.js',
    project / 'jsplitter' / 'info_stack_bridges.js',
    project / 'jscript' / 'js' / 'Buttons_OptionalMenu.js',
    project / 'jsplitter' / 'shared.js',
    docs / 'README.txt',
    docs / 'INSTALLATION.txt',
    docs / 'LAYOUT_AND_PANEL_MAP.txt',
    docs / 'CONFIGURATION_GUIDE.txt',
    docs / 'TROUBLESHOOTING.txt',
    docs / 'CHANGELOG.txt',
    docs / 'CREDITS.txt',
    docs / 'VALIDATION_REPORT.txt',
    samples / 'Album Notes.txt',
    samples / 'Album Art.txt',
    samples / 'MusicBrainz.txt',
    samples / 'JS Playlist.txt',
    samples / 'Smooth Playlist Manager.txt',
    samples / 'js' / 'common.js',
    samples / 'js' / 'darkonejsp3_reset.js',
    samples / 'js' / 'allmusic.js',
    samples / 'js' / 'album_notes.js',
]
for path in required:
    require(path)

# Package hygiene for a public release.
all_files = [
    path for path in root.rglob('*')
    if path.is_file() and path.suffix.lower() != '.fcl'
]
casefold_paths: dict[str, list[str]] = {}
suspicious_name = re.compile(r'(?:~|\.(?:bak|old|orig|rej|tmp|swp|pyc))$', re.I)
for path in all_files:
    relative = rel(path)
    casefold_paths.setdefault(relative.casefold(), []).append(relative)
    if suspicious_name.search(path.name) or '__pycache__' in path.parts or \
            path.name in {'.DS_Store', 'Thumbs.db'}:
        errors.append('Temporary or backup file must not be distributed: ' + relative)
    if path.stat().st_size == 0:
        errors.append('Empty package file: ' + relative)
for paths in casefold_paths.values():
    if len(paths) > 1:
        errors.append('Case-insensitive path collision: ' + ', '.join(sorted(paths)))

# Build metadata is the single version source.
version = ''
build: dict = {}
if (project / 'build-info.json').exists():
    try:
        build = json.loads(text(project / 'build-info.json'))
        version = str(build.get('version', '')).strip()
    except Exception as exc:
        errors.append('Invalid build-info.json: ' + str(exc))
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        errors.append('build-info.json has an invalid semantic version')
    if build.get('release') != f'DarkOneJSP3 v{version}':
        errors.append('build-info release string does not match its version')
    modules = build.get('modules', {})
    if modules.get('allmusic') != '0.6.4':
        errors.append('build-info AllMusic module version is not 0.6.4')
    if modules.get('album_notes') != '0.6.7':
        errors.append('build-info Album Notes module version is not 0.6.7')
    if modules.get('js_playlist') != '0.4.7':
        errors.append('build-info JS Playlist module version is not 0.4.7')
    for module_name in ['main_columns_controller', 'startup_controller']:
        module_version = str(modules.get(module_name, '')).strip()
        if not re.fullmatch(r'\d+\.\d+\.\d+', module_version):
            errors.append('build-info ' + module_name + ' version is invalid')
    if modules.get('info_stack_controller') != '0.6.25':
        errors.append('build-info InfoStack controller version is not 0.6.25')
    if modules.get('info_stack_colours') != '0.1.0':
        errors.append('build-info InfoStack colour helper version is not 0.1.0')
    if modules.get('info_stack_bridges') != '0.1.0':
        errors.append('build-info InfoStack bridge helper version is not 0.1.0')
    if modules.get('display') != '3.0.11-jsp3-3.8.5':
        errors.append('build-info Display module version is not 3.0.11-jsp3-3.8.5')
    if modules.get('queue_viewer') != '0.5.2':
        errors.append('build-info Queue Viewer module version is not 0.5.2')
    if modules.get('page_background') != '0.1.2':
        errors.append('build-info page-background module version is not 0.1.2')
    if modules.get('colour_helpers') != '0.1.0':
        errors.append('build-info colour-helper module version is not 0.1.0')
    if modules.get('jsplitter_protocols') != '0.1.0':
        errors.append('build-info JSplitter-protocol module version is not 0.1.0')
    if modules.get('control_left') != '3.0.12-jsp3-3.8.5':
        errors.append('build-info Control Left module version is not 3.0.12-jsp3-3.8.5')
    if modules.get('control_right') != '3.0.12-jsp3-3.8.5':
        errors.append('build-info Control Right module version is not 3.0.12-jsp3-3.8.5')
    if modules.get('optional_button_menu') != '0.1.0':
        errors.append('build-info optional-button menu module version is not 0.1.0')

# Active runtime namespace checks.
legacy_runtime = re.compile(r'(?<!DarkOne)DOJS3|DARKONEJS3|DarkOneJS3')
active: list[str] = []
for base in [project / 'jscript', project / 'jsplitter', project / 'shared', samples]:
    if not base.exists():
        continue
    for path in base.rglob('*'):
        if path.is_file() and path.suffix.lower() in {'.js', '.txt', '.json'}:
            try:
                body = text(path)
            except Exception:
                continue
            if legacy_runtime.search(body):
                active.append(rel(path))
if active:
    errors.append('Legacy runtime identifiers remain in: ' + ', '.join(active[:20]))

# Obsolete stable-release marker files must not return.
for removed in [docs / 'RENAMING_TO_DARKONEJSP3.txt']:
    if removed.exists():
        errors.append('Obsolete stable-release marker remains: ' + rel(removed))

# Public documentation must use only the current project identifiers.
former_doc_identifiers = ['DarkOneJS3', 'DOJS3', 'DARKONEJS3']
for path in [root / 'README.md', *sorted(docs.glob('*.txt'))]:
    if not path.exists():
        continue
    body = text(path)
    for identifier in former_doc_identifiers:
        if identifier in body:
            errors.append(rel(path) + ' contains a former project identifier: ' + identifier)
retired_doc_aliases = [
    'DOJSP3.InfoSource',
    'DOJSP3.MusicBrainz',
    'DOJSP3.Allmusic',
]
for path in [root / 'README.md', *sorted(docs.glob('*.txt'))]:
    if not path.exists():
        continue
    body = text(path)
    for alias in retired_doc_aliases:
        if alias in body:
            errors.append(rel(path) + ' contains a retired title alias: ' + alias)

for stale_reference in ['RENAMING_TO_DARKONEJSP3.txt']:
    for path in [root / 'README.md', *sorted(docs.glob('*.txt'))]:
        if path.exists() and stale_reference in text(path):
            errors.append(rel(path) + ' contains a stale marker reference: ' + stale_reference)

# Manifest consistency.
manifest_path = project / 'darkonejsp3-layout-manifest.json'
if manifest_path.exists():
    try:
        manifest = json.loads(text(manifest_path))
    except Exception as exc:
        errors.append('Invalid layout manifest: ' + str(exc))
        manifest = {}
    if str(manifest.get('version', '')) != version:
        errors.append('Layout manifest version does not match build-info.json')
    accent = manifest.get('enhancements', {}).get('display_accent', {})
    if accent.get('legacy_six_colour_property_migration') is not False:
        errors.append('Manifest still advertises legacy display-colour migration')
    if accent.get('columns_ui_selected_item_background') is not True or \
            accent.get('columns_ui_colour_index') != 4:
        errors.append('Manifest omits the Columns UI selected-item display accent')
    tab_accent = manifest.get('enhancements', {}).get('info_stack_tab_colour', {})
    if tab_accent.get('columns_ui_selected_item_background') is not True or \
            tab_accent.get('columns_ui_colour_index') != 4:
        errors.append('Manifest omits the Columns UI selected-item tab accent')

    colour_consolidation = manifest.get('enhancements', {}).get(
        'colour_consolidation', {})
    expected_colour_consolidation = {
        'shared_helper': 'DarkOneJSP3/shared/colour_utils.js',
        'version': '0.1.0',
        'declarative_menu_mapping': True,
        'explicit_menu_id_to_mode_mapping': True,
        'jsplitter_picker_signature':
            'utils.ColourPicker(window_id, default_colour)',
        'jscript_panel_picker_signature':
            'utils.ColourPicker(default_colour, true)',
        'cancel_preserves_existing_colour': True,
        'text_fallback_only_when_native_picker_unavailable': True,
        'saved_property_names_unchanged': True,
        'saved_mode_values_unchanged': True,
    }
    for key, expected in expected_colour_consolidation.items():
        if colour_consolidation.get(key) != expected:
            errors.append('Manifest colour-consolidation field is incorrect: ' + key)
    for operation in [
            'opaque conversion', 'hex formatting', 'text parsing',
            'mode validation']:
        if operation not in colour_consolidation.get('pure_operations', []):
            errors.append('Manifest colour helper operation is missing: ' + operation)
    for host in ['JSplitter', 'JScript Panel 3']:
        if host not in colour_consolidation.get('hosts', []):
            errors.append('Manifest colour helper host is missing: ' + host)
    protocol_consolidation = manifest.get('enhancements', {}).get(
        'jsplitter_protocol_consolidation', {})
    expected_protocol_consolidation = {
        'shared_helper': 'DarkOneJSP3/shared/jsplitter_protocols.js',
        'version': '0.1.0',
        'startup_notifications_centralised': True,
        'startup_state_serialisation_centralised': True,
        'startup_command_serialisation_centralised': True,
        'startup_readiness_bridge_shared_by_controllers': True,
        'divider_notifications_centralised': True,
        'divider_state_serialisation_centralised': True,
        'divider_menu_mapping_centralised': True,
        'property_ownership_unchanged': True,
        'saved_values_unchanged': True,
        'runtime_bridge_tests': True,
    }
    for key, expected in expected_protocol_consolidation.items():
        if protocol_consolidation.get(key) != expected:
            errors.append('Manifest JSplitter-protocol field is incorrect: ' + key)
    if protocol_consolidation.get('protocol_versions') != {
            'startup_controls': 'v1', 'divider_state': 'v1'}:
        errors.append('Manifest JSplitter protocol versions are incorrect')
    optional_menu_consolidation = manifest.get('enhancements', {}).get(
        'optional_button_menu_consolidation', {})
    expected_optional_menu_consolidation = {
        'shared_helper': 'DarkOneJSP3/jscript/js/Buttons_OptionalMenu.js',
        'version': '0.1.0',
        'panels': ['Control Left', 'Control Right'],
        'optional_button_toggle_centralised': True,
        'command_setup_centralised': True,
        'command_redetection_centralised': True,
        'command_guide_centralised': True,
        'darkone_tools_entry_centralised': True,
        'roundness_menu_centralised': True,
        'panel_specific_layouts_unchanged': True,
        'left_style_and_depth_menus_remain_local': True,
        'saved_properties_unchanged': True,
        'menu_ids_unchanged': True,
        'runtime_tests': True,
    }
    for key, expected in expected_optional_menu_consolidation.items():
        if optional_menu_consolidation.get(key) != expected:
            errors.append('Manifest optional-button-menu field is incorrect: ' + key)
    info_stack_split = manifest.get('enhancements', {}).get(
        'info_stack_controller_split', {})
    expected_info_stack_split = {
        'colour_helper': 'DarkOneJSP3/jsplitter/info_stack_colours.js',
        'bridge_helper': 'DarkOneJSP3/jsplitter/info_stack_bridges.js',
        'version': '0.1.0',
        'layout_and_painting_remain_in_controller': True,
        'menu_ids_unchanged': True,
        'saved_properties_unchanged': True,
        'notification_names_unchanged': True,
        'property_ownership_unchanged': True,
        'runtime_tests': True,
    }
    for key, expected in expected_info_stack_split.items():
        if info_stack_split.get(key) != expected:
            errors.append('Manifest InfoStack split field is incorrect: ' + key)
    if manifest.get('enhancements', {}).get('control_buttons', {}).get(
            'shared_optional_menu') is not True:
        errors.append('Manifest control-button settings omit the shared optional menu')
    for feature_name in [
            'display_accent', 'info_stack_tab_colour',
            'art_spectrum_dividers', 'info_stack_page_background']:
        feature = manifest.get('enhancements', {}).get(feature_name, {})
        if feature.get('shared_colour_helper') is not True:
            errors.append('Manifest does not mark shared colour-helper use for: ' +
                          feature_name)
    mb = manifest.get('enhancements', {}).get('musicbrainz', {})
    if mb.get('infostack_host') != 'DOJSP3.AlbumNotes':
        errors.append('Manifest does not identify Album Notes as MusicBrainz host')
    factory_reset = manifest.get('enhancements', {}).get('factory_reset', {})
    for flag in [
        'enhanced_playlist_scroll_and_refresh_covered',
        'playlist_manager_scroll_refresh_and_layout_covered',
        'playlist_manager_saved_scroll_cleared_by_full_reset',
        'queue_viewer_reset_bridge_loaded',
        'playlist_manager_alternating_rows_covered',
        'infostack_automatic_font_scale_covered',
        'art_spectrum_divider_colour_covered',
        'infostack_page_backgrounds_covered',
    ]:
        if factory_reset.get(flag) is not True:
            errors.append('Manifest factory-reset flag is missing: ' + flag)
    if factory_reset.get('serialised_notification_payload') is not True:
        errors.append('Manifest omits serialised reset notification payloads')
    if factory_reset.get('legacy_object_payload_accepted') is not True:
        errors.append('Manifest omits legacy reset payload compatibility')
    playlist_manager = manifest.get('enhancements', {}).get('playlist_manager', {})
    if playlist_manager.get('alternating_row_shading') is not True or \
            playlist_manager.get('alternating_row_shading_default') is not True:
        errors.append('Manifest omits Playlist Manager alternating-row shading')
    if playlist_manager.get('explicit_timer_cleanup') is not True:
        errors.append('Manifest omits Playlist Manager timer cleanup')
    js_playlist_manifest = manifest.get('enhancements', {}).get('js_playlist', {})
    for flag in [
        'panel_settings_back_arrow_single_silhouette',
        'panel_settings_back_arrow_uniform_alpha',
        'panel_settings_back_arrow_coverage_antialiasing',
    ]:
        if js_playlist_manifest.get(flag) is not True:
            errors.append('Manifest JS Playlist arrow flag is missing: ' + flag)
    factory_scope = manifest.get('enhancements', {}).get('factory_reset', {})
    if factory_scope.get('scope') != 'DarkOneJSP3-managed properties only':
        errors.append('Manifest does not define factory-reset ownership')
    if factory_scope.get('generic_upstream_sample_customisation_preserved') is not True:
        errors.append('Manifest omits preservation of upstream sample settings')
    queue_manifest = manifest.get('enhancements', {}).get('queue_viewer', {})
    if queue_manifest.get('factory_reset_wrapper') != \
            'DarkOneJSP3/jscript/DarkOneJSP3 - Queue Viewer.txt':
        errors.append('Manifest does not identify the reset-aware Queue wrapper')
    if queue_manifest.get('generic_sample_participates_in_factory_reset') is not False:
        errors.append('Manifest incorrectly marks the generic Queue sample reset-aware')
    allmusic_manifest = manifest.get('enhancements', {}).get('allmusic', {})
    for flag in [
        'managed_same_album_reactivation',
        'stale_search_history_recovery',
        'terminal_callback_for_idle_activation',
    ]:
        if allmusic_manifest.get(flag) is not True:
            errors.append('Manifest AllMusic hardening flag is missing: ' + flag)
    silent_guards = allmusic_manifest.get('silent_exit_guards', [])
    for guard in [
        'missing artist or album tags',
        'browser-verification backoff',
        'request start failure',
        'invalid full album-page retry URL',
    ]:
        if guard not in silent_guards:
            errors.append('Manifest AllMusic silent-exit guard is missing: ' + guard)
    album_notes_manifest = manifest.get('enhancements', {}).get('album_notes', {})
    if album_notes_manifest.get('allmusic_activation_guard_ms') != 250:
        errors.append('Manifest has the wrong Album Notes activation guard')
    if album_notes_manifest.get(
            'enabled_source_chain_cannot_wait_without_provider_activity') is not True:
        errors.append('Manifest omits Album Notes idle-provider protection')

    page_background_manifest = manifest.get('enhancements', {}).get(
        'info_stack_page_background', {})
    if page_background_manifest.get('menu') != 'Page background colour':
        errors.append('Manifest has the wrong information-page background menu')
    if page_background_manifest.get('pages') != [
            'Biography', 'Last.fm', 'Album Notes', 'Queue', 'Properties']:
        errors.append('Manifest information-page background scope is incorrect')
    if page_background_manifest.get('default') !=             'DarkOne dark grey RGB 24,24,24':
        errors.append('Manifest has the wrong information-page background default')
    if page_background_manifest.get('modes') != [
            'Transparent / inherit parent', 'Black', 'DarkOne grey',
            'DarkOne dark grey', 'Columns UI global background',
            'Custom colour']:
        errors.append('Manifest information-page background modes are incomplete')
    for flag in [
            'per_page_persistence', 'playlists_excluded',
            'factory_reset_covered', 'generic_samples_unchanged_unless_opted_in']:
        if page_background_manifest.get(flag) is not True:
            errors.append('Manifest information-page background flag is missing: ' + flag)
    for property_name in [
            'DARKONEJSP3.PAGE.BACKGROUND.MODE',
            'DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR']:
        if property_name not in page_background_manifest.get('properties', []):
            errors.append('Manifest information-page background property is missing: ' + property_name)

    divider_manifest = manifest.get('enhancements', {}).get(
        'art_spectrum_dividers', {})
    if divider_manifest.get('customisable_colour') is not True:
        errors.append('Manifest omits customisable upper divider colours')
    if divider_manifest.get('default') != 'Black':
        errors.append('Manifest has the wrong upper divider default')
    if divider_manifest.get('modes') != [
            'Transparent / inherit parent', 'Black', 'DarkOne grey',
            'DarkOne dark grey', 'Columns UI global background',
            'Custom colour']:
        errors.append('Manifest upper divider colour modes are incomplete')
    if divider_manifest.get('shared_left_and_right_setting') is not True or \
            divider_manifest.get('geometry_unchanged') is not True or \
            divider_manifest.get('lower_dividers_unchanged') is not True:
        errors.append('Manifest upper divider scope/geometry flags are incomplete')
    if divider_manifest.get('menu_locations') != [
            'InfoStack tab context menu', 'upper divider strips']:
        errors.append('Manifest upper divider menu locations are incorrect')
    if divider_manifest.get('communication') != \
            'shared serialised JSplitter-to-JSplitter v1 protocol':
        errors.append('Manifest upper divider communication is incorrect')
    if divider_manifest.get('album_art_jscript_panel_bridge_removed') is not True:
        errors.append('Manifest does not record removal of the Album Art bridge')
    if divider_manifest.get('minimum_context_hit_target_px') != 10:
        errors.append('Manifest upper divider hit target is incorrect')
    divider_properties = divider_manifest.get('properties', [])
    for property_name in [
            'DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE',
            'DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR']:
        if property_name not in divider_properties:
            errors.append('Manifest upper divider property is missing: ' +
                          property_name)
    startup_manifest = manifest.get('enhancements', {}).get('startup', {})
    expected_startup = {
        'property_owner': 'DOJSP3.Root',
        'menu_location': 'InfoStack tab context menu',
        'communication': 'shared serialised JSplitter-to-JSplitter v1 protocol',
        'jsscript_panel_startup_menu_removed': True,
        'state_query_before_menu_display': True,
        'layout_readiness_timeout_label': True,
        'bridge_runtime_test': True,
        'root_owned_factory_defaults': True,
    }
    for key, expected in expected_startup.items():
        if startup_manifest.get(key) != expected:
            errors.append('Manifest startup field is incorrect: ' + key)


    info_stack_manifest = manifest.get('enhancements', {}).get('info_stack', {})
    if info_stack_manifest.get('automatic_tab_font_sizing') is not True:
        errors.append('Manifest omits InfoStack automatic tab sizing')
    if info_stack_manifest.get('automatic_font_base_scale_percent_default') != 100:
        errors.append('Manifest has the wrong InfoStack automatic scale default')
    if info_stack_manifest.get('automatic_font_base_scale_percent_range') != [50, 200]:
        errors.append('Manifest has the wrong InfoStack automatic scale range')
    if info_stack_manifest.get('automatic_tab_area_follows_font_scale') is not True:
        errors.append('Manifest omits automatic tab-area/font-scale correlation')
    if info_stack_manifest.get(
            'automatic_tab_area_scale_applies_in_automatic_font_mode') is not True:
        errors.append('Manifest omits automatic-only tab-area scale semantics')
    panel_titles = {p.get('title') for p in manifest.get('panels', []) if isinstance(p, dict)}
    for title in ['DOJSP3.Spectrum', 'DOJSP3.QuickSearch', 'DOJSP3.Waveform']:
        if title not in panel_titles:
            errors.append('Manifest panel inventory is missing ' + title)

# Reset bridge scope and ownership.
reset_import = '%fb2k_profile_path%DarkOneJSP3\\shared\\reset_defaults.js'
bridge_import = '%fb2k_component_path%samples\\js\\darkonejsp3_reset.js'
reset_entries: set[str] = set()
if samples.exists():
    for entry in samples.glob('*.txt'):
        body = text(entry)
        if reset_import in body or bridge_import in body:
            reset_entries.add(entry.name)
        if (reset_import in body) != (bridge_import in body):
            errors.append(rel(entry) + ' imports only half of the reset bridge')
expected_reset_entries = {
    'Album Notes.txt',
    'Last.fm Artist Info + User Info.txt',
    'Last.fm Bio.txt',
    'MusicBrainz.txt',
    'JS Playlist.txt',
    'Properties.txt',
    'Smooth Playlist Manager.txt',
}
if reset_entries != expected_reset_entries:
    errors.append(
        'Reset bridge import ownership mismatch: ' +
        ', '.join(sorted(reset_entries))
    )

# Any active entry script that calls the reset helper must import both halves.
reset_callback_entries = (
    sorted(samples.glob('*.txt')) +
    sorted((project / 'jscript').glob('*.txt')) +
    sorted((project / 'jsplitter' / 'loaders').glob('*.txt'))
)
for entry in reset_callback_entries:
    body = text(entry)
    if 'darkOneJsp3HandleSampleReset(' not in body:
        continue
    missing = []
    if reset_import not in body:
        missing.append('reset_defaults.js')
    if bridge_import not in body:
        missing.append('darkonejsp3_reset.js')
    if missing:
        errors.append(
            rel(entry) + ' calls the reset helper without importing ' +
            ' and '.join(missing)
        )

queue_entry = project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt'
if queue_entry.exists():
    body = text(queue_entry)
    if '// @version "0.5.2"' not in body:
        errors.append('DarkOneJSP3 Queue Viewer wrapper version is not 0.5.2')
    if 'darkOneJsp3HandleSampleReset(name, info, "queue-viewer")' not in body:
        errors.append('DarkOneJSP3 Queue Viewer reset callback is missing')
    if reset_import not in body or bridge_import not in body:
        errors.append('DarkOneJSP3 Queue Viewer reset bridge imports are incomplete')

common = samples / 'js' / 'common.js'
if common.exists():
    body = text(common)
    if 'darkOneJsp3HandleSampleReset' in body:
        errors.append('Generic common.js still contains the project reset bridge')
    if re.search(r'(^|\n)\s*include\s*\(', body):
        errors.append('samples/js/common.js contains a runtime include() call')

panel_helper = samples / 'js' / 'panel.js'
if panel_helper.exists():
    body = text(panel_helper)
    for token in [
        'options.darkonejsp3_page_background === true',
        "new _p('DARKONEJSP3.PAGE.BACKGROUND.MODE', 3)",
        "new _p('DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR', RGB(24, 24, 24))",
        "'Transparent / inherit parent'",
        "'DarkOne grey'",
        "'DarkOne dark grey'",
        "'Columns UI global background'",
        "'Page background colour'",
        'gr.Clear(this.page_background_colour())',
    ]:
        if token not in body:
            errors.append('Page-background helper is missing: ' + token)

page_background_entries = {
    samples / 'Last.fm Bio.txt': 'lastfm-bio',
    samples / 'Last.fm Artist Info + User Info.txt': 'lastfm-info',
    samples / 'Album Notes.txt': 'album-notes',
    project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt': 'queue-viewer',
    samples / 'Properties.txt': 'properties',
}
for entry, role in page_background_entries.items():
    if not entry.exists():
        continue
    body = text(entry)
    if 'new _panel({ darkonejsp3_page_background : true })' not in body:
        errors.append(rel(entry) + ' does not opt in to page backgrounds')
    if role not in body:
        errors.append(rel(entry) + ' does not identify its reset role: ' + role)

registry_path = project / 'shared' / 'reset_defaults.js'
if registry_path.exists():
    registry_body = text(registry_path)
    for role in ['lastfm-bio', 'lastfm-info', 'album-notes', 'queue-viewer', 'properties']:
        role_match = re.search(
            r'"' + re.escape(role) + r'"\s*:\s*\{(.*?)(?=\n    "[^"]+"\s*:\s*\{|\n\};)',
            registry_body, re.S)
        if not role_match:
            errors.append('Reset registry is missing page-background role: ' + role)
            continue
        block = role_match.group(1)
        for token in [
                '"DARKONEJSP3.PAGE.BACKGROUND.MODE": 3',
                '"DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818']:
            if token not in block:
                errors.append('Reset registry page-background default is missing for ' + role + ': ' + token)

album_notes = samples / 'Album Notes.txt'
if album_notes.exists():
    album_notes_entry_body = text(album_notes)
    token = 'darkOneJsp3HandleSampleReset(name, info, ["album-notes", "musicbrainz"])'
    if token not in album_notes_entry_body:
        errors.append('Album Notes does not reset embedded MusicBrainz settings')
    if '// @version "0.6.7"' not in album_notes_entry_body:
        errors.append('Album Notes entry version is not 0.6.7')

album_art_entry = samples / 'Album Art.txt'
if album_art_entry.exists():
    album_art_body = text(album_art_entry)
    for token in [
        'Side divider colour',
        'DarkOneJSP3.ArtSpectrum.Divider.',
        'darkOneJsp3Divider',
    ]:
        if token in album_art_body:
            errors.append('Album Art retains unsupported divider bridge: ' + token)

legacy_allmusic_entry = samples / 'Allmusic Review.txt'
if legacy_allmusic_entry.exists() and '// @version "0.6.6"' not in text(legacy_allmusic_entry):
    errors.append('Legacy AllMusic-slot Album Notes entry version is not 0.6.6')
allmusic_art_entry = samples / 'Allmusic Review + Album Art.txt'
if allmusic_art_entry.exists() and '// @version "0.6.4"' not in text(allmusic_art_entry):
    errors.append('AllMusic + Album Art entry version is not 0.6.4')

allmusic_impl = samples / 'js' / 'allmusic.js'
album_notes_impl = samples / 'js' / 'album_notes.js'
if allmusic_impl.exists():
    allmusic_body = text(allmusic_impl)
    for token in [
        'this.activate_managed = function (force)',
        'this.has_pending_work = function ()',
        "this.history = {};",
        "this.notify_terminal(false, 'provider did not start a request');",
        "this.notify_terminal(false, 'browser-verification backoff');",
        "this.notify_terminal(false, 'request could not be started');",
        "this.notify_terminal(false, 'artist or album tags are missing');",
        "this.notify_terminal(false, 'could not resolve the full AllMusic album page');",
    ]:
        if token not in allmusic_body:
            errors.append('AllMusic state-machine hardening is missing: ' + token)
if album_notes_impl.exists():
    album_notes_body = text(album_notes_impl)
    for token in [
        'this.allmusic.activate_managed(!!force);',
        'this.clear_allmusic_activation_guard = function ()',
        'this.allmusic_activation_timer = window.SetTimeout(function ()',
        "reason : 'provider activation produced no request or terminal result'",
        'this.clear_allmusic_activation_guard(); this.cancel_requests();',
    ]:
        if token not in album_notes_body:
            errors.append('Album Notes AllMusic activation guard is missing: ' + token)
musicbrainz = samples / 'MusicBrainz.txt'
if musicbrainz.exists() and 'darkOneJsp3HandleSampleReset(name, info, "musicbrainz")' not in text(musicbrainz):
    errors.append('Standalone MusicBrainz reset bridge is missing')
js_playlist_entry = samples / 'JS Playlist.txt'
if js_playlist_entry.exists():
    body = text(js_playlist_entry)
    if 'darkOneJsp3HandleSampleReset(name, info, "js-playlist")' not in body:
        errors.append('JS Playlist reset bridge is missing')
    if '// @version "0.4.7"' not in body:
        errors.append('JS Playlist entry version is not 0.4.7')

js_playlist_settings = samples / 'jsplaylist' / 'settings.js'
if js_playlist_settings.exists():
    body = text(js_playlist_settings)
    for token in [
        'function createSettingsBackArrow(colour, size)',
        'var image = utils.CreateImage(size, size);',
        'var samplesPerAxis = 4;',
        'function containsPoint(px, py)',
        'gr.FillRectangle(x, y, 1, 1, setAlpha(colour, alpha));',
        'createSettingsBackArrow(this.color2, button_zoomSize)',
        'createSettingsBackArrow(this.color1, button_zoomSize)',
    ]:
        if token not in body:
            errors.append('JS Playlist settings back-arrow correction is missing: ' + token)
    for obsolete in [
        'utils.CreateImage(75, 75)',
        'close_off.Resize(button_zoomSize, button_zoomSize)',
        'close_ov.Resize(button_zoomSize, button_zoomSize)',
        'gb.DrawLine(21, 36, 36, 21, 3, this.color2)',
        'gr.DrawLine(headX, centreY - headOffset, tipX, centreY, stroke, colour)',
        'gr.DrawLine(tipX, centreY, headX, centreY + headOffset, stroke, colour)',
        'gr.DrawLine(tipX, centreY, shaftEndX, centreY, stroke, colour)',
    ]:
        if obsolete in body:
            errors.append('JS Playlist retains overlapping/resampled back-arrow code: ' + obsolete)
playlist_manager_entry = samples / 'Smooth Playlist Manager.txt'
if playlist_manager_entry.exists():
    body = text(playlist_manager_entry)
    if 'darkOneJsp3HandleSampleReset(name, info, "playlist-manager")' not in body:
        errors.append('Smooth Playlist Manager reset bridge is missing')
    if '// @version "0.4.10"' not in body:
        errors.append('Smooth Playlist Manager entry version is not 0.4.10')

playlist_manager_impl = samples / 'smooth' / 'jsspm.js'
if playlist_manager_impl.exists():
    body = text(playlist_manager_impl)
    for token in [
        'ppt.alternatingRowShading = window.GetProperty(',
        '"SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS"',
        'CheckMenuIf(ppt.alternatingRowShading)',
        'if (ppt.alternatingRowShading && i % 2 != 0)',
    ]:
        if token not in body:
            errors.append('Playlist Manager alternating-row control is missing: ' + token)
    for token in [
        'timers.repaint = window.SetInterval(function () {',
        'timers.initialPopulate = window.SetTimeout(function () {',
        'function clearPlaylistManagerTimers()',
        'window.ClearInterval(timers.repaint);',
        'window.ClearTimeout(timers.initialPopulate);',
        'window.ClearInterval(timers.movePlaylist);',
        'window.ClearInterval(cScrollBar.timerID);',
        'window.ClearInterval(cInputbox.timer_cursor);',
        'window.ClearTimeout(brw.inputbox.launch_timer);',
        'window.ClearTimeout(g_filterbox.inputbox.launch_timer);',
        'clearPlaylistManagerTimers();',
    ]:
        if token not in body:
            errors.append('Playlist Manager timer cleanup is missing: ' + token)

registry_path = project / 'shared' / 'reset_defaults.js'
if registry_path.exists():
    registry = text(registry_path)
    for role in ['control-left', 'control-right', 'display', 'root', 'main-columns', 'info-stack',
                 'display-waveform', 'album-notes', 'musicbrainz', 'queue-viewer',
                 'js-playlist', 'playlist-manager']:
        if f'"{role}"' not in registry:
            errors.append('Reset role missing: ' + role)
    for token in [
        'darkOneJsp3AddOptionalButtonDefaults("control-left", 8);',
        'darkOneJsp3AddOptionalButtonDefaults("control-right", 10);',
        'add(entry.complete || {});',
    ]:
        if token not in registry:
            errors.append('Optional-button reset coverage is missing: ' + token)
    playlist_defaults = [
        '"JSPLAYLIST.Enable Smooth Scrolling": true',
        '"JSPLAYLIST.UI Refresh Interval (ms)": 8',
        '"JSPLAYLIST.Smooth Scroll Divisor": 2',
        '"JSPLAYLIST.Playlist Wheel Throttle (ms)": 8',
        '"JSPLAYLIST.Playlist Scroll Step": 3',
        '"JSPLAYLIST.Snap Wheel Scrolling To Rows": true',
        '"JSPLAYLIST.Snap Scrollbar Dragging To Rows": true',
        '"JSPLAYLIST.Free Wheel Step (pixels)": 0',
    ]
    manager_defaults = [
        '"SMOOTH.UI.REFRESH.INTERVAL.MS": 8',
        '"SMOOTH.SCROLL.SMOOTHNESS": 1.75',
        '"SMOOTH.ROW.SCROLL.STEP": 3',
        '"SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL": true',
        '"SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE": true',
        '"SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER": true',
        '"SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH": 300',
        '"SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT": 26',
        '"SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS": true',
        '"SMOOTH.PLAYLIST.MANAGER.SCROLL": 0',
        '"SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2": ""',
    ]
    for token in playlist_defaults:
        if token not in registry:
            errors.append('JS Playlist reset default is missing: ' + token)
    for token in manager_defaults:
        if token not in registry:
            errors.append('Playlist Manager reset default is missing: ' + token)
    for token in [
        '"DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE": 1',
        '"DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR": 0xff000000',
    ]:
        if token not in registry:
            errors.append('Upper divider reset default is missing: ' + token)

for path in [project / 'jsplitter' / '04_art_spectrum.js',
             project / 'jsplitter' / '05_bottom_controls.js']:
    if path.exists() and 'DARKONEJSP3_RESET_ROLE' in text(path):
        errors.append(rel(path) + ' declares a no-op reset role')

shared = project / 'jsplitter' / 'shared.js'
if shared.exists() and 'if (!role || !DARKONEJSP3_RESET_REGISTRY[role]) return true;' not in text(shared):
    errors.append('JSplitter reset handler does not skip hosts without settings')

# Obsolete property migrations and helper parameters.
display_system = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
if display_system.exists():
    body = text(display_system)
    if 'Display Colour (0-5)' in body or 'DARKONE_DISPLAY_LEGACY_COLOURS' in body:
        errors.append('Obsolete Display Colour (0-5) migration remains active')
config = project / 'jscript' / 'js' / 'Config_Global_Script.js'
if config.exists():
    body = text(config)
    if 'function darkOneNumberProperty(name, legacyName,' in body:
        errors.append('darkOneNumberProperty still accepts legacyName')
    if 'function darkOneStringProperty(name, legacyName,' in body:
        errors.append('darkOneStringProperty still accepts legacyName')
    for token in [
        'function darkOneResetScope(info)',
        "JSON.stringify({ version : 1, scope : scope })",
    ]:
        if token not in body:
            errors.append('Control-panel reset bridge is missing: ' + token)
    if "NotifyOthers('DarkOneJSP3.Reset.Properties', { scope : scope })" in body:
        errors.append('Control-panel reset still sends an object payload')

sample_reset = samples / 'js' / 'darkonejsp3_reset.js'
if sample_reset.exists():
    body = text(sample_reset)
    for token in [
        'function darkOneJsp3SampleResetScope(info)',
        'var scope = darkOneJsp3SampleResetScope(info);',
        'JSON.parse(info)',
    ]:
        if token not in body:
            errors.append('Sample reset bridge is missing serialised parsing: ' + token)
if shared.exists():
    body = text(shared)
    for token in [
        'function darkOneJsp3ResetScope(data)',
        'var scope = darkOneJsp3ResetScope(data);',
        'JSON.parse(data)',
    ]:
        if token not in body:
            errors.append('JSplitter reset bridge is missing serialised parsing: ' + token)

# Documentation consistency.
version_docs = [root / 'README.md', docs / 'README.txt', docs / 'VALIDATION_REPORT.txt']
for path in version_docs:
    if path.exists() and version and version not in text(path):
        errors.append(rel(path) + ' does not identify the current version')

# Public user documentation may identify the current package, but release
# history belongs only in CHANGELOG.txt.
public_docs = [root / 'README.md'] + [
    path for path in docs.glob('*.txt') if path.name != 'CHANGELOG.txt'
]
for path in public_docs:
    if not path.exists():
        continue
    for documented_version in re.findall(r'\bv(\d+\.\d+\.\d+)\b', text(path)):
        if documented_version != version:
            errors.append(
                rel(path) + ' references an earlier package version outside CHANGELOG.txt: v' +
                documented_version
            )

changelog = docs / 'CHANGELOG.txt'
if changelog.exists():
    lines = text(changelog).splitlines()
    if not lines or lines[0] != 'DarkOneJSP3 Changelog':
        errors.append('CHANGELOG.txt title is not at the beginning')
    if lines.count('DarkOneJSP3 Changelog') != 1:
        errors.append('CHANGELOG.txt must contain exactly one title')
    if f'v{version} - ' not in text(changelog):
        errors.append('CHANGELOG.txt does not contain the current release')
    for i, line in enumerate(lines[:-1]):
        if re.fullmatch(r'v\d+\.\d+(?:\.\d+)?(?:\.x)? - .+', line):
            if lines[i + 1] != '-' * len(line):
                errors.append(f'CHANGELOG heading underline mismatch at line {i + 1}')


readme_path = root / 'README.md'
if readme_path.exists():
    readme_body = text(readme_path)
    # The canonical repository README references promotional artwork maintained
    # alongside the GitHub repository rather than the runtime release payload.
    repository_only_assets = {
        'assets/darkonejsp3-logo.png',
        'assets/darkonejsp3-screenshot-main.jpg',
        'assets/darkonejsp3-screenshot-albumnotes.jpg',
    }
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', readme_body):
        if '://' in target or target.startswith('#') or \
                target in repository_only_assets:
            continue
        resolved = (root / target.replace('/', os.sep)).resolve()
        if not resolved.exists():
            errors.append('README link target is missing: ' + target)

def is_heading_underline(value: str) -> bool:
    return len(value) >= 3 and len(set(value)) == 1 and value[0] in '=-~'


def numbered_document_sections(path: Path) -> tuple[list[tuple[int, str]], list[tuple[int, str]]]:
    lines = text(path).splitlines()
    contents: list[tuple[int, str]] = []
    body: list[tuple[int, str]] = []

    try:
        contents_index = lines.index('Contents')
    except ValueError:
        contents_index = -1
    if contents_index >= 0:
        i = contents_index + 2
        while i < len(lines) and lines[i].strip():
            match = re.fullmatch(r'(\d+)\. (.+)', lines[i])
            if match:
                contents.append((int(match.group(1)), match.group(2)))
            i += 1

    for i in range(len(lines) - 1):
        match = re.fullmatch(r'(\d+)\. (.+)', lines[i])
        if match and set(lines[i + 1]) == {'-'}:
            body.append((int(match.group(1)), match.group(2)))

    return contents, body


for path in docs.glob('*.txt'):
    lines = text(path).splitlines()
    for i, line in enumerate(lines):
        if is_heading_underline(line) and (i == 0 or len(line) != len(lines[i - 1])):
            errors.append(f'{rel(path)} heading underline mismatch at line {i + 1}')

for path in [
    docs / 'CONFIGURATION_GUIDE.txt',
    docs / 'INSTALLATION.txt',
    docs / 'TROUBLESHOOTING.txt',
]:
    if not path.exists():
        continue
    contents_sections, body_sections = numbered_document_sections(path)
    if contents_sections != body_sections:
        errors.append(rel(path) + ' contents do not match its numbered sections')
    numbers = [number for number, _ in body_sections]
    if numbers != list(range(1, len(numbers) + 1)):
        errors.append(rel(path) + ' numbered sections are not unique and sequential')

config_guide = docs / 'CONFIGURATION_GUIDE.txt'
if config_guide.exists():
    body = text(config_guide)
    if '12. Resetting DarkOneJSP3' not in body:
        errors.append('Configuration guide contents omit the reset section')
    if body.count('Album Notes cache files and downloaded provider data') > 1:
        errors.append('Configuration guide repeats cache-preservation guidance')
    for phrase in [
        'The enhanced JS Playlist participates in behaviour and full resets',
        'Full reset additionally',
        'clears its saved scroll anchors',
        'Set automatic base scale adjusts that calculation',
        'When tab-area height is also automatic',
        'Alternating row shading',
        'DarkOneJSP3-managed defaults',
        'DarkOne dark grey: RGB 24, 24, 24',
        'Generic upstream sample customisation',
        'DarkOneJSP3 Queue Viewer',
        'Album Art/Spectrum side dividers',
        'Side divider colour',
        'InfoStack tab strip',
        'generic Album Art JScript Panel does not own this setting',
        'Transparent / inherit parent',
        'The lower control-panel dividers are not changed',
        'Page background colour',
        'DarkOne dark grey: RGB 24, 24, 24 (default)',
        'Each page remembers its own setting independently',
    ]:
        if phrase not in body:
            errors.append('Configuration guide playlist reset coverage is missing: ' + phrase)
troubleshooting = docs / 'TROUBLESHOOTING.txt'
if troubleshooting.exists():
    body = text(troubleshooting)
    if '7. Factory reset' not in body or '8. Diagnostics to include in a bug report' not in body:
        errors.append('Troubleshooting sections are not in the expected order')
    if re.search(r'\bv\d+\.\d+\.\d+\b', body) or 'Install v' in body:
        errors.append('Troubleshooting contains development-version upgrade advice')
    for phrase in [
        'The DarkOneJSP3 Queue Viewer wrapper must import both reset_defaults.js',
        'DarkOneJSP3-managed properties',
        'DarkOneJSP3 wrapper rather than the generic sample entry',
        'Right-click the InfoStack tab strip',
        'generic Album Art JScript Panel',
        'cross-component notification path is not reliable',
        'The supported Startup menu is on the InfoStack tab strip',
        'explicitly reactivates an idle same-album lookup',
    ]:
        if phrase not in body:
            errors.append('Troubleshooting current-state guidance is missing: ' + phrase)

info_stack_controller = project / 'jsplitter' / '03_info_stack_tabs.js'
info_stack_colours = project / 'jsplitter' / 'info_stack_colours.js'
info_stack_bridges = project / 'jsplitter' / 'info_stack_bridges.js'
if info_stack_controller.exists():
    body = text(info_stack_controller)
    for token in [
        r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_colours.js');",
        r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_bridges.js');",
        'appendInfoStackTabColourMenu(tabColourMenu);',
        'appendInfoStackBackgroundMenu(backgroundMenu);',
        'appendInfoStackDividerMenu(dividerMenu);',
        'appendInfoStackStartupMenu(startupMenu, startupTransitionMenu);',
        'handleInfoStackColourMenu(id)',
        'handleInfoStackBridgeMenu(id)',
        'handleInfoStackBridgeNotification(name, data)',
        'requestInfoStackBridgeStates();',
    ]:
        if token not in body:
            errors.append('InfoStack helper integration is missing: ' + token)
    for obsolete in [
        'function backgroundMode()',
        'function requestDividerState()',
        'function applyStartupMenuState(state)',
        'var DIVIDER_PROTOCOL = DarkOneProtocol.divider;',
        'var BACKGROUND_TRANSPARENT = 0;',
    ]:
        if obsolete in body:
            errors.append('InfoStack controller retains extracted logic: ' + obsolete)
if info_stack_colours.exists():
    body = text(info_stack_colours)
    for token in [
        'var BACKGROUND_CUSTOM = 3;',
        'var BACKGROUND_DARKONE_DARK = 4;',
        'var BACKGROUND_COLUMNS_UI = 5;',
        "{ id: 703, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' }",
        "{ id: 705, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' }",
        "{ id: 704, mode: BACKGROUND_CUSTOM, custom: true }",
        'var TAB_COLOUR_COLUMNS_UI_SELECTED = 2;',
        "{ id: 802, mode: TAB_COLOUR_COLUMNS_UI_SELECTED, label: 'Columns UI selected-item background' }",
        "{ id: 801, mode: TAB_COLOUR_CUSTOM, custom: true }",
        'DarkOneColour.normaliseMode(',
        'DarkOneColour.appendRadioOptions(',
        'DarkOneColour.pickJsplitter(',
        'DarkOneColour.columnsUi(4, DOJSP3.colours.buttonNormal)',
        'function handleInfoStackColourMenu(id)',
    ]:
        if token not in body:
            errors.append('InfoStack colour helper is missing: ' + token)
if info_stack_bridges.exists():
    body = text(info_stack_bridges)
    for token in [
        'var STARTUP_PROTOCOL = DarkOneProtocol.startup;',
        'var DIVIDER_PROTOCOL = DarkOneProtocol.divider;',
        'var DIVIDER_DARKONE_DARK = DIVIDER_PROTOCOL.modes.darkOneDark;',
        'var DIVIDER_COLUMNS_UI = DIVIDER_PROTOCOL.modes.columnsUi;',
        'var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(900);',
        'DIVIDER_PROTOCOL.notifications.query',
        'DIVIDER_PROTOCOL.notifications.set',
        'DIVIDER_PROTOCOL.notifications.state',
        'DIVIDER_PROTOCOL.serialiseState(',
        'DIVIDER_PROTOCOL.parseState(data)',
        'STARTUP_PROTOCOL.notifications.queryControls',
        'STARTUP_PROTOCOL.notifications.commandControls',
        'STARTUP_PROTOCOL.notifications.stateControls',
        'STARTUP_PROTOCOL.parseState(data)',
        'function requestStartupControlState()',
        'function sendStartupControlCommand(action, key, value)',
        'function handleInfoStackBridgeMenu(id)',
        'function handleInfoStackBridgeNotification(name, data)',
    ]:
        if token not in body:
            errors.append('InfoStack bridge helper is missing: ' + token)

display_system_path = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
if display_system_path.exists():
    body = text(display_system_path)
    for token in [
        'var DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED = 2;',
        'var DARKONE_DISPLAY_ACCENT_MODES = [',
        'DarkOneColour.normaliseMode(',
        'DarkOneColour.columnsUi(4, DARKONE_DISPLAY_DEFAULT_BLUE)',
        'if (this.accent_mode == DARKONE_DISPLAY_ACCENT_DEFAULT) return;',
    ]:
        if token not in body:
            errors.append('Display selected-item accent is missing: ' + token)

display_panel_path = project / 'jscript' / 'js' / 'Panel_Display.js'
if display_panel_path.exists():
    body = text(display_panel_path)
    for token in [
        'var DARKONE_DISPLAY_ACCENT_MENU_OPTIONS = [',
        'DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED',
        'DarkOneColour.appendRadioOptions(',
        'DarkOneColour.pickJscript(',
        'if (chosen === null) break;',
    ]:
        if token not in body:
            errors.append('Display accent menu consolidation is missing: ' + token)

# Established startup and layout invariants.
root_controller = project / 'jsplitter' / '01_root.js'
if root_controller.exists():
    body = text(root_controller)
    for token in [
        'var STARTUP_PREPAINT_DELAY_MS = 150;',
        'var STARTUP_STAGE_GAP_MS = 125;',
        'setRootVisibility(false, false);',
        'window.Repaint();',
        'var STARTUP_PROTOCOL = DarkOneProtocol.startup;',
        'var STARTUP_CONTROLLERS = STARTUP_PROTOCOL.controllers;',
        'STARTUP_PROTOCOL.serialiseState(startupControlState())',
        'STARTUP_PROTOCOL.parseCommand(data)',
        'STARTUP_PROTOCOL.notifications.queryControls',
        'STARTUP_PROTOCOL.notifications.commandControls',
        'STARTUP_PROTOCOL.notifications.ready',
        "if (key === 'readiness-timeout') return STARTUP_SAFETY_TIMEOUT_PROPERTY;",
        'function restoreStartupDefaults()',
    ]:
        if token not in body:
            errors.append('Startup reveal invariant is missing: ' + token)
    for obsolete in [
        "'DarkOneJSP3.Startup.Preview'",
        "'DarkOneJSP3.Settings.Batch'",
        "'DarkOneJSP3.SetProperty'",
        'function applySharedStartupProperty',
        'function applySharedStartupBatch',
    ]:
        if obsolete in body:
            errors.append('Root retains obsolete startup bridge: ' + obsolete)
info_stack = project / 'jsplitter' / '03_info_stack_tabs.js'
if info_stack.exists():
    body = text(info_stack)
    if 'hideInfoChildrenBeforeFirstLayout();' not in body or 'child.Show(false);' not in body:
        errors.append('InfoStack no longer hides children during initialisation')
    for token in [
        "var AUTO_FONT_SCALE_PROPERTY = 'DarkOneJSP3.InfoStack.AutoFontScale';",
        'function automaticFontScale()',
        'DOJSP3.clamp(value, 50, 200)',
        'baseSize * automaticFontScale() / 100',
        'var baseGap = DOJSP3.idiv(ww, 40);',
        'var gapScale = fixedFontSize > 0 ? 100 : automaticFontScale();',
        'baseGap * gapScale / 100',
        "'Set automatic base scale... (' + automaticFontScale() + '%)'",
        "'Automatic height (follows tab font sizing)'",
        "'Set fixed tab area height...'",
        "'Side divider colour'",
        r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_colours.js');",
        r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_bridges.js');",
        'appendInfoStackTabColourMenu(tabColourMenu);',
        'appendInfoStackBackgroundMenu(backgroundMenu);',
        'appendInfoStackDividerMenu(dividerMenu);',
        'appendInfoStackStartupMenu(startupMenu, startupTransitionMenu);',
        'requestInfoStackBridgeStates();',
        'handleInfoStackBridgeNotification(name, data)',
    ]:
        if token not in body:
            errors.append('InfoStack automatic-font scale is missing: ' + token)
    for obsolete in [
        "'Set tab area height... ('",
        "'Set tab area height...'",
    ]:
        if obsolete in body:
            errors.append('InfoStack retains contradictory tab-area wording: ' + obsolete)

config_global = project / 'jscript' / 'js' / 'Config_Global_Script.js'
if config_global.exists():
    body = text(config_global)
    for obsolete in [
        'DARKONEJSP3_STARTUP_DEFAULTS',
        'darkOneStartupTransition',
        'darkOneStartupMinimumDelay',
        'darkOneStartupSafetyTimeout',
        'darkOneSetStartupNumberProperty',
        'darkOnePreviewStartupTransition',
        "startup.AppendTo(m, MF_STRING, 'Startup')",
        "'DARKONEJSP3.STARTUP.TRANSITION'",
        "'DARKONEJSP3.STARTUP.MINIMUM.DELAY'",
        "'DARKONEJSP3.STARTUP.SAFETY.TIMEOUT'",
    ]:
        if obsolete in body:
            errors.append('JScript Panel retains obsolete startup control: ' + obsolete)

main_columns = project / 'jsplitter' / '02_main_columns.js'
if main_columns.exists():
    body = text(main_columns)
    for token in [
        'var px = Math.max(1, DOJSP3.idiv(ww, 640));',
        'var dividerCentre = DOJSP3.idiv(ww, 3);',
        'var artLeft = DOJSP3.clamp(leftWidth + px * 2, leftWidth, playlistLeft);',
        'var rightDivider = Math.max(artLeft, playlistLeft - px * 2);',
        'var artWidth = Math.max(1, rightDivider - artLeft);',
        "var DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE';",
        "'DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR';",
        'function dividerColour()',
        'if (mode === DIVIDER_BLACK) return 0xff000000;',
        'if (mode === DIVIDER_DARKONE) return DOJSP3.colours.bar;',
        'if (mode === DIVIDER_DARKONE_DARK) return DOJSP3.colours.separator;',
        'if (mode === DIVIDER_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);',
        'if (mode === DIVIDER_CUSTOM) return dividerCustomColour();',
        'if (dividerMode() === DIVIDER_TRANSPARENT) return;',
        'gr.FillSolidRect(metrics.left, 0, metrics.width, wh, colour);',
        'gr.FillSolidRect(metrics.right, 0, metrics.width, wh, colour);',
        'DIVIDER_PROTOCOL.notifications.query',
        'DIVIDER_PROTOCOL.notifications.set',
        "'Side divider colour'",
        'var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(100);',
        'var DIVIDER_DARKONE_DARK = DIVIDER_PROTOCOL.modes.darkOneDark;',
        'var DIVIDER_COLUMNS_UI = DIVIDER_PROTOCOL.modes.columnsUi;',
        'DarkOneColour.pickJsplitter(',
        'DarkOneColour.appendRadioOptions(',
        'DIVIDER_PROTOCOL.serialiseState(dividerState())',
        'DIVIDER_PROTOCOL.parseState(data)',
        'var targetWidth = Math.max(10, metrics.width);',
    ]:
        if token not in body:
            errors.append('Verified main-column geometry is missing: ' + token)
    for obsolete in [
        'gr.FillSolidRect(leftDivider, 0, px * 2, wh, 0xff000000);',
        'gr.FillSolidRect(rightDivider, 0, px * 2, wh, 0xff000000);',
    ]:
        if obsolete in body:
            errors.append('Upper divider remains hard-coded black: ' + obsolete)

bottom_controls = project / 'jsplitter' / '05_bottom_controls.js'
if bottom_controls.exists():
    body = text(bottom_controls)
    for token in [
        'var leftDivider = DOJSP3.idiv(ww, 3) - px;',
        'var rightDivider = ww - DOJSP3.idiv(ww, 3) - px;',
        'gr.FillSolidRect(leftDivider, 0, px * 2, wh, DOJSP3.colours.separator);',
        'gr.FillSolidRect(rightDivider, 0, px * 2, wh, DOJSP3.colours.separator);',
    ]:
        if token not in body:
            errors.append('Verified lower-divider geometry is missing: ' + token)

display_waveform = project / 'jsplitter' / '06_display_waveform.js'
if display_waveform.exists():
    body = text(display_waveform)
    for token in [
        'var BACKGROUND_CUSTOM = 3;',
        'var BACKGROUND_DARKONE_DARK = 4;',
        'var BACKGROUND_COLUMNS_UI = 5;',
        'var BACKGROUND_MODES = [',
        "{ id: 104, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' }",
        "{ id: 105, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' }",
        "{ id: 103, mode: BACKGROUND_CUSTOM, custom: true }",
        'if (mode === BACKGROUND_DARKONE_DARK) return DOJSP3.colours.separator;',
        'if (mode === BACKGROUND_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);',
        'DarkOneColour.normaliseMode(',
        'DarkOneColour.appendRadioOptions(',
        'DarkOneColour.pickJsplitter(',
        'function on_colours_changed()',
    ]:
        if token not in body:
            errors.append('Waveform background palette is missing: ' + token)

art_spectrum = project / 'jsplitter' / '04_art_spectrum.js'
if art_spectrum.exists():
    body = text(art_spectrum)
    if not re.search(r'var\s+inset\s*=\s*0\s*;', body):
        errors.append('Album Art/Spectrum controller does not use zero inset')
    if 'var width = Math.max(1, ww);' not in body:
        errors.append('Album Art/Spectrum controller does not fill its host')

colour_helper = project / 'shared' / 'colour_utils.js'
if colour_helper.exists():
    body = text(colour_helper)
    for token in [
        'var DarkOneColour = Object.freeze({',
        'opaque: function (colour)',
        'toHex: function (colour)',
        'columnsUi: function (index, fallback)',
        'parseOpaque: function (value)',
        'normaliseMode: function (value, allowedModes, fallback)',
        'appendRadioOptions: function (menu, options, selectedMode, customColour, flags)',
        'pickJsplitter: function (current, title, prompt)',
        'pickJscript: function (current, title, prompt)',
    ]:
        if token not in body:
            errors.append('Shared colour helper is missing: ' + token)

jsplitter_shared = project / 'jsplitter' / 'shared.js'
if jsplitter_shared.exists() and \
        'DarkOneJSP3\\\\shared\\\\jsplitter_protocols.js' not in text(jsplitter_shared):
    errors.append('JSplitter shared loader does not import the protocol helper')

protocol_helper = project / 'shared' / 'jsplitter_protocols.js'
if protocol_helper.exists():
    body = text(protocol_helper)
    for token in [
        'var DarkOneProtocol = (function () {',
        "queryControls: 'DarkOneJSP3.Startup.Controls.Query'",
        "commandControls: 'DarkOneJSP3.Startup.Controls.Command'",
        "stateControls: 'DarkOneJSP3.Startup.Controls.State'",
        "ready: 'DarkOneJSP3.Startup.Ready'",
        "queryReady: 'DarkOneJSP3.Startup.QueryReady'",
        'serialiseState: serialiseStartupState',
        'parseState: parseStartupState',
        'serialiseCommand: serialiseStartupCommand',
        'parseCommand: parseStartupCommand',
        'createReadinessBridge: createReadinessBridge',
        "query: 'DarkOneJSP3.ArtSpectrum.Divider.Query'",
        "set: 'DarkOneJSP3.ArtSpectrum.Divider.Set'",
        "state: 'DarkOneJSP3.ArtSpectrum.Divider.State'",
        'serialiseState: serialiseDividerState',
        'parseState: parseDividerState',
        'menuOptions: dividerMenuOptions',
    ]:
        if token not in body:
            errors.append('Shared JSplitter protocol helper is missing: ' + token)

for path in [
    project / 'jsplitter' / '02_main_columns.js',
    project / 'jsplitter' / '03_info_stack_tabs.js',
    project / 'jsplitter' / '06_display_waveform.js',
    samples / 'js' / 'panel.js',
    project / 'jscript' / 'js' / 'Panel_Display.js',
]:
    if not path.exists():
        continue
    body = text(path)
    for duplicate in ['function colourToHex(', 'function parseOpaqueColour(', 'function opaqueColour(']:
        if duplicate in body:
            errors.append(rel(path) + ' retains duplicate colour helper: ' + duplicate)

for path in [
    project / 'jsplitter' / '01_root.js',
    project / 'jsplitter' / '02_main_columns.js',
    project / 'jsplitter' / '03_info_stack_tabs.js',
    project / 'jsplitter' / '04_art_spectrum.js',
    project / 'jsplitter' / '05_bottom_controls.js',
    project / 'jsplitter' / '06_display_waveform.js',
]:
    if not path.exists():
        continue
    body = text(path)
    for duplicate in [
        "var STARTUP_CONTROL_MESSAGE_VERSION = 'v1';",
        "var DIVIDER_MESSAGE_VERSION = 'v1';",
        'function parseStartupControlState(',
        'function parseDividerStateMessage(',
        'function serialiseDividerState(',
        'function signalStartupReady(',
    ]:
        if duplicate in body:
            errors.append(rel(path) + ' retains duplicate JSplitter protocol code: ' + duplicate)

adapted_colour_entries = [
    samples / 'Last.fm Bio.txt',
    samples / 'Last.fm Artist Info + User Info.txt',
    samples / 'Album Notes.txt',
    samples / 'Properties.txt',
    project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt',
    project / 'jscript' / 'DarkOneJSP3 - Display Panel.txt',
]
for path in adapted_colour_entries:
    if path.exists() and 'DarkOneJSP3\\shared\\colour_utils.js' not in text(path):
        errors.append(rel(path) + ' does not import the shared colour helper')

optional_button_helper = project / 'jscript' / 'js' / 'Buttons_OptionalMenu.js'
if optional_button_helper.exists():
    body = text(optional_button_helper)
    for token in [
        'var DARKONE_CONTROL_BUTTON_MENU = {',
        'function darkOneOptionalButtonEditId(buttonNames)',
        'function darkOneAppendOptionalButtonMenu(menu, buttonNames, buttonProperties)',
        'function darkOneAppendButtonRoundnessMenu(menu)',
        'function darkOneConfigureOptionalButton(buttonIndex, buttonNames, buttonProperties)',
        'function darkOneHandleControlButtonMenuSelection(index, options)',
        'function darkOneShowControlButtonMenu(x, y, options)',
        "optionalFirstId: 101",
        "redetectId: 120",
        "guideId: 121",
        "roundnessFirstId: 401",
        "roundnessCustomId: 407",
        "toolsId: 900",
        "roundnessValues: [-1, 0, 20, 33, 60, 100]",
    ]:
        if token not in body:
            errors.append('Shared optional-button menu helper is missing: ' + token)

control_entries = [
    project / 'jscript' / 'DarkOneJSP3 - Control Panel - Left.txt',
    project / 'jscript' / 'DarkOneJSP3 - Control Panel - Right.txt',
]
for path in control_entries:
    if not path.exists():
        continue
    body = text(path)
    if 'DarkOneJSP3\\jscript\\js\\Buttons_OptionalMenu.js' not in body:
        errors.append(rel(path) + ' does not import the shared optional-button menu')
    if '@version "3.0.12-jsp3-3.8.5"' not in body:
        errors.append(rel(path) + ' has the wrong consolidated control-panel version')

control_panels = [
    project / 'jscript' / 'js' / 'Panel_Control_Left.js',
    project / 'jscript' / 'js' / 'Panel_Control_Right.js',
]
for path in control_panels:
    if not path.exists():
        continue
    body = text(path)
    if 'darkOneShowControlButtonMenu(x, y, {' not in body:
        errors.append(rel(path) + ' does not use the shared optional-button menu')
    for duplicate in [
        "Enter your main menu, context menu or trusted local JavaScript command here:",
        'Re-detect command types',
        'Command guide...',
        'Custom roundness...',
        'var round_values = [-1, 0, 20, 33, 60, 100];',
    ]:
        if duplicate in body:
            errors.append(rel(path) + ' retains duplicated optional-button menu logic: ' + duplicate)
left_control_panel = project / 'jscript' / 'js' / 'Panel_Control_Left.js'
if left_control_panel.exists():
    body = text(left_control_panel)
    for token in [
        'appendExtraMenus: function (rootMenu)',
        'styleMenu.AppendTo(rootMenu, 0 | 16, "Button style")',
        'depthMenu.AppendTo(rootMenu, 0 | 16, "Button depth")',
        'handleExtraSelection: function (index)',
    ]:
        if token not in body:
            errors.append('Control Left lost its panel-specific menu behaviour: ' + token)

# Resolve local JScript Panel preprocessor imports.
import_re = re.compile(r'^//\s*@import\s+"([^"]+)"', re.M)
entry_scripts = sorted(samples.glob('*.txt')) + sorted((project / 'jscript').glob('*.txt'))
entry_scripts += sorted((project / 'jsplitter' / 'loaders').glob('*.txt'))
for entry in entry_scripts:
    for value in import_re.findall(text(entry)):
        target: Path | None = None
        if value.startswith('%fb2k_component_path%helpers.txt'):
            target = root / 'user-components-x64' / 'foo_jscript_panel3' / 'helpers.txt'
        elif value.startswith('%fb2k_component_path%samples\\'):
            target = samples / value.split('%fb2k_component_path%samples\\', 1)[1].replace('\\', '/')
        elif value.startswith('%fb2k_profile_path%DarkOneJSP3\\'):
            target = project / value.split('%fb2k_profile_path%DarkOneJSP3\\', 1)[1].replace('\\', '/')
        elif value in {'lodash'}:
            continue
        if target is not None and not target.exists():
            errors.append(rel(entry) + ' imports missing file ' + rel(target))

# Compatibility mirrors.
sync_tool = project / 'tools' / 'sync_mirrors.py'
if sync_tool.exists():
    result = subprocess.run([sys.executable, str(sync_tool), '--check', str(root)],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Compatibility mirror check failed: ' +
                      (result.stdout + result.stderr).strip())

# Real syntax and compilation checks.
node = shutil.which('node')
if not node:
    errors.append('Node.js is required for JavaScript syntax validation')
else:
    for path in sorted(root.rglob('*.js')):
        result = subprocess.run([node, '--check', str(path)], capture_output=True, text=True)
        if result.returncode:
            errors.append('JavaScript syntax failed for ' + rel(path) + ': ' +
                          result.stderr.strip())
    with tempfile.TemporaryDirectory() as temp:
        temp_dir = Path(temp)
        for index, path in enumerate(entry_scripts):
            target = temp_dir / f'entry_{index}.js'
            target.write_text(text(path), encoding='utf-8')
            result = subprocess.run([node, '--check', str(target)],
                                    capture_output=True, text=True)
            if result.returncode:
                errors.append('Entry-script syntax failed for ' + rel(path) + ': ' +
                              result.stderr.strip())

    # Exercise the shared colour conversions, declarative menu mapping and
    # host-specific picker cancellation/fallback behaviour.
    colour_helper_smoke = f"""
const fs = require('fs');
const source = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
let pickerCalls = [];
let inputCalls = 0;
const utilsMock = {{
    ColourPicker() {{ pickerCalls.push([...arguments]); return null; }},
    InputBox() {{ inputCalls++; return '#123456'; }}
}};
const factory = new Function('utils', source + '\\nreturn DarkOneColour;');
const colour = factory(utilsMock);
function assert(condition, message) {{ if (!condition) throw new Error(message); }}
assert((colour.opaque(0x00123456) >>> 0) === 0xff123456, 'Opaque conversion failed');
assert(colour.toHex(0xff123456) === '#123456', 'Hex conversion failed');
assert((colour.parseOpaque('18, 52, 86') >>> 0) === 0xff123456, 'RGB parsing failed');
assert((colour.parseOpaque('300, 0, 86') >>> 0) === 0xffff0056, 'RGB channel clamping failed');
assert(colour.normaliseMode(4, [0, 1, 2, 4, 5, 3], 1) === 4, 'Sparse mode 4 was rejected');
assert(colour.normaliseMode(99, [0, 1, 2, 4, 5, 3], 1) === 1, 'Invalid mode fallback failed');
const options = [
    {{id: 10, mode: 0, label: 'Default'}},
    {{id: 12, mode: 2, label: 'Global'}},
    {{id: 11, mode: 1, custom: true}}
];
const menu = {{
    items: [], radio: null,
    AppendMenuItem(flags, id, label) {{ this.items.push([flags, id, label]); }},
    CheckMenuRadioItem(minimum, maximum, selected) {{ this.radio = [minimum, maximum, selected]; }}
}};
colour.appendRadioOptions(menu, options, 1, 0xff123456, 0);
assert(menu.radio.join(',') === '10,12,11', 'Declarative menu selected the wrong id');
assert(menu.items[2][2] === 'Custom colour... (#123456)', 'Custom menu label is wrong');
assert(colour.optionForId(options, 12).mode === 2, 'Menu id did not resolve to mode');
assert(colour.pickJsplitter(0xff112233, 'Test', 'Prompt') === null,
    'Cancelling the JSplitter picker changed the colour');
assert(inputCalls === 0 && pickerCalls[0].length === 2,
    'JSplitter cancel incorrectly opened fallback or used wrong signature');
delete utilsMock.ColourPicker;
assert((colour.pickJsplitter(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff123456,
    'JSplitter text fallback failed when the native picker was unavailable');
utilsMock.ColourPicker = function() {{ pickerCalls.push([...arguments]); return null; }};
inputCalls = 0;
assert(colour.pickJscript(0xff112233, 'Test', 'Prompt') === null,
    'Cancelling the JScript Panel picker changed the colour');
assert(inputCalls === 0 && pickerCalls[pickerCalls.length - 1].length === 2 &&
    pickerCalls[pickerCalls.length - 1][1] === true,
    'JScript Panel cancel incorrectly opened fallback or used wrong signature');
utilsMock.ColourPicker = function() {{ throw new Error('cancel'); }};
inputCalls = 0;
assert(colour.pickJscript(0xff112233, 'Test', 'Prompt') === null && inputCalls === 0,
    'JScript Panel picker exception incorrectly opened the text fallback');
utilsMock.ColourPicker = function() {{ throw new Error('cancel'); }};
assert(colour.pickJsplitter(0xff112233, 'Test', 'Prompt') === null && inputCalls === 0,
    'JSplitter picker exception incorrectly opened the text fallback');
delete utilsMock.ColourPicker;
assert((colour.pickJscript(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff123456,
    'JScript Panel text fallback failed when the native picker was unavailable');
"""
    result = subprocess.run([node, '-e', colour_helper_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Shared colour-helper runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the shared startup/divider protocol independently from the
    # controller bridge tests so malformed messages and readiness re-queries
    # remain covered at the helper boundary.
    protocol_helper_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
const factory = new Function('utils', colourSource + '\\n' + protocolSource +
    '\\nreturn {{ DarkOneColour, DarkOneProtocol }};');
const api = factory({{}});
const startup = api.DarkOneProtocol.startup;
const divider = api.DarkOneProtocol.divider;
function assert(condition, message) {{ if (!condition) throw new Error(message); }}
assert(startup.serialiseState({{transition: 2, minimumDelay: 5000,
    readinessTimeout: 7000}}) === 'v1|state|2|5000|7000',
    'Startup state serialisation changed');
const state = startup.parseState('v1|state|9|-1|99999');
assert(state && state.transition === 2 && state.minimumDelay === 0 &&
    state.readinessTimeout === 10000, 'Startup state clamping failed');
assert(startup.parseState('v2|state|0|250|2000') === null,
    'Startup accepted an unsupported state version');
assert(startup.serialiseCommand('set', 'minimum-delay', 9999) ===
    'v1|set|minimum-delay|5000', 'Startup command clamping failed');
const command = startup.parseCommand('v1|set|readiness-timeout|7000');
assert(command && command.key === 'readiness-timeout' && command.value === 7000,
    'Startup command parsing failed');
assert(startup.parseCommand('v1|set|unknown|1') === null,
    'Startup accepted an unknown command key');
assert(startup.parseCommand('v1|set|minimum-delay|not-a-number') === null,
    'Startup accepted a non-numeric command value');
assert(startup.serialiseCommand('set', 'minimum-delay', Infinity) === null,
    'Startup serialised a non-finite command value');
assert(startup.parseState('v1|state|0|Infinity|2000') === null,
    'Startup accepted a non-finite state value');
const dividerMessage = divider.serialiseState(4, 0xff123456);
assert(dividerMessage === 'v1|4|4279383126',
    'Divider state serialisation changed');
const dividerState = divider.parseState(dividerMessage);
assert(dividerState && dividerState.mode === 4 &&
    (dividerState.customColour >>> 0) === 0xff123456,
    'Divider state round-trip failed');
assert(divider.parseState('v1|99|4278190080').mode === 1,
    'Divider invalid-mode fallback changed');
assert(divider.parseState('v1|4|Infinity') === null,
    'Divider accepted a non-finite colour value');
const options = divider.menuOptions(900);
assert(options.map(item => item.id + ':' + item.mode).join(',') ===
    '900:0,901:1,902:2,903:4,905:5,904:3',
    'Divider menu mapping changed');
const events = [];
const readiness = startup.createReadinessBridge(
    {{NotifyOthers(name, data) {{ events.push([name, data]); }}}},
    'InfoStack'
);
assert(readiness.handle(startup.notifications.queryReady) === false &&
    events.length === 0, 'Unready controller answered a readiness query');
readiness.signal();
assert(readiness.isReady() && events.length === 1,
    'Readiness signal was not recorded');
assert(readiness.handle(startup.notifications.queryReady) === true &&
    events.length === 2 && events[1][1] === 'InfoStack',
    'Ready controller did not repeat its readiness signal');
"""
    result = subprocess.run([node, '-e', protocol_helper_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Shared JSplitter-protocol runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the shared left/right optional-button menu independently from
    # the panel layouts. IDs and saved properties must remain compatible.
    optional_button_menu_smoke = f"""
const fs = require('fs');
const source = fs.readFileSync({json.dumps(str(project / 'jscript' / 'js' / 'Buttons_OptionalMenu.js'))}, 'utf8');
const properties = new Map();
let reloads = 0;
let repaints = 0;
let shownProperties = 0;
let resetNames = null;
let guideCalls = 0;
let toolsCalls = [];
let roundness = 33;
let roundnessSet = null;
let customRoundness = false;
let refreshCalls = [];
let inputValues = [];
let popupMenus = [];
let trackedIndex = 0;
function createPopupMenu() {{
    const value = {{
        items: [], checked: [], separators: 0, children: [], disposed: false,
        AppendMenuItem(flags, id, label) {{ this.items.push([flags, id, label]); }},
        AppendMenuSeparator() {{ this.separators++; }},
        CheckMenuItem(id, checked) {{ if (checked) this.checked.push(id); }},
        CheckMenuRadioItem(minimum, maximum, selected) {{ this.radio = [minimum, maximum, selected]; }},
        AppendTo(parent, flags, label) {{ parent.children.push([flags, label, this]); }},
        TrackPopupMenu() {{ return trackedIndex; }},
        Dispose() {{ this.disposed = true; }}
    }};
    popupMenus.push(value);
    return value;
}}
const windowMock = {{
    GetProperty(name, fallback) {{ return properties.has(name) ? properties.get(name) : fallback; }},
    SetProperty(name, value) {{ properties.set(name, value); }},
    Reload() {{ reloads++; }},
    Repaint() {{ repaints++; }},
    ShowProperties() {{ shownProperties++; }},
    CreatePopupMenu: createPopupMenu
}};
const utilsMock = {{
    InputBox() {{
        if (!inputValues.length) throw new Error('cancel');
        const value = inputValues.shift();
        if (value instanceof Error) throw value;
        return value;
    }},
    MessageBox() {{ return 1; }}
}};
const factory = new Function(
    'window', 'utils', 'MB_OK', 'MB_ICONASTERISK',
    'resetOptionalButtonCommandStyles', 'showOptionalButtonCommandGuide',
    'darkOneToolsMenu', 'darkOneButtonRoundness', 'darkOneSetButtonRoundness',
    'darkOneInputButtonRoundness', 'buttonsOptions', 'buttonsSizes',
    'buttonsRefresh', source + '\\nreturn {{ DARKONE_CONTROL_BUTTON_MENU,' +
    'darkOneOptionalButtonEditId, darkOneAppendOptionalButtonMenu,' +
    'darkOneAppendButtonRoundnessMenu, darkOneConfigureOptionalButton,' +
    'darkOneHandleControlButtonMenuSelection, darkOneShowControlButtonMenu }};'
);
const api = factory(
    windowMock, utilsMock, 0, 64,
    names => {{ resetNames = names.slice(); }},
    () => {{ guideCalls++; }},
    (x, y) => {{ toolsCalls.push([x, y]); }},
    () => roundness,
    value => {{ roundnessSet = value; roundness = value; return true; }},
    () => customRoundness,
    () => refreshCalls.push('options'),
    () => refreshCalls.push('sizes'),
    () => refreshCalls.push('refresh')
);
function assert(condition, message) {{ if (!condition) throw new Error(message); }}
function menu() {{
    return {{
        items: [], checked: [], separators: 0,
        AppendMenuItem(flags, id, label) {{ this.items.push([flags, id, label]); }},
        AppendMenuSeparator() {{ this.separators++; }},
        CheckMenuItem(id, checked) {{ if (checked) this.checked.push(id); }}
    }};
}}
const leftNames = Array.from({{length: 8}}, (_, i) => 'Button ' + String(i + 1).padStart(2, '0'));
const rightNames = Array.from({{length: 10}}, (_, i) => 'Button ' + String(i + 1).padStart(2, '0'));
const leftButtons = leftNames.map((name, i) => ({{Exists: i === 1, Text: i === 0 ? 'FIRST' : ''}}));
let optionalMenu = menu();
api.darkOneAppendOptionalButtonMenu(optionalMenu, leftNames, leftButtons);
assert(api.darkOneOptionalButtonEditId(leftNames) === 109, 'Control Left edit id changed');
assert(api.darkOneOptionalButtonEditId(rightNames) === 111, 'Control Right edit id changed');
assert(optionalMenu.items[0][1] === 101 && optionalMenu.items[0][2] === 'FIRST',
    'Optional-button first item changed');
assert(optionalMenu.items[1][0] === 8 && optionalMenu.items[8][1] === 109,
    'Optional-button checked/edit mapping changed');
assert(optionalMenu.items[9][1] === 120 && optionalMenu.items[10][1] === 121,
    'Optional-button utility ids changed');
let roundMenu = menu();
api.darkOneAppendButtonRoundnessMenu(roundMenu);
assert(roundMenu.items.map(item => item[1]).join(',') === '401,402,403,404,405,406,407',
    'Roundness menu ids changed');
assert(roundMenu.checked.join(',') === '404', 'Current roundness check changed');

inputValues = ['View/Console', 'ABCDEFGHIJKL'];
api.darkOneConfigureOptionalButton(0, leftNames, leftButtons);
assert(properties.get('Button 01') === true, 'Optional button was not enabled');
assert(properties.get('Button 01 command string') === 'View/Console',
    'Optional command was not stored');
assert(properties.get('Button 01 name (up to 10 letters)') === 'ABCDEFGHIJ',
    'Optional label truncation changed');
assert(properties.get('Button 01 command style') === 0 && reloads === 1,
    'Optional command style/reload behaviour changed');

leftButtons[0].Exists = true;
properties.set('Button 01 command string', 'View/Console');
api.darkOneConfigureOptionalButton(0, leftNames, leftButtons);
assert(properties.get('Button 01') === false && reloads === 2,
    'Disabling an existing optional button changed');

leftButtons[2].Exists = false;
inputValues = [new Error('cancel')];
api.darkOneConfigureOptionalButton(2, leftNames, leftButtons);
assert(properties.get('Button 03') === false && reloads === 2,
    'Cancelled optional-button setup did not roll back');

const options = {{buttonNames: leftNames, buttonProperties: leftButtons, x: 12, y: 34}};
assert(api.darkOneHandleControlButtonMenuSelection(120, options),
    'Re-detect command menu id was not handled');
assert(resetNames.length === 8, 'Re-detect did not receive every left button');
assert(api.darkOneHandleControlButtonMenuSelection(121, options) && guideCalls === 1,
    'Command guide menu id changed');
assert(api.darkOneHandleControlButtonMenuSelection(900, options) &&
    toolsCalls[0].join(',') === '12,34', 'DarkOne Tools menu id changed');
refreshCalls = [];
assert(api.darkOneHandleControlButtonMenuSelection(405, options) && roundnessSet === 60,
    'Roundness preset mapping changed');
assert(refreshCalls.join(',') === 'options,sizes,refresh' && repaints === 1,
    'Roundness refresh sequence changed');
refreshCalls = [];
customRoundness = false;
assert(api.darkOneHandleControlButtonMenuSelection(407, options) && refreshCalls.length === 0,
    'Cancelled custom roundness refreshed the panel');
assert(api.darkOneHandleControlButtonMenuSelection(999, options) === false,
    'Unknown control-menu id was consumed');

popupMenus = [];
trackedIndex = 0;
api.darkOneShowControlButtonMenu(5, 6, {{
    buttonNames: rightNames,
    buttonProperties: rightNames.map(() => ({{Exists: false, Text: ''}}))
}});
assert(popupMenus.length === 3 && popupMenus.every(item => item.disposed),
    'Shared right control menu did not dispose every popup');
assert(popupMenus[0].children.map(item => item[1]).join(',') ===
    'Optional buttons,Button roundness', 'Shared right control menu order changed');
assert(popupMenus[0].items.some(item => item[1] === 900),
    'Shared right control menu lost DarkOne Tools');

popupMenus = [];
trackedIndex = 999;
let extraHandled = 0;
api.darkOneShowControlButtonMenu(7, 8, {{
    buttonNames: leftNames,
    buttonProperties: leftButtons,
    appendExtraMenus(root) {{
        const extra = createPopupMenu();
        extra.AppendTo(root, 16, 'Button style');
        return [extra];
    }},
    handleExtraSelection(index) {{ if (index === 999) extraHandled++; }}
}});
assert(extraHandled === 1 && popupMenus.length === 4 &&
    popupMenus.every(item => item.disposed),
    'Shared left control menu did not delegate or dispose extra menus');
assert(popupMenus[0].children.map(item => item[1]).join(',') ===
    'Optional buttons,Button style,Button roundness',
    'Shared left control menu extension order changed');
"""
    result = subprocess.run([node, '-e', optional_button_menu_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Shared optional-button-menu runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the InfoStack tab-colour modes. Existing Custom mode 1 must
    # remain intact while mode 2 follows Columns UI selected-item background.
    tab_colour_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
const infoColourSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_colours.js'))}, 'utf8');
const infoBridgeSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_bridges.js'))}, 'utf8');
const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '03_info_stack_tabs.js'))}, 'utf8');
const properties = new Map();
const windowMock = {{
    GetProperty(name, fallback) {{ return properties.has(name) ? properties.get(name) : fallback; }},
    SetProperty(name, value) {{ properties.set(name, value); }},
    GetColourCUI(index) {{ return index === 4 ? 0xff556677 : 0xff112233; }},
    GetPanel() {{ return null; }}, NotifyOthers() {{}}, Repaint() {{}}, RepaintRect() {{}}, SetCursor() {{}}
}};
const DOJSP3Mock = {{
    titles: {{ playlistManager:'a', lastfmBio:'b', lastfmInfo:'c', albumNotes:'d', queue:'e', properties:'f' }},
    colours: {{ bar:0xff202020, separator:0xff181818, buttonNormal:0xff298fcc, buttonActive:0xffffffff, buttonHover:0xff888888 }},
    clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }}
}};
const factory = new Function('window','fb','include','gdi','DOJSP3','utils','darkOneJsp3HandleReset',
    colourSource + '\\n' + protocolSource + '\\n' + infoColourSource + '\\n' + infoBridgeSource + '\\n' + source + '\\nreturn {{ tabColourMode, tabAccentColour, setTabColourMode }};');
const controller = factory(windowMock, {{ProfilePath:''}}, function(){{}}, {{Font(){{return {{}};}}}}, DOJSP3Mock, {{}}, function(){{return false;}});
if (controller.tabColourMode() !== 0 || (controller.tabAccentColour() >>> 0) !== 0xff298fcc)
    throw new Error('Default tab font accent changed');
properties.set('DarkOneJSP3.InfoStack.TabCustomColour', 0xff123456);
controller.setTabColourMode(1);
if (controller.tabColourMode() !== 1 || (controller.tabAccentColour() >>> 0) !== 0xff123456)
    throw new Error('Legacy custom tab font mode no longer works');
controller.setTabColourMode(2);
if (controller.tabColourMode() !== 2 || (controller.tabAccentColour() >>> 0) !== 0xff556677)
    throw new Error('Tab font does not follow Columns UI selected-item background');
"""
    result = subprocess.run([node, '-e', tab_colour_smoke], capture_output=True, text=True)
    if result.returncode:
        errors.append('InfoStack tab-colour runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise display-accent mode compatibility and selected-item resolution.
    display_accent_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
let source = fs.readFileSync({json.dumps(str(project / 'jscript' / 'js' / 'Object_DisplaySystem.js'))}, 'utf8');
const start = source.indexOf('function DisplaySystem()');
if (start < 0) throw new Error('DisplaySystem constructor not found');
source = source.slice(0,  source.indexOf('// ----- BASE IMAGE OBJECT -----')) + '\\n' + source.slice(start);
const properties = new Map();
const windowMock = {{
    GetProperty(name, fallback) {{ return properties.has(name) ? properties.get(name) : fallback; }},
    SetProperty(name, value) {{ properties.set(name, value); }},
    GetColourCUI(index) {{ return index === 4 ? 0xff556677 : 0xff112233; }}
}};
const noopImage = {{ Dispose(){{}}, GetGraphics(){{return {{}};}}, ReleaseGraphics(){{}}, Width:1, Height:1 }};
const factory = new Function('window','fb','safeGdiImage','utils','disposeImage','combColours','p_backcol','ui_btntxtcol',
    'tf_display_lossless','tf_display_lossy','tf_display_hires','tf_display_multich','tf_display_md5','tf_display_replaygain',
    'tf_display_tracknumber_exists','tf_display_totaltracks_exists','tf_display_tracknumber','tf_display_totaltracks','tf_display_bitrate',
    'imgPath','DWRITE_FONT_WEIGHT_BLACK','DWRITE_FONT_WEIGHT_NORMAL',
    'darkOneCreateFont','evalTitleFormat','TimeFmt','pad','pad_right','clearPanelTimer','section',
    colourSource + '\\n' + source + '\\nreturn {{ DisplaySystem, DARKONE_DISPLAY_ACCENT_DEFAULT, DARKONE_DISPLAY_ACCENT_CUSTOM, DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED }};');
const api = factory(windowMock, {{IsPlaying:false, PlaybackLength:0, PlaybackTime:0}}, function(){{return null;}},
    {{CreateImage(){{return noopImage;}}}}, function(){{}}, function(){{return 0xff000000;}}, 0xff000000, 0xffffffff,
    '', '', '', '', '', '', '', '', '', '', '', '', 900, 400, function(){{return {{}};}}, function(){{return ''; }}, function(){{return ''; }},
    function(){{return ''; }}, function(){{return ''; }}, function(v){{return v;}}, function(v){{return v;}}, function(){{return null;}},
    {{sac:0,pbo:1,pbt:2,vol:3,bit:4}});
const display = new api.DisplaySystem();
if (display.accent_mode !== 0 || (display.active_colour >>> 0) !== 0xff298fcc)
    throw new Error('Default display accent changed');
display.setAccent(1, 0xff123456);
if (display.accent_mode !== 1 || (display.active_colour >>> 0) !== 0xff123456)
    throw new Error('Legacy custom display accent no longer works');
display.setAccent(2);
if (display.accent_mode !== 2 || (display.active_colour >>> 0) !== 0xff556677)
    throw new Error('Display accent does not follow Columns UI selected-item background');
"""
    result = subprocess.run([node, '-e', display_accent_smoke], capture_output=True, text=True)
    if result.returncode:
        errors.append('Display accent runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the opt-in information-page background modes, including the
    # explicit restoration of the historical Columns UI global background.
    page_background_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const source = fs.readFileSync({json.dumps(str(samples / 'js' / 'panel.js'))}, 'utf8');
function property(name, fallback) {{ this.name = name; this.value = fallback; }}
const windowMock = {{
    IsDefaultUI: false,
    Width: 640,
    Height: 480,
    GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
    GetColourDUI() {{ return 0xff000000; }},
    GetFontCUI() {{ return JSON.stringify({{Name: 'Segoe UI'}}); }},
    GetFontDUI() {{ return JSON.stringify({{Name: 'Segoe UI'}}); }},
    Repaint() {{}},
    CreatePopupMenu() {{ throw new Error('Menu should not be opened by colour smoke test'); }}
}};
const underscore = {{ invoke() {{}}, forEach() {{}}, first(a) {{ return a[0]; }}, last(a) {{ return a[a.length - 1]; }} }};
const factory = new Function(
    'window', 'fb', '_p', '_scale', '_', 'RGB', 'blendColours',
    colourSource + '\\n' + source + '\\nreturn _panel;'
);
const Panel = factory(
    windowMock,
    {{ GetFocusItem() {{ return null; }} }},
    property,
    value => value,
    underscore,
    (r, g, b) => 0xff000000 + (r << 16) + (g << 8) + b,
    () => 0xff888888
);
const panel = new Panel({{ darkonejsp3_page_background: true }});
if ((panel.page_background_colour() >>> 0) !== 0xff181818)
    throw new Error('Default information-page background is not DarkOne dark grey');
panel.page_background.custom.value = 0xff123456;
panel.page_background.mode.value = 4;
if ((panel.page_background_colour() >>> 0) !== 0xff123456)
    throw new Error('Information-page custom mode no longer works');
panel.page_background.mode.value = 5;
if ((panel.page_background_colour() >>> 0) !== 0xff445566)
    throw new Error('Information page does not follow the Columns UI global background');
"""
    result = subprocess.run([node, '-e', page_background_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Page-background runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the InfoStack backing-colour mode range. Mode 4 was added after
    # the legacy custom mode 3 and must not be clamped back to mode 3.
    info_stack_background_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
const infoColourSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_colours.js'))}, 'utf8');
const infoBridgeSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_bridges.js'))}, 'utf8');
const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '03_info_stack_tabs.js'))}, 'utf8');
const properties = new Map();
const windowMock = {{
    GetProperty(name, fallback) {{
        return properties.has(name) ? properties.get(name) : fallback;
    }},
    SetProperty(name, value) {{ properties.set(name, value); }},
    GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
    GetPanel() {{ return null; }},
    NotifyOthers() {{}},
    Repaint() {{}},
    RepaintRect() {{}},
    SetCursor() {{}}
}};
const DOJSP3Mock = {{
    titles: {{
        playlistManager: 'a', lastfmBio: 'b', lastfmInfo: 'c',
        albumNotes: 'd', queue: 'e', properties: 'f'
    }},
    colours: {{
        bar: 0xff202020, separator: 0xff181818,
        buttonActive: 0xffffffff, buttonHover: 0xff888888
    }},
    clamp(value, minimum, maximum) {{
        return Math.max(minimum, Math.min(maximum, value));
    }}
}};
const factory = new Function(
    'window', 'fb', 'include', 'gdi', 'DOJSP3', 'utils',
    'darkOneJsp3HandleReset',
    colourSource + '\\n' + protocolSource + '\\n' + infoColourSource + '\\n' + infoBridgeSource + '\\n' + source + '\\nreturn {{ backgroundMode, backgroundColour }};'
);
const controller = factory(
    windowMock,
    {{ ProfilePath: '' }},
    function() {{}},
    {{ Font() {{ return {{}}; }} }},
    DOJSP3Mock,
    {{}},
    function() {{ return false; }}
);
if (controller.backgroundMode() !== 4 ||
        (controller.backgroundColour() >>> 0) !== 0xff181818)
    throw new Error('Default InfoStack backing is not DarkOne dark grey');
properties.set('DarkOneJSP3.InfoStack.BackgroundColour', 0xff202020);
properties.set('DarkOneJSP3.InfoStack.BackgroundMode', 4);
if (controller.backgroundMode() !== 4 ||
        (controller.backgroundColour() >>> 0) !== 0xff181818)
    throw new Error('DarkOne dark grey was clamped to the stored custom colour');
properties.set('DarkOneJSP3.InfoStack.BackgroundMode', 3);
if (controller.backgroundMode() !== 3 ||
        (controller.backgroundColour() >>> 0) !== 0xff202020)
    throw new Error('Legacy custom InfoStack backing mode no longer works');
properties.set('DarkOneJSP3.InfoStack.BackgroundMode', 5);
if (controller.backgroundMode() !== 5 ||
        (controller.backgroundColour() >>> 0) !== 0xff445566)
    throw new Error('InfoStack backing does not follow the Columns UI global background');
"""
    result = subprocess.run([node, '-e', info_stack_background_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('InfoStack backing-colour runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the waveform-host background range and colour resolution.
    waveform_background_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '06_display_waveform.js'))}, 'utf8');
const properties = new Map();
let repaintCount = 0;
const windowMock = {{
    GetProperty(name, fallback) {{
        return properties.has(name) ? properties.get(name) : fallback;
    }},
    SetProperty(name, value) {{ properties.set(name, value); }},
    GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
    Repaint() {{ repaintCount++; }}
}};
const DOJSP3Mock = {{
    colours: {{ bar: 0xff202020, separator: 0xff181818 }},
    clamp(value, minimum, maximum) {{
        return Math.max(minimum, Math.min(maximum, value));
    }}
}};
const factory = new Function(
    'window', 'fb', 'include', 'DOJSP3', 'darkOneJsp3HandleReset', 'utils',
    colourSource + '\\n' + protocolSource + '\\n' + source + '\\nreturn {{ backgroundMode, backgroundColour, on_colours_changed }};'
);
const controller = factory(
    windowMock,
    {{ ProfilePath: '', IsPlaying: false }},
    function() {{}},
    DOJSP3Mock,
    function() {{ return false; }},
    {{}}
);
if (controller.backgroundMode() !== 2 ||
        (controller.backgroundColour() >>> 0) !== 0xff202020)
    throw new Error('Default waveform host is not DarkOne grey');
properties.set('DarkOneJSP3.DisplayWaveform.BackgroundColour', 0xff123456);
properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 4);
if (controller.backgroundMode() !== 4 ||
        (controller.backgroundColour() >>> 0) !== 0xff181818)
    throw new Error('Waveform DarkOne dark grey resolves to the custom colour');
properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 3);
if (controller.backgroundMode() !== 3 ||
        (controller.backgroundColour() >>> 0) !== 0xff123456)
    throw new Error('Waveform custom background mode no longer works');
properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 5);
if (controller.backgroundMode() !== 5 ||
        (controller.backgroundColour() >>> 0) !== 0xff445566)
    throw new Error('Waveform host does not follow the Columns UI background');
controller.on_colours_changed();
if (repaintCount !== 1)
    throw new Error('Waveform host does not repaint after a Columns UI colour change');
"""
    result = subprocess.run([node, '-e', waveform_background_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Waveform background runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise upper-divider mode persistence, painting and notifications.
    divider_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '02_main_columns.js'))}, 'utf8');
const properties = new Map();
const notifications = [];
const fills = [];
const windowMock = {{
    GetProperty(name, fallback) {{
        return properties.has(name) ? properties.get(name) : fallback;
    }},
    SetProperty(name, value) {{ properties.set(name, value); }},
    GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
    NotifyOthers(name, data) {{ notifications.push([name, data]); }},
    Repaint() {{}},
    CreatePopupMenu() {{ throw new Error('Menu should not be opened by paint smoke test'); }}
}};
const DOJSP3Mock = {{
    colours: {{ bar: 0xff202020, separator: 0xff181818 }},
    clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }},
    idiv(value, divisor) {{ return Math.floor(value / divisor); }}
}};
const factory = new Function(
    'window', 'fb', 'include', 'utils', 'DOJSP3', 'darkOneJsp3HandleReset',
    colourSource + '\\n' + protocolSource + '\\n' + source + '\\nreturn {{ on_paint, on_notify_data, dividerMode, dividerColour, dividerState, parseDividerState: DarkOneProtocol.divider.parseState, isDividerPoint, setSize: function(w, h) {{ ww = w; wh = h; }} }};'
);
const controller = factory(
    windowMock,
    {{ ProfilePath: '' }},
    function() {{}},
    {{}},
    DOJSP3Mock,
    function() {{ return false; }}
);
const gr = {{ FillSolidRect(x, y, w, h, colour) {{ fills.push([x, y, w, h, colour >>> 0]); }} }};
controller.setSize(1920, 900);
controller.on_paint(gr);
if (fills.length !== 3 || fills[1][4] !== 0xff000000 || fills[2][4] !== 0xff000000)
    throw new Error('Default upper dividers are not both black');
fills.length = 0;
controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|0|4278190080');
controller.on_paint(gr);
if (fills.length !== 0)
    throw new Error('Transparent divider mode still paints the host/dividers');
fills.length = 0;
controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|2|4278190080');
controller.on_paint(gr);
if (fills.length !== 3 || fills[1][4] !== 0xff202020 || fills[2][4] !== 0xff202020)
    throw new Error('DarkOne-grey divider mode did not paint both strips');
fills.length = 0;
controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|4|4279383126');
controller.on_paint(gr);
if (fills.length !== 3 || fills[1][4] !== 0xff181818 || fills[2][4] !== 0xff181818)
    throw new Error('DarkOne-dark-grey divider mode did not paint both strips');
fills.length = 0;
controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|3|4279383126');
controller.on_paint(gr);
if (fills.length !== 3 || fills[1][4] !== 0xff123456 || fills[2][4] !== 0xff123456)
    throw new Error('Custom divider colour did not paint both strips');
fills.length = 0;
controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|5|4279383126');
controller.on_paint(gr);
if (fills.length !== 3 || fills[1][4] !== 0xff445566 || fills[2][4] !== 0xff445566)
    throw new Error('Columns UI global background did not paint both divider strips');
controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Query', null);
const stateEvents = notifications.filter(item => item[0] === 'DarkOneJSP3.ArtSpectrum.Divider.State');
if (!stateEvents.length || typeof stateEvents[stateEvents.length - 1][1] !== 'string')
    throw new Error('Divider state query did not return a serialised state');
const returnedState = controller.parseDividerState(stateEvents[stateEvents.length - 1][1]);
if (!returnedState || returnedState.mode !== 5 ||
        (returnedState.customColour >>> 0) !== 0xff123456)
    throw new Error('Divider state query did not return the stored state');
if (!controller.isDividerPoint(635) || controller.isDividerPoint(630))
    throw new Error('Divider context hit target was not expanded to ten pixels');
"""
    result = subprocess.run([node, '-e', divider_smoke], capture_output=True, text=True)
    if result.returncode:
        errors.append('Upper divider runtime smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the real JSplitter startup-control bridge and timing state.
    startup_bridge_smoke = f"""
const fs = require('fs');
const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
const rootSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '01_root.js'))}, 'utf8');
const infoColourSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_colours.js'))}, 'utf8');
const infoBridgeSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_bridges.js'))}, 'utf8');
const infoSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '03_info_stack_tabs.js'))}, 'utf8');
const rootProperties = new Map();
const infoProperties = new Map();
const timers = new Map();
let nextTimer = 1;
let rootNotify = null;
let infoNotify = null;
const main = {{ visible: true, Show(value) {{ this.visible = Boolean(value); }}, Move() {{}} }};
const controls = {{ visible: true, Show(value) {{ this.visible = Boolean(value); }}, Move() {{}} }};
const infoChildren = Array.from({{length: 6}}, () => ({{Show() {{}}, Move() {{}}}}));
function fakeSetTimeout(fn, delay) {{
    const id = nextTimer++;
    timers.set(id, {{fn, delay}});
    return id;
}}
function fakeClearTimeout(id) {{ timers.delete(id); }}
function runTimerWithDelay(delay) {{
    const match = [...timers.entries()].find(item => item[1].delay === delay);
    if (!match) throw new Error('Missing timer with delay ' + delay);
    timers.delete(match[0]);
    match[1].fn();
}}
const DOJSP3 = {{
    colours: {{bar: 0xff202020, buttonNormal: 0xff298fcc,
        buttonHover: 0xff9b9b9b, buttonActive: 0xffffffff}},
    titles: {{main: 'main', controls: 'controls', infoStack: 'info',
        artSpectrum: 'art', playlist: 'playlist', playlistManager: 'p0',
        lastfmBio: 'p1', lastfmInfo: 'p2', albumNotes: 'p3',
        queue: 'p4', properties: 'p5'}},
    clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }},
    idiv(value, divisor) {{ return Math.floor(value / divisor); }},
    mulDiv(value, multiplier, divisor) {{ return Math.round(value * multiplier / divisor); }},
    panel(title) {{ return title === 'main' ? main : controls; }},
    move(panel) {{ if (panel && panel.Move) panel.Move(); }},
    show(panel, visible) {{ if (panel) panel.Show(visible); }}
}};
const rootWindow = {{
    GetProperty(name, fallback) {{ return rootProperties.has(name) ? rootProperties.get(name) : fallback; }},
    SetProperty(name, value) {{ rootProperties.set(name, value); }},
    GetPanel(title) {{ return title === 'main' ? main : controls; }},
    NotifyOthers(name, data) {{ if (infoNotify) infoNotify(name, data); }},
    Repaint() {{}}, Reload() {{}}
}};
const infoWindow = {{
    Name: 'DOJSP3.InfoStack',
    GetProperty(name, fallback) {{ return infoProperties.has(name) ? infoProperties.get(name) : fallback; }},
    SetProperty(name, value) {{ infoProperties.set(name, value); }},
    GetPanel(title) {{
        const index = ['p0','p1','p2','p3','p4','p5'].indexOf(title);
        return index >= 0 ? infoChildren[index] : null;
    }},
    NotifyOthers(name, data) {{ if (rootNotify) rootNotify(name, data); }},
    Repaint() {{}}, RepaintRect() {{}}, SetCursor() {{}}, Reload() {{}}
}};
const rootFactory = new Function(
    'window','fb','include','utils','DOJSP3','darkOneJsp3HandleReset',
    'setTimeout','clearTimeout','console',
    colourSource + '\\n' + protocolSource + '\\n' + rootSource + '\\nreturn {{on_size,on_notify_data,startupTransition,startupMinimumDelay,startupSafetyTimeout}};'
);
const infoFactory = new Function(
    'window','fb','include','utils','DOJSP3','darkOneJsp3HandleReset','gdi',
    colourSource + '\\n' + protocolSource + '\\n' + infoColourSource + '\\n' + infoBridgeSource + '\\n' + infoSource + '\\nreturn {{on_notify_data,requestStartupControlState,sendStartupControlCommand,parseDividerState:DarkOneProtocol.divider.parseState,getState:function(){{return [startupMenuTransition,startupMenuMinimumDelay,startupMenuReadinessTimeout,startupMenuStateKnown];}}}};'
);
const root = rootFactory(rootWindow, {{ProfilePath:''}}, function(){{}}, {{}}, DOJSP3,
    function(){{return false;}}, fakeSetTimeout, fakeClearTimeout, console);
const info = infoFactory(infoWindow, {{ProfilePath:'',ShowPopupMessage(){{}}}}, function(){{}},
    {{InputBox(){{return '0';}}}}, DOJSP3, function(){{return false;}},
    {{Font(){{return {{Height:12}};}}}});
rootNotify = root.on_notify_data;
infoNotify = info.on_notify_data;
function assert(condition, message) {{ if (!condition) throw new Error(message); }}
info.requestStartupControlState();
assert(info.getState().join(',') === '0,250,2000,true', 'Initial root state did not reach InfoStack');
const darkDividerState = info.parseDividerState('v1|4|4279383126');
assert(darkDividerState && darkDividerState.mode === 4,
    'InfoStack clamped DarkOne-dark-grey divider mode 4');
info.sendStartupControlCommand('set', 'transition', 1);
info.sendStartupControlCommand('set', 'minimum-delay', 5000);
info.sendStartupControlCommand('set', 'readiness-timeout', 7000);
assert(root.startupTransition() === 1, 'Transition command did not update the root');
assert(root.startupMinimumDelay() === 5000, 'Minimum hold did not update the root');
assert(root.startupSafetyTimeout() === 7000, 'Readiness timeout did not update the root');
assert(info.getState().slice(0,3).join(',') === '1,5000,7000', 'Root state did not synchronise back to InfoStack');
root.on_size(1920, 1080);
assert(main.visible === false && controls.visible === false, 'Black reveal did not hide root children');
info.sendStartupControlCommand('preview');
runTimerWithDelay(5000);
runTimerWithDelay(150);
assert(main.visible === true && controls.visible === true, 'Preview did not honour root timing/reveal');
info.sendStartupControlCommand('restore');
assert(root.startupTransition() === 0 && root.startupMinimumDelay() === 250 &&
    root.startupSafetyTimeout() === 2000, 'Startup defaults were not restored in the root');
assert(info.getState().slice(0,3).join(',') === '0,250,2000', 'Restored root state did not synchronise to InfoStack');
"""
    result = subprocess.run([node, '-e', startup_bridge_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('Startup control bridge smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Execute the Panel Settings back-arrow factory at multiple UI scales.
    arrow_smoke = f"""
const fs = require('fs');
const source = fs.readFileSync({json.dumps(str(samples / 'jsplaylist' / 'settings.js'))}, 'utf8');
const start = source.indexOf('function createSettingsBackArrow(colour, size) {{');
if (start < 0) throw new Error('Back-arrow helper was not found');
const open = source.indexOf('{{', start);
let depth = 0;
let end = -1;
for (let i = open; i < source.length; i++) {{
    if (source[i] === '{{') depth++;
    else if (source[i] === '}}') {{
        depth--;
        if (depth === 0) {{ end = i + 1; break; }}
    }}
}}
if (end < 0) throw new Error('Back-arrow helper was not closed');
const declaration = source.slice(start, end);
function setAlpha(colour, alpha) {{
    return ((colour & 0x00ffffff) | (alpha << 24));
}}
function render(size, baseAlpha) {{
    const pixels = new Map();
    const image = {{
        width: size,
        height: size,
        GetGraphics() {{
            return {{
                FillRectangle(x, y, w, h, colour) {{
                    if (w !== 1 || h !== 1)
                        throw new Error('Arrow rasteriser must write one pixel at a time');
                    if (![x, y, w, h, colour].every(Number.isFinite))
                        throw new Error('Arrow geometry contains a non-finite value');
                    if (x < 0 || y < 0 || x >= size || y >= size)
                        throw new Error('Arrow wrote outside its image');
                    const key = `${{x}},${{y}}`;
                    if (pixels.has(key))
                        throw new Error('Arrow wrote a destination pixel more than once');
                    pixels.set(key, colour >>> 0);
                }}
            }};
        }},
        ReleaseGraphics() {{ this.released = true; }}
    }};
    const utils = {{ CreateImage(w, h) {{
        if (w !== size || h !== size)
            throw new Error('Arrow was not created at final size');
        return image;
    }} }};
    const create = new Function('utils', 'setAlpha',
        declaration + '; return createSettingsBackArrow;')(utils, setAlpha);
    const sourceColour = (((baseAlpha & 0xff) << 24) | 0x00e6e6e6) >>> 0;
    const result = create(sourceColour, size);
    if (result !== image || !image.released)
        throw new Error('Arrow image lifecycle failed');
    if (pixels.size < Math.round(size * size * 0.12))
        throw new Error('Arrow silhouette is unexpectedly sparse');

    const coords = [...pixels.keys()].map(key => key.split(',').map(Number));
    const xs = coords.map(point => point[0]);
    const ys = coords.map(point => point[1]);
    if (Math.min(...xs) > Math.floor(size * 0.12) ||
            Math.max(...xs) < Math.floor(size * 0.84) ||
            Math.min(...ys) > Math.floor(size * 0.20) ||
            Math.max(...ys) < Math.floor(size * 0.78))
        throw new Error('Arrow silhouette proportions are outside the expected bounds');

    let maxAlpha = 0;
    for (const value of pixels.values()) {{
        const alpha = (value >>> 24) & 0xff;
        if (alpha > baseAlpha)
            throw new Error('Arrow coverage increased source opacity');
        maxAlpha = Math.max(maxAlpha, alpha);
    }}
    if (maxAlpha !== baseAlpha)
        throw new Error('Arrow has no fully covered interior pixels');

    const centreY = Math.floor(size / 2);
    const centreRow = coords.filter(point => point[1] === centreY)
        .map(point => point[0]).sort((a, b) => a - b);
    if (centreRow.length < Math.floor(size * 0.65))
        throw new Error('Arrow shaft is too short');
    for (let i = 1; i < centreRow.length; i++) {{
        if (centreRow[i] !== centreRow[i - 1] + 1)
            throw new Error('Arrow centre row is not a single silhouette');
    }}
    return pixels;
}}
for (const size of [25, 38, 50]) {{
    const normal = render(size, 255);
    const hover = render(size, 200);
    if (normal.size !== hover.size)
        throw new Error('Normal and hover arrow geometry differs');
    for (const key of normal.keys()) {{
        if (!hover.has(key))
            throw new Error('Normal and hover arrow coverage differs');
    }}
}}
"""
    result = subprocess.run([node, '-e', arrow_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('JS Playlist back-arrow smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Execute automatic tab-area geometry directly from the controller source.
    geometry_smoke = f"""
const fs = require('fs');
const source = fs.readFileSync({json.dumps(str(info_stack))}, 'utf8');
const functionStart = source.indexOf('function automaticTabAreaHeight() {{');
if (functionStart < 0)
    throw new Error('automaticTabAreaHeight source was not found');
const bodyStart = source.indexOf('{{', functionStart);
const bodyEnd = source.indexOf('\\n}}', bodyStart);
if (bodyStart < 0 || bodyEnd < 0)
    throw new Error('automaticTabAreaHeight body was not found');
const body = source.slice(bodyStart + 1, bodyEnd);
const calculate = new Function(
    'ww', 'tabHeight', 'DOJSP3', 'window', 'FONT_PROPERTY',
    'automaticFontScale', body);
const DOJSP3 = {{ idiv(a, b) {{ return Math.trunc(a / b); }} }};
function area(scale, fixedFontSize) {{
    const window = {{ GetProperty() {{ return fixedFontSize; }} }};
    return calculate(
        1200, 20, DOJSP3, window, 'DarkOneJSP3.InfoStack.FontSize',
        function() {{ return scale; }});
}}
function assert(condition, message) {{
    if (!condition) throw new Error(message);
}}
const at50 = area(50, 0);
const at100 = area(100, 0);
const at200 = area(200, 0);
assert(at50 < at100 && at100 < at200,
    'Automatic tab area does not follow font base scale');
assert(at100 === 20 + Math.trunc(1200 / 40),
    'The established 100% tab-area geometry changed');
assert(area(50, 18) === area(200, 18),
    'Fixed font sizing incorrectly follows automatic base scale');
"""
    result = subprocess.run([node, '-e', geometry_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('InfoStack automatic-area smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Execute managed AllMusic activation directly from the distributed source.
    allmusic_activation_smoke = f"""
const fs = require('fs');
const source = fs.readFileSync({json.dumps(str(samples / 'js' / 'allmusic.js'))}, 'utf8');
function methodBody(signature) {{
    const start = source.indexOf(signature);
    if (start < 0) throw new Error('Missing method: ' + signature);
    const open = source.indexOf('{{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let i = open; i < source.length; i++) {{
        const ch = source[i];
        if (quote) {{
            if (escaped) escaped = false;
            else if (ch === '\\\\') escaped = true;
            else if (ch === quote) quote = '';
            continue;
        }}
        if (ch === \"'\" || ch === '\"' || ch === '`') {{ quote = ch; continue; }}
        if (ch === '{{') depth++;
        else if (ch === '}}') {{
            depth--;
            if (depth === 0) return source.slice(open + 1, i);
        }}
    }}
    throw new Error('Unclosed method: ' + signature);
}}
const activate = new Function('force', methodBody('this.activate_managed = function (force)'));
const pending = new Function(methodBody('this.has_pending_work = function ()'));
global.panel = {{
    metadb: {{}},
    tf(value) {{ return value.indexOf('artist') > -1 ? 'Test Artist' : 'Test Album'; }}
}};
global._tagged = value => String(value || '').length > 0;
function provider(overrides) {{
    let callbacks = [];
    const value = {{
        managed: true,
        artist: 'Test Artist',
        album: 'Test Album',
        text: '',
        status_text: '',
        state: {{blocked: false}},
        resolved_album_url: '',
        review_url: '',
        terminal_state: '',
        history: {{stale: true}},
        last_request_url: 'stale',
        mb_fallback_started: true,
        request_kinds: {{}},
        scheduled_request_timers: {{}},
        has_pending_work: pending,
        reset() {{ throw new Error('Unexpected reset'); }},
        metadb_changed() {{ throw new Error('Unexpected identity reload'); }},
        blocked_message() {{ return 'blocked'; }},
        rebuild_text_layout() {{}},
        get() {{ this.request_kinds[1] = 'allmusic-search'; }},
        notify_terminal(success, reason) {{
            this.terminal_state = success ? 'success' : 'failure';
            callbacks.push({{success, reason}});
        }},
        callbacks
    }};
    return Object.assign(value, overrides || {{}});
}}
function assert(condition, message) {{ if (!condition) throw new Error(message); }}
let p = provider();
let state = activate.call(p, false);
assert(state === 'pending', 'Idle same-album activation did not start work');
assert(p.has_pending_work(), 'AllMusic activation did not register provider work');
assert(!Object.prototype.hasOwnProperty.call(p.history, 'stale'),
    'Stale AllMusic search history was not cleared');
assert(p.last_request_url === '', 'Stale AllMusic request URL was not cleared');

p = provider({{text: 'Cached review', terminal_state: 'failure'}});
state = activate.call(p, false);
assert(state === 'success' && p.callbacks.length === 1 && p.callbacks[0].success,
    'Cached same-album review did not re-arm terminal success');

p = provider({{request_kinds: {{7: 'allmusic-search'}}, get() {{ throw new Error('Pending work restarted'); }}}});
state = activate.call(p, false);
assert(state === 'pending', 'Existing AllMusic work was not preserved');

p = provider({{
    state: {{blocked: true}},
    resolved_album_url: 'https://www.allmusic.com/album/test',
    history: {{}}
}});
state = activate.call(p, false);
assert(state === 'failure' && p.callbacks[0].reason === 'saved browser-verification state',
    'Saved browser-verification state did not terminate the provider');

p = provider({{history: {{}}, get() {{}}}});
state = activate.call(p, false);
assert(state === 'failure' && p.callbacks[0].reason === 'provider did not start a request',
    'Idle provider activation did not fail closed');
"""
    result = subprocess.run([node, '-e', allmusic_activation_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('AllMusic managed-activation smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Execute the shared reset registry and bridge in a mocked panel window.
    reset_smoke = f"""
const fs = require('fs');
const vm = require('vm');
let properties = {{}};
let reloads = 0;
global.window = {{
    GetProperty(name, fallback) {{
        return Object.prototype.hasOwnProperty.call(properties, name)
            ? properties[name]
            : fallback;
    }},
    SetProperty(name, value) {{ properties[name] = value; }},
    Reload() {{ reloads++; }},
    Repaint() {{}}
}};
vm.runInThisContext(fs.readFileSync({json.dumps(str(registry_path))}, 'utf8'));
vm.runInThisContext(fs.readFileSync(
    {json.dumps(str(samples / 'js' / 'darkonejsp3_reset.js'))}, 'utf8'));
function assert(condition, message) {{
    if (!condition) throw new Error(message);
}}
function reset(values) {{ properties = Object.assign({{}}, values); reloads = 0; }}

reset({{
    'DarkOneJSP3.InfoStack.FontSize': 31,
    'DarkOneJSP3.InfoStack.AutoFontScale': 145,
    'DarkOneJSP3.InfoStack.ActivePanel': 4
}});
darkOneJsp3ApplyRoleReset('info-stack', 'appearance');
assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 0,
    'InfoStack fixed font-size default failed');
assert(properties['DarkOneJSP3.InfoStack.AutoFontScale'] === 100,
    'InfoStack automatic font-scale default failed');
assert(properties['DarkOneJSP3.InfoStack.ActivePanel'] === 4,
    'InfoStack appearance reset changed active-panel behaviour');

reset({{
    'JSPLAYLIST.Enable Smooth Scrolling': false,
    'JSPLAYLIST.UI Refresh Interval (ms)': 31,
    'JSPLAYLIST.Smooth Scroll Divisor': 7,
    'JSPLAYLIST.Playlist Wheel Throttle (ms)': 0,
    'JSPLAYLIST.Playlist Scroll Step': 9,
    'JSPLAYLIST.Snap Wheel Scrolling To Rows': false,
    'JSPLAYLIST.Snap Scrollbar Dragging To Rows': false,
    'JSPLAYLIST.Free Wheel Step (pixels)': 240
}});
assert(darkOneJsp3HandleSampleReset(
    'DarkOneJSP3.Reset.Properties', JSON.stringify({{version: 1, scope: 'behaviour'}}), 'js-playlist'),
    'JS Playlist reset notification was not handled');
assert(properties['JSPLAYLIST.Enable Smooth Scrolling'] === true,
    'JS Playlist smooth-scrolling default failed');
assert(properties['JSPLAYLIST.UI Refresh Interval (ms)'] === 8,
    'JS Playlist refresh default failed');
assert(properties['JSPLAYLIST.Smooth Scroll Divisor'] === 2,
    'JS Playlist smoothness default failed');
assert(properties['JSPLAYLIST.Playlist Wheel Throttle (ms)'] === 8,
    'JS Playlist wheel-throttle default failed');
assert(properties['JSPLAYLIST.Playlist Scroll Step'] === 3,
    'JS Playlist row-step default failed');
assert(properties['JSPLAYLIST.Snap Wheel Scrolling To Rows'] === true,
    'JS Playlist wheel-snap default failed');
assert(properties['JSPLAYLIST.Snap Scrollbar Dragging To Rows'] === true,
    'JS Playlist scrollbar-snap default failed');
assert(properties['JSPLAYLIST.Free Wheel Step (pixels)'] === 0,
    'JS Playlist free-wheel default failed');
assert(reloads === 1, 'JS Playlist reset did not reload exactly once');

reset({{
    'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
    'SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH': 555,
    'SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT': 44,
    'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
    'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
    'SMOOTH.SCROLL.SMOOTHNESS': 8,
    'SMOOTH.ROW.SCROLL.STEP': 9,
    'SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL': false,
    'SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE': false,
    'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
    'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{{"version":2}}'
}});
darkOneJsp3HandleSampleReset(
    'DarkOneJSP3.Reset.Properties', JSON.stringify({{version: 1, scope: 'behaviour'}}), 'playlist-manager');
assert(properties['SMOOTH.UI.REFRESH.INTERVAL.MS'] === 8,
    'Playlist Manager refresh default failed');
assert(properties['SMOOTH.SCROLL.SMOOTHNESS'] === 1.75,
    'Playlist Manager smoothness default failed');
assert(properties['SMOOTH.ROW.SCROLL.STEP'] === 3,
    'Playlist Manager row-step default failed');
assert(properties['SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL'] === true,
    'Playlist Manager remember-scroll default failed');
assert(properties['SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE'] === true,
    'Playlist Manager auto-show default failed');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER'] === false,
    'Behaviour reset changed Playlist Manager appearance');
assert(properties['SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS'] === false,
    'Behaviour reset changed Playlist Manager row shading');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL'] === 1234,
    'Behaviour reset cleared Playlist Manager scroll state');
assert(reloads === 1, 'Playlist Manager behaviour reset did not reload once');

reset({{
    'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
    'SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH': 555,
    'SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT': 44,
    'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
    'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
    'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
    'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{{"version":2}}'
}});
darkOneJsp3HandleSampleReset(
    'DarkOneJSP3.Reset.Properties', {{scope: 'appearance'}}, 'playlist-manager');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER'] === true,
    'Playlist Manager filter visibility default failed');
assert(properties['SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH'] === 300,
    'Playlist Manager filter width default failed');
assert(properties['SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT'] === 26,
    'Playlist Manager row-height default failed');
assert(properties['SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS'] === true,
    'Playlist Manager alternating-row default failed');
assert(properties['SMOOTH.UI.REFRESH.INTERVAL.MS'] === 25,
    'Appearance reset changed Playlist Manager behaviour');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL'] === 1234,
    'Appearance reset cleared Playlist Manager scroll state');
assert(reloads === 1, 'Playlist Manager appearance reset did not reload once');

reset({{
    'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
    'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
    'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
    'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
    'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{{"version":2}}'
}});
darkOneJsp3HandleSampleReset(
    'DarkOneJSP3.Reset.Properties', JSON.stringify({{version: 1, scope: 'all'}}), 'playlist-manager');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER'] === true,
    'Full reset missed Playlist Manager appearance');
assert(properties['SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS'] === true,
    'Full reset missed Playlist Manager alternating rows');
assert(properties['SMOOTH.UI.REFRESH.INTERVAL.MS'] === 8,
    'Full reset missed Playlist Manager behaviour');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL'] === 0,
    'Full reset did not clear numeric Playlist Manager scroll');
assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2'] === '',
    'Full reset did not clear row-aware Playlist Manager scroll state');
assert(reloads === 1, 'Playlist Manager full reset did not reload once');
"""
    result = subprocess.run([node, '-e', reset_smoke], capture_output=True, text=True)
    if result.returncode:
        errors.append('Playlist reset smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

    # Exercise the JSplitter-side reset parser with serialised and legacy payloads.
    jsplitter_reset_smoke = f"""
const fs = require('fs');
const vm = require('vm');
let properties = {{
    'DarkOneJSP3.InfoStack.FontSize': 31,
    'DarkOneJSP3.InfoStack.ActivePanel': 4
}};
let reloads = 0;
global.fb = {{ ProfilePath: '' }};
global.window = {{
    GetPanel() {{ return null; }},
    GetProperty(name, fallback) {{
        return Object.prototype.hasOwnProperty.call(properties, name)
            ? properties[name]
            : fallback;
    }},
    SetProperty(name, value) {{ properties[name] = value; }},
    Reload() {{ reloads++; }},
    Repaint() {{}}
}};
global.include = function() {{
    vm.runInThisContext(fs.readFileSync(
        {json.dumps(str(registry_path))}, 'utf8'));
}};
global.DARKONEJSP3_RESET_ROLE = 'info-stack';
vm.runInThisContext(fs.readFileSync(
    {json.dumps(str(project / 'jsplitter' / 'shared.js'))}, 'utf8'));
function assert(condition, message) {{
    if (!condition) throw new Error(message);
}}
assert(darkOneJsp3ResetScope(JSON.stringify({{version: 1, scope: 'appearance'}})) === 'appearance',
    'JSplitter did not parse a serialised reset scope');
assert(darkOneJsp3ResetScope({{scope: 'behaviour'}}) === 'behaviour',
    'JSplitter did not retain legacy object-payload compatibility');
assert(darkOneJsp3HandleReset('DarkOneJSP3.Reset.Properties',
    JSON.stringify({{version: 1, scope: 'appearance'}})),
    'JSplitter did not handle a serialised reset notification');
assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 0,
    'JSplitter serialised reset did not restore appearance defaults');
assert(properties['DarkOneJSP3.InfoStack.ActivePanel'] === 4,
    'JSplitter appearance reset changed behaviour state');
assert(reloads === 1, 'JSplitter serialised reset did not reload exactly once');
"""
    result = subprocess.run([node, '-e', jsplitter_reset_smoke],
                            capture_output=True, text=True)
    if result.returncode:
        errors.append('JSplitter reset smoke test failed: ' +
                      (result.stdout + result.stderr).strip())

with tempfile.TemporaryDirectory() as cache:
    for path in sorted(project.rglob('*.py')):
        result = subprocess.run(
            [sys.executable, '-m', 'py_compile', str(path)],
            env={**os.environ, 'PYTHONPYCACHEPREFIX': cache},
            capture_output=True,
            text=True,
        )
        if result.returncode:
            errors.append('Python compilation failed for ' + rel(path) + ': ' +
                          result.stderr.strip())

if errors:
    print(f'DarkOneJSP3 v{version or "unknown"} validation FAILED')
    for error in errors:
        print('- ' + error)
    raise SystemExit(1)

count = sum(1 for path in root.rglob('*')
            if path.is_file() and '__pycache__' not in path.parts)
print(f'DarkOneJSP3 v{version} validation passed: {count} files, zero warnings.')
