from __future__ import annotations

from pathlib import Path
import json
import os
import re

from .context import ValidationContext
from .expectations import (
    REQUIRED_PATHS,
    EXPECTED_MODULE_VERSIONS,
    SEMVER_MODULES,
    MENU_DOCUMENTATION_EXPECTATIONS,
)


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    project = ctx.project
    samples = ctx.samples
    docs = ctx.docs
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    require = ctx.require

    for relative_path in REQUIRED_PATHS:
        require(root / relative_path)

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
        if path.name.casefold() in {
                'bottom-area-state.txt',
                'darkonejsp3.bottom-area-state.txt',
                'darkonejsp3.reset-command.txt'}:
            errors.append('Runtime-generated state must not be distributed: ' + relative)
    for paths in casefold_paths.values():
        if len(paths) > 1:
            errors.append('Case-insensitive path collision: ' + ', '.join(sorted(paths)))

    gitignore = root / '.gitignore'
    if gitignore.exists():
        ignored = text(gitignore).replace('\\', '/').splitlines()
        for runtime_path in [
                'js_data/darkonejsp3.bottom-area-state.txt',
                'js_data/darkonejsp3.reset-command.txt',
                'DarkOneJSP3/shared/bottom-area-state.txt']:
            if runtime_path not in ignored:
                errors.append('.gitignore does not exclude runtime state: ' + runtime_path)

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
        for module_name, (expected, label) in EXPECTED_MODULE_VERSIONS.items():
            if modules.get(module_name) != expected:
                errors.append(
                    f'build-info {label} version is not {expected}'
                )
        for module_name in SEMVER_MODULES:
            module_version = str(modules.get(module_name, '')).strip()
            if not re.fullmatch(r'\d+\.\d+\.\d+', module_version):
                errors.append('build-info ' + module_name + ' version is invalid')


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


        # The manifest is the authoritative inventory for the scripted layout.
        # Validate every declared controller and panel source instead of relying
        # on later token checks that may silently skip a missing file.
        jsplitters = manifest.get('jsplitters', [])
        if not isinstance(jsplitters, list) or len(jsplitters) != 6:
            errors.append('Layout manifest must declare exactly six JSplitters')
            jsplitters = []
        jsplitter_numbers = []
        jsplitter_titles = []
        jsplitter_scripts = []
        for item in jsplitters:
            if not isinstance(item, dict):
                errors.append('Layout manifest contains an invalid JSplitter entry')
                continue
            number = item.get('number')
            title = str(item.get('title', '')).strip()
            script = str(item.get('script', '')).strip()
            if isinstance(number, int) and not isinstance(number, bool):
                jsplitter_numbers.append(number)
            else:
                errors.append('Layout manifest JSplitter number is invalid')
            jsplitter_titles.append(title)
            jsplitter_scripts.append(script)
            if not title or not script:
                errors.append('Layout manifest JSplitter entry is incomplete')
                continue
            target = project / 'jsplitter' / script
            if not target.is_file():
                errors.append(
                    'Layout manifest JSplitter source is missing: ' + rel(target)
                )
        if sorted(jsplitter_numbers) != list(range(1, 7)):
            errors.append('Layout manifest JSplitter numbers must be unique 1-6')
        if len(set(jsplitter_titles)) != len(jsplitter_titles):
            errors.append('Layout manifest contains duplicate JSplitter titles')
        if len(set(jsplitter_scripts)) != len(jsplitter_scripts):
            errors.append('Layout manifest contains duplicate JSplitter scripts')

        panels = manifest.get('panels', [])
        if not isinstance(panels, list) or len(panels) != 14:
            errors.append('Layout manifest must declare exactly fourteen panels')
            panels = []
        panel_numbers = []
        panel_titles_list = []
        for item in panels:
            if not isinstance(item, dict):
                errors.append('Layout manifest contains an invalid panel entry')
                continue
            number = item.get('number')
            title = str(item.get('title', '')).strip()
            source = str(item.get('source', '')).strip()
            if isinstance(number, int) and not isinstance(number, bool):
                panel_numbers.append(number)
            else:
                errors.append('Layout manifest panel number is invalid')
            panel_titles_list.append(title)
            if not title or not source:
                errors.append('Layout manifest panel entry is incomplete')
                continue
            if source == 'native component':
                continue
            if source.startswith('samples/'):
                target = samples / source[len('samples/'):]
            elif source.startswith('DarkOneJSP3/'):
                target = root / source
            else:
                errors.append('Layout manifest panel source is unsupported: ' + source)
                continue
            if not target.is_file():
                errors.append(
                    'Layout manifest panel source is missing: ' + rel(target)
                )
        if sorted(panel_numbers) != list(range(1, 15)):
            errors.append('Layout manifest panel numbers must be unique 1-14')
        if len(set(panel_titles_list)) != len(panel_titles_list):
            errors.append('Layout manifest contains duplicate panel titles')
        validation_tooling = manifest.get('enhancements', {}).get(
            'validation_tooling', {})
        expected_validation_tooling = {
            'entry_point': 'DarkOneJSP3/tools/validate_release.py',
            'package': 'DarkOneJSP3/tools/validation',
            'version': '0.6.5',
            'static_checks_module': 'validation/static_checks.py',
            'runtime_checks_module': 'validation/runtime_checks.py',
            'shared_context_module': 'validation/context.py',
            'data_driven_expectations_module': 'validation/expectations.py',
            'required_paths_data_driven': True,
            'module_versions_data_driven': True,
            'command_line_invocation_unchanged': True,
            'runtime_scripts_unchanged': False,
            'manifest_inventory_checked': True,
            'runtime_assets_checked': True,
            'repository_assets_checked_when_present': True,
            'manual_fcl_excluded': True,
            'configuration_guide_heading_spacing_checked': True,
            'enhanced_sample_readme_section_checked': True,
            'enhanced_sample_document_link_checked': True,
            'bottom_area_appearance_tests': True,
            'bottom_area_cross_component_file_bridge_tests': True,
            'bottom_area_first_paint_persistence_tests': True,
            'bottom_area_one_time_initialisation_tests': True,
            'bottom_area_divider_only_efficiency_tests': True,
            'waveform_reset_scope_tests': True,
            'album_art_unload_bitmap_disposal_tests': True,
            'performance_scheduler_tests': True,
            'playlist_render_cache_tests': True,
            'bitmap_rendering_checks': True,
            'smooth_scroll_rate_live_update_tests': True,
            'scrollbar_drag_cadence_tests': True,
            'scrollbar_drag_interpolation_tests': True,
            'display_style_runtime_tests': True,
            'offscreen_sprite_composition_checks': True,
            'volume_cadence_protocol_tests': True,
            'manual_refresh_interval_tests': True,
            'protected_volume_write_cadence_tests': True,
            'album_art_wheel_debounce_tests': True,
            'waveform_automatic_background_tests': True,
            'transparent_bottom_area_resolution_tests': True,
            'bottom_area_full_mode_matrix_tests': True,
        }
        for key, expected in expected_validation_tooling.items():
            if validation_tooling.get(key) != expected:
                errors.append(
                    'Manifest validation-tooling field is incorrect: ' + key
                )
        album_art_navigation = manifest.get('enhancements', {}).get(
            'album_art_navigation', {})
        expected_album_art_navigation = {
            'version': '0.1.0',
            'wheel_debounce_ms': 80,
            'trailing_wheel_coalescing': True,
            'keyboard_selection_immediate': True,
            'metadata_change_cancels_pending': True,
            'script_unload_cancels_pending': True,
            'intermediate_property_writes_avoided': True,
            'intermediate_image_decodes_avoided': True,
        }
        for key, expected in expected_album_art_navigation.items():
            if album_art_navigation.get(key) != expected:
                errors.append(
                    'Manifest Album Art navigation field is incorrect: ' + key
                )
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
            'version': '0.2.1',
            'startup_notifications_centralised': True,
            'startup_state_serialisation_centralised': True,
            'startup_command_serialisation_centralised': True,
            'startup_readiness_bridge_shared_by_controllers': True,
            'divider_notifications_centralised': True,
            'divider_state_serialisation_centralised': True,
            'divider_menu_mapping_centralised': True,
            'bottom_area_notifications_centralised': True,
            'bottom_area_state_serialisation_centralised': True,
            'bottom_area_host_owned_state': False,
            'bottom_area_file_backed_state': True,
            'bottom_area_component_hosts_isolated': True,
            'bottom_area_poll_interval_ms': 100,
            'reset_command_poll_interval_ms': 500,
            'bottom_area_jsplitter_state_relay': True,
            'property_ownership_unchanged': True,
            'saved_values_unchanged': True,
            'runtime_bridge_tests': True,
        }
        for key, expected in expected_protocol_consolidation.items():
            if protocol_consolidation.get(key) != expected:
                errors.append('Manifest JSplitter-protocol field is incorrect: ' + key)
        if protocol_consolidation.get('protocol_versions') != {
                'startup_controls': 'v1',
                'divider_state': 'v1',
                'bottom_area_state': 'v1'}:
            errors.append('Manifest JSplitter protocol versions are incorrect')
        bottom_area = manifest.get('enhancements', {}).get(
            'bottom_area_appearance', {})
        expected_bottom_area = {
            'menu_location': 'DarkOne Tools > Appearance',
            'background_default': 'DarkOne grey',
            'divider_default': 'DarkOne dark grey',
            'quick_search_frame_unchanged': True,
            'version': '0.2.5',
            'transparent_resolved_colour': 'DarkOne dark grey RGB 24,24,24',
            'transparent_cross_host_uniformity': True,
            'full_background_mode_matrix_validated': True,
            'shared_state_owner': 'runtime-generated shared state file',
            'protocol': 'DarkOneJSP3.BottomArea v1 same-host notifications plus file-backed state',
            'state_transport': 'runtime-generated UTF-8 state file',
            'state_file': 'js_data/darkonejsp3.bottom-area-state.txt',
            'legacy_state_file_migrated': True,
            'state_file_packaged': False,
            'poll_interval_ms': 100,
            'jscript_panels_poll_file': False,
            'jscript_panels_read_on_initialisation': True,
            'jsplitter_host_polls_file': True,
            'notification_fast_path_retained': True,
            'failed_write_diagnostics': True,
            'failed_write_retry': True,
            'factory_reset_command_file': 'js_data/darkonejsp3.reset-command.txt',
            'factory_reset_cross_host_bridge': True,
            'jsplitter_state_relay': True,
            'display_waveform_automatic_consumer': True,
            'display_waveform_additional_poller': False,
            'jscript_write_text_file_call': 'two-argument canonical form',
            'restart_persistence_tests': True,
            'full_host_backing_repaints': True,
            'layout_gap_covered_by_host': True,
            'columns_ui_live_update': True,
            'transparent_layers_supported': True,
            'runtime_tests': True,
        }
        for key, expected in expected_bottom_area.items():
            if bottom_area.get(key) != expected:
                errors.append('Manifest bottom-area appearance field is incorrect: ' + key)
        expected_bottom_modes = [
            'Transparent', 'Black', 'DarkOne grey', 'DarkOne dark grey',
            'Columns UI global background', 'Custom colour']
        if bottom_area.get('modes') != expected_bottom_modes:
            errors.append('Manifest bottom-area colour modes are incorrect')
        expected_bottom_properties = [
            'DARKONEJSP3.BOTTOM.BACKGROUND.MODE',
            'DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR',
            'DARKONEJSP3.BOTTOM.DIVIDER.MODE',
            'DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR']
        if bottom_area.get('properties') != expected_bottom_properties:
            errors.append('Manifest bottom-area properties are incorrect')

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
            'bottom_area_appearance_covered',
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
        if js_playlist_manifest.get('inline_metadata_viewport_preserved') is not True:
            errors.append('Manifest omits JS Playlist inline-metadata viewport preservation')
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
        if queue_manifest.get('recommended_component') != 'native Queue Viewer':
            errors.append('Manifest does not recommend the native Queue Viewer')
        if queue_manifest.get('native_component_full_editing') is not True:
            errors.append('Manifest omits native Queue Viewer editing support')
        if queue_manifest.get('scripted_viewer_optional') is not True or                 queue_manifest.get('scripted_mutation_support') is not False:
            errors.append('Manifest does not describe the scripted Queue Viewer limitation')
        for flag in ['scripted_multi_selection', 'scripted_keyboard_navigation']:
            if queue_manifest.get(flag) is not True:
                errors.append('Manifest Queue Viewer enhancement is missing: ' + flag)
        queue_panel = next((panel for panel in manifest.get('panels', [])
                            if isinstance(panel, dict) and panel.get('title') == 'DOJSP3.Queue'), None)
        if not queue_panel or queue_panel.get('type') != 'Queue Viewer' or                 queue_panel.get('source') != 'native component':
            errors.append('Manifest does not use the native Queue Viewer for DOJSP3.Queue')
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

    # Standalone enhanced-sample reset bridge scope and ownership.
    sample_defaults_import = '%fb2k_component_path%samples\\shared\\sample_defaults.js'
    sample_bridge_import = '%fb2k_component_path%samples\\js\\jsp3_enhanced_reset.js'
    legacy_project_import = '%fb2k_profile_path%DarkOneJSP3\\'
    reset_entries: set[str] = set()
    if samples.exists():
        for entry in samples.glob('*.txt'):
            body = text(entry)
            if legacy_project_import in body:
                errors.append(rel(entry) + ' retains a hard DarkOneJSP3 profile dependency')
            if sample_defaults_import in body or sample_bridge_import in body:
                reset_entries.add(entry.name)
            if (sample_defaults_import in body) != (sample_bridge_import in body):
                errors.append(rel(entry) + ' imports only half of the standalone reset bridge')
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
            'Standalone reset bridge import ownership mismatch: ' +
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
        if 'jsp3EnhancedHandleSampleReset(' not in body:
            continue
        missing = []
        if sample_defaults_import not in body:
            missing.append('sample_defaults.js')
        if sample_bridge_import not in body:
            missing.append('jsp3_enhanced_reset.js')
        if missing:
            errors.append(
                rel(entry) + ' calls the standalone reset helper without importing ' +
                ' and '.join(missing)
            )

    queue_entry = project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt'
    if queue_entry.exists():
        body = text(queue_entry)
        if '// @version "0.6.1"' not in body:
            errors.append('DarkOneJSP3 Queue Viewer wrapper version is not 0.6.1')
        if 'jsp3EnhancedHandleSampleReset(name, info, "queue-viewer")' not in body:
            errors.append('DarkOneJSP3 Queue Viewer reset callback is missing')
        if sample_defaults_import not in body or sample_bridge_import not in body:
            errors.append('DarkOneJSP3 Queue Viewer standalone reset imports are incomplete')

    generic_queue_entry = samples / 'Queue Viewer.txt'
    if generic_queue_entry.exists() and '// @version "0.6.1"' not in text(generic_queue_entry):
        errors.append('Generic enhanced Queue Viewer entry version is not 0.6.1')

    queue_source = project / 'jscript' / 'js' / 'Queue_Viewer.js'
    if queue_source.exists():
        body = text(queue_source)
        for token in [
            'this.selected_indices = []',
            'this.select_range = function',
            'this.select_all = function',
            'case VK_PGUP:',
            'case VK_PGDN:',
            "handles.RunContextCommand('Properties')",
            'plman.ExecutePlaylistDefaultAction',
            'utils.SetClipboardText',
            'this.restore_selection(this.pending_selection)',
            "case 1407:",
        ]:
            if token not in body:
                errors.append('Queue Viewer navigation/command support is missing: ' + token)
        for forbidden in [
            'FlushPlaybackQueue',
            'RemoveItemFromPlaybackQueue',
            'RemoveItemsFromPlaybackQueue',
            'GetPlaybackQueueHandles',
        ]:
            if forbidden in body:
                errors.append('Queue Viewer uses unsupported queue API: ' + forbidden)

    for path in [
        samples / 'js' / 'darkone_network.js',
        samples / 'js' / 'musicbrainz.js',
        samples / 'js' / 'allmusic.js',
        samples / 'js' / 'album_notes.js',
        project / 'jscript' / 'js' / 'Queue_Viewer.js',
    ]:
        if not path.exists():
            continue
        body = text(path)
        for obsolete in [
            'DarkOneJSP3 application (recommended)',
            'DarkOneJSP3 Album Notes diagnostics',
            '[DarkOneJSP3 Queue Viewer]',
            "'DarkOneJSP3/0.6.2 (foobar2000 JScript Panel 3",
        ]:
            if obsolete in body:
                errors.append(rel(path) + ' retains visible project branding in a standalone sample: ' + obsolete)

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
            'options.enhanced_page_background === true',
            'options.darkonejsp3_page_background === true',
            "new _p('DARKONEJSP3.PAGE.BACKGROUND.MODE', 3)",
            "new _p('DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR', RGB(24, 24, 24))",
            "'Transparent / inherit parent'",
            "'DarkOne grey'",
            "'DarkOne dark grey'",
            "'Columns UI global background'",
            "'Page background colour'",
            'gr.Clear(this.page_background_colour())',
            "typeof DarkOneColour !== 'undefined'",
            'case Boolean(background_option):',
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
        if 'new _panel({ enhanced_page_background : true })' not in body:
            errors.append(rel(entry) + ' does not opt in to page backgrounds')
        if role not in body:
            errors.append(rel(entry) + ' does not identify its reset role: ' + role)

    standalone_performance_helper = samples / 'shared' / 'performance_utils.js'
    standalone_cadence_helper = samples / 'shared' / 'ui_cadence.js'
    component_helpers = root / 'user-components-x64' / 'foo_jscript_panel3' / 'helpers.txt'
    if standalone_performance_helper.exists() and 'typeof DarkOnePerformance != "undefined"' not in text(standalone_performance_helper):
        errors.append('Standalone performance helper lacks duplicate-import protection')
    if standalone_cadence_helper.exists() and 'typeof DarkOneUiCadence != "undefined"' not in text(standalone_cadence_helper):
        errors.append('Standalone UI-cadence helper lacks duplicate-import protection')
    canonical_import_order = {
        samples / 'JS Playlist.txt': [
            'samples\\shared\\performance_utils.js',
            'samples\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
        samples / 'Smooth Playlist Manager.txt': [
            'samples\\shared\\performance_utils.js',
            'samples\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
        project / 'jscript' / 'DarkOneJSP3 - Display Panel.txt': [
            'DarkOneJSP3\\shared\\performance_utils.js',
            'DarkOneJSP3\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Left.txt': [
            'DarkOneJSP3\\shared\\performance_utils.js',
            '%fb2k_component_path%helpers.txt',
        ],
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Right.txt': [
            'DarkOneJSP3\\shared\\performance_utils.js',
            'DarkOneJSP3\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
    }
    for entry, tokens in canonical_import_order.items():
        if not entry.exists():
            continue
        body = text(entry)
        positions = [body.find(token) for token in tokens]
        if any(position < 0 for position in positions) or positions != sorted(positions):
            errors.append(rel(entry) + ' does not load canonical helpers before helpers.txt')

    redundant_network_import = '%fb2k_component_path%samples\\js\\darkone_network.js'
    for entry in [
        samples / 'Album Notes.txt',
        samples / 'MusicBrainz.txt',
        samples / 'Allmusic Review.txt',
        samples / 'Allmusic Review + Album Art.txt',
    ]:
        if entry.exists() and redundant_network_import in text(entry):
            errors.append(rel(entry) + ' redundantly imports the network coordinator after common.js')

    if component_helpers.exists():
        helper_body = text(component_helpers)
        for token in [
            '// == JSP3 ENHANCED SAMPLE COMPATIBILITY HELPERS ==',
            'var DarkOnePerformance = typeof DarkOnePerformance != "undefined"',
            'var DarkOneUiCadence = typeof DarkOneUiCadence != "undefined"',
            '// == END JSP3 ENHANCED SAMPLE COMPATIBILITY HELPERS ==',
        ]:
            if token not in helper_body:
                errors.append('helpers.txt legacy-sample compatibility is missing: ' + token)

    performance_helper = project / 'shared' / 'performance_utils.js'
    if performance_helper.exists():
        body = text(performance_helper)
        for token in [
            'DARKONE_PERFORMANCE_UTILS_VERSION = "0.1.4"',
            'createRepaintScheduler',
            'createFrameLoop',
            'createValueCoalescer',
            'reschedule: function ()',
            'createTrailingDeadline',
            'createProfiler',
            'toBitmap',
        ]:
            if token not in body:
                errors.append('Shared performance-helper module is incomplete: ' + token)
        for forbidden in [
            'typeof resource.Dispose',
            'typeof image.CreateBitmap',
            'typeof utils.LoadBitmap',
            'typeof utils.LoadImage',
            'typeof utilsObject.CreateProfiler',
            'typeof profiler.Reset',
        ]:
            if forbidden in body:
                errors.append(
                    'Shared performance-helper module incorrectly gates a native JScript Panel COM method with typeof: ' +
                    forbidden)


    ui_cadence_helper = project / 'shared' / 'ui_cadence.js'
    if ui_cadence_helper.exists():
        body = text(ui_cadence_helper)
        for token in [
            'DARKONE_UI_CADENCE_VERSION = "0.1.1"',
            'DarkOneJSP3.UIRefresh.Source.State',
            'DarkOneJSP3.UIRefresh.Source.Query',
            'DarkOneJSP3.VolumeRefresh.State',
            'DarkOneJSP3.VolumeRefresh.Query',
            'createSourceReporter',
            'createVolumeOwner',
            'createVolumeFollower',
            'Automatic (currently ',
            'VOLUME_MANUAL_INTERVALS = [8, 10, 12, 16]',
        ]:
            if token not in body:
                errors.append('Shared UI-cadence protocol is incomplete: ' + token)

    project_reset_receivers = {
        project / 'jscript' / 'js' / 'Config_Global_Script.js': [
            'function darkOneNormaliseResetScope(value)',
            "if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;",
        ],
        project / 'jsplitter' / 'shared.js': [
            'function darkOneJsp3NormaliseResetScope(value)',
            "if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;",
        ],
    }
    for receiver, tokens in project_reset_receivers.items():
        if not receiver.exists():
            continue
        receiver_body = text(receiver)
        for token in tokens:
            if token not in receiver_body:
                errors.append(rel(receiver) + ' project reset hardening is missing: ' + token)

    reset_bridge_path = samples / 'js' / 'jsp3_enhanced_reset.js'
    if reset_bridge_path.exists():
        bridge_body = text(reset_bridge_path)
        for token in [
            'function jsp3EnhancedNormaliseResetScope(value)',
            'function jsp3EnhancedHasResetRole(role)',
            'if (!scope) return false;',
            'if (!handled) return false;',
        ]:
            if token not in bridge_body:
                errors.append('Standalone reset bridge hardening is missing: ' + token)

    legacy_reset_path = samples / 'js' / 'darkonejsp3_reset.js'
    if legacy_reset_path.exists():
        legacy_body = text(legacy_reset_path)
        for token in [
            '// == JSP3 ENHANCED LEGACY SAMPLE DEFAULTS ==',
            '// == END JSP3 ENHANCED LEGACY SAMPLE DEFAULTS ==',
            '// == JSP3 ENHANCED LEGACY RESET BRIDGE ==',
            '// == END JSP3 ENHANCED LEGACY RESET BRIDGE ==',
        ]:
            if token not in legacy_body:
                errors.append('Legacy saved-entry reset adapter is missing: ' + token)

    sample_registry_path = samples / 'shared' / 'sample_defaults.js'
    if sample_registry_path.exists():
        registry_body = text(sample_registry_path)
        for token in [
            'var JSP3_ENHANCED_RESET_REGISTRY = {',
            'function jsp3EnhancedRoleDefaults(role, scope)',
            'function jsp3EnhancedApplyRoleReset(role, scope)',
            'var DARKONEJSP3_SAMPLE_RESET_REGISTRY = JSP3_ENHANCED_RESET_REGISTRY',
        ]:
            if token not in registry_body:
                errors.append('Standalone sample-default registry is missing: ' + token)
        for role in ['lastfm-bio', 'lastfm-info', 'album-notes', 'queue-viewer', 'properties']:
            role_match = re.search(
                r'"' + re.escape(role) + r'"\s*:\s*\{(.*?)(?=\n    "[^"]+"\s*:\s*\{|\n\};)',
                registry_body, re.S)
            if not role_match:
                errors.append('Standalone sample reset registry is missing page-background role: ' + role)
                continue
            block = role_match.group(1)
            for token in [
                    '"DARKONEJSP3.PAGE.BACKGROUND.MODE": 3',
                    '"DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818']:
                if token not in block:
                    errors.append('Standalone sample reset registry page-background default is missing for ' + role + ': ' + token)

    album_notes = samples / 'Album Notes.txt'
    if album_notes.exists():
        album_notes_entry_body = text(album_notes)
        token = 'jsp3EnhancedHandleSampleReset(name, info, ["album-notes", "musicbrainz"])'
        if token not in album_notes_entry_body:
            errors.append('Album Notes does not reset embedded MusicBrainz settings')
        if '// @version "0.6.8"' not in album_notes_entry_body:
            errors.append('Album Notes entry version is not 0.6.8')

    album_art_entry = samples / 'Album Art.txt'
    if album_art_entry.exists():
        album_art_body = text(album_art_entry)
        for token in [
            '// @name "Album Art - Enhanced"',
            '// @version "0.1.0"',
            '// @author "marc2003 / DeViLhoOD"',
            'albumart.dispose();',
        ]:
            if token not in album_art_body:
                errors.append('Enhanced Album Art entry is missing: ' + token)
        for token in [
            'Side divider colour',
            'DarkOneJSP3.ArtSpectrum.Divider.',
            'darkOneJsp3Divider',
        ]:
            if token in album_art_body:
                errors.append('Album Art retains unsupported divider bridge: ' + token)

    album_art_impl = samples / 'js' / 'albumart.js'
    if album_art_impl.exists():
        album_art_impl_body = text(album_art_impl)
        for token in [
            'this.wheel_debounce_ms = 80;',
            'this.pending_id = id;',
            'this.wheel_timer = window.SetTimeout(function () {',
            'return this.cycle_artwork(s, true);',
            'this.cancel_wheel_selection();',
        ]:
            if token not in album_art_impl_body:
                errors.append('Album Art wheel hardening is missing: ' + token)

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
    if musicbrainz.exists():
        musicbrainz_body = text(musicbrainz)
        if 'jsp3EnhancedHandleSampleReset(name, info, "musicbrainz")' not in musicbrainz_body:
            errors.append('Standalone MusicBrainz reset bridge is missing')
        if '// @version "0.6.4"' not in musicbrainz_body:
            errors.append('MusicBrainz entry version is not 0.6.4')
    js_playlist_entry = samples / 'JS Playlist.txt'
    if js_playlist_entry.exists():
        body = text(js_playlist_entry)
        if 'jsp3EnhancedHandleSampleReset(name, info, "js-playlist")' not in body:
            errors.append('JS Playlist reset bridge is missing')
        if '// @version "0.6.0"' not in body:
            errors.append('JS Playlist entry version is not 0.6.0')
        for token in [
            'samples\\shared\\performance_utils.js',
            'samples\\shared\\ui_cadence.js',
            'samples\\jsplaylist\\render_cache.js',
        ]:
            if token not in body:
                errors.append('JS Playlist performance import is missing: ' + token)

    js_playlist_main = samples / 'jsplaylist' / 'main.js'
    js_playlist_rows = samples / 'jsplaylist' / 'playlist.js'
    js_playlist_header = samples / 'jsplaylist' / 'headerbar.js'
    js_playlist_topbar = samples / 'jsplaylist' / 'topbar.js'
    js_playlist_cache = samples / 'jsplaylist' / 'render_cache.js'
    if js_playlist_main.exists():
        body = text(js_playlist_main)
        for token in [
            'DarkOnePerformance.createRepaintScheduler(window, {',
            'g_repaint_scheduler.request();',
            'function repaint_scroll_frame()',
            'repaint_scroll_frame();',
            'DarkOnePerformance.toBitmap(image, true)',
            'g_stub_image = DarkOnePerformance.toBitmap(refreshedStub, true);',
            'gr.DrawBitmap(img,',
            'g_playlist_render_cache.invalidateAll();',
            'g_playlist_render_cache.invalidateHandles(handle_list, p.list ? p.list.handleList : null);',
            'function on_playback_dynamic_info() {',
            'function on_playback_seek(time) {',
            'function bump_playlist_dynamic_generation() {',
            'function repaint_current_playlist_row() {',
            'function on_playlists_changed() {',
            'function update_playlist(preserveOffset)',
            'var previous_offset = preserveOffset ? p.list.offset : null;',
            'p.list.offset = Math.max(0, Math.min(Math.round(previous_offset), maximum_offset));',
            'update_playlist(true);',
            'Metadata-only changes such as an inline rating update',
            'DarkOnePerformance.createProfiler(',
            'function set_playlist_refresh_interval(value)',
            'g_js_playlist_cadence_reporter.announce();',
            'DarkOneUiCadence.createSourceReporter(window, {',
            'function reschedule_active_playlist_scroll_timers()',
            'function playlist_scroll_frame_tick()',
            'function ensure_playlist_scroll_frame()',
            'function repaint_playlist_scrollbar_drag_frame()',
            'function ensure_playlist_scrollbar_drag_frame()',
            'function begin_playlist_scrollbar_drag(snap_to_rows)',
            'function update_playlist_scrollbar_drag(position, snap_to_rows)',
            'function playlist_scrollbar_drag_frame_tick()',
            'function finish_playlist_scrollbar_drag(position, snap_to_rows)',
            'function cancel_playlist_scrollbar_drag()',
            'apply_free_wheel_position(position, preserve_scrollbar_cursor, suppress_repaint)',
            'DarkOnePerformance.createFrameLoop(window, {',
            'getDelay: function () { return cList.repaint_interval; }',
            'tick: playlist_scroll_frame_tick',
            'window.Repaint();',
        ]:
            if token not in body:
                errors.append('JS Playlist performance optimisation is missing: ' + token)
        for obsolete in [
            'function on_playlist_items_changed(playlistIndex) {\n\tif (playlistIndex == g_active_playlist) {\n\t\tupdate_playlist();',
            'DarkOneDisplayRefresh.createController(window, {',
            'function set_playlist_refresh_automatic()',
            'g_repaint_timer = window.SetInterval(function () {',
            'window.SetInterval(smooth_scroll_tick, cList.repaint_interval)',
            'window.SetInterval(free_wheel_scroll_tick, cList.repaint_interval)',
            'gr.DrawImage(img, dst_x, dst_y, dst_w, dst_h',
            'g_stub_image = fb.GetAlbumArtStub(cGroup.art_id);',
            'function schedule_playlist_scrollbar_drag_frame(',
            'function flush_playlist_scrollbar_drag_frame(',
            'function cancel_playlist_scrollbar_drag_frame(',
            'cList.scrollbar_drag_rebuild_items',
        ]:
            if obsolete in body:
                errors.append('JS Playlist retains an obsolete rendering path: ' + obsolete)
    js_playlist_scrollbar = samples / 'jsplaylist' / 'scrollbar.js'
    if js_playlist_scrollbar.exists():
        body = text(js_playlist_scrollbar)
        for token in [
            'cancel_playlist_scrollbar_drag();',
            'begin_playlist_scrollbar_drag(cList.scrollbar_snap);',
            'update_playlist_scrollbar_drag(target_row * Math.max(1, cRow.playlist_h), true);',
            'update_playlist_scrollbar_drag(this.setPixelPositionFromCursorPos(), false);',
            'finish_playlist_scrollbar_drag(final_row * Math.max(1, cRow.playlist_h), true);',
            'finish_playlist_scrollbar_drag(final_position, false);',
        ]:
            if token not in body:
                errors.append('JS Playlist scrollbar-drag interpolation handling is missing: ' + token)
        if 'g_mouse_wheel_timeout = window.SetTimeout(function () {' in body:
            errors.append('JS Playlist scrollbar dragging still reuses the wheel-throttle timer')
        for obsolete in [
            'schedule_playlist_scrollbar_drag_frame(',
            'flush_playlist_scrollbar_drag_frame(',
            'cancel_playlist_scrollbar_drag_frame(',
            'apply_free_wheel_position(this.setPixelPositionFromCursorPos(), true, true);',
        ]:
            if obsolete in body:
                errors.append('JS Playlist scrollbar dragging retains an input-driven one-shot path: ' + obsolete)
    if js_playlist_rows.exists():
        body = text(js_playlist_rows)
        for token in [
            'g_playlist_render_cache.getConfigured(this.track_index, forceFresh, paintState.dynamicGeneration)',
            'g_playlist_render_cache.configure(g_tf_pattern, secondaryPattern, lovedSync);',
            'dynamicGeneration: g_playlist_dynamic_generation',
            'var paintState = {',
            'this.repaintTrack = function (trackIndex)',
        ]:
            if token not in body:
                errors.append('JS Playlist row-cache optimisation is missing: ' + token)
    if js_playlist_topbar.exists():
        body = text(js_playlist_topbar)
        for token in [
            'DarkOnePerformance.loadBitmap(',
            'gr.DrawBitmap(this.logo,',
        ]:
            if token not in body:
                errors.append('JS Playlist top-bar bitmap optimisation is missing: ' + token)
        if 'gr.DrawImage(this.logo,' in body:
            errors.append('JS Playlist top bar retains the obsolete image rendering path')

    if js_playlist_header.exists():
        body = text(js_playlist_header)
        for token in [
            'this.columnsDirty = true;',
            'if (!this.columnsDirty) return;',
            'this.invalidateColumns();',
        ]:
            if token not in body:
                errors.append('JS Playlist column-layout caching is missing: ' + token)
    if js_playlist_cache.exists():
        body = text(js_playlist_cache)
        for token in [
            'DARKONE_JSPLAYLIST_RENDER_CACHE_VERSION = "0.1.0"',
            'this.globalClockDynamic',
            'this.dynamicHits',
            'this.primaryCoupledDynamic',
            'this.getConfigured = function (trackIndex, refreshCurrentFields, currentGeneration)',
            'entry.dynamicResult && entry.dynamicKey === dynamicKey',
            'this.invalidateHandles = function (changedHandles, activeHandles)',
            'if (key === this.patternKey) return false;',
            'this.invalidateAll = function ()',
            'this.maxEntries',
        ]:
            if token not in body:
                errors.append('JS Playlist render-cache module is incomplete: ' + token)

    display_performance = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_performance.exists():
        body = text(display_performance)
        for token in [
            'DarkOnePerformance.toBitmap(g_matrix_source, false)',
            'DarkOnePerformance.toBitmap(g_icons_source, false)',
            'BaseImage.prototype.commitBitmap = function()',
            'gr.DrawBitmap(this.bitmap,',
            'this.drawMatrixSpriteToImage = function(',
            'gr.DrawImage(this.matrix_source_image,',
            'this.setDisplayStyle = function(style)',
            'this.value_label_widths = {};',
            'this.value_label_widths[valueLabel]',
        ]:
            if token not in body:
                errors.append('Display bitmap/measurement optimisation is missing: ' + token)
        object_prefix = body.split('// ----- TITLE-FORMAT CACHE -----', 1)[0]
        if 'display_system.drawMatrixSprite(gr,' in object_prefix:
            errors.append('Display off-screen digit composition still uses the panel bitmap path')

    display_panel = project / 'jscript' / 'js' / 'Panel_Display.js'
    if display_panel.exists():
        body = text(display_panel)
        if 'display_system.setDisplayStyle(idx - 1);' not in body:
            errors.append('Display Style menu does not use the validated style setter')

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
        if 'jsp3EnhancedHandleSampleReset(name, info, "playlist-manager")' not in body:
            errors.append('Smooth Playlist Manager reset bridge is missing')
        if '// @version "0.5.5"' not in body:
            errors.append('Smooth Playlist Manager entry version is not 0.5.5')
        if 'samples\\shared\\performance_utils.js' not in body:
            errors.append('Smooth Playlist Manager does not import shared performance helpers')
        if 'samples\\shared\\ui_cadence.js' not in body:
            errors.append('Smooth Playlist Manager does not import shared UI-cadence helpers')

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
            'DarkOnePerformance.createFrameLoop(window, {',
            'function playlist_manager_frame_tick()',
            'if (g_playlist_manager_frame) g_playlist_manager_frame.stop();',
            'this.rows[i].isAutoPlaylist',
            'this.rows[i].isLocked',
            '!isAutoPlaylist && plman.IsPlaylistLocked(i)',
            'window.IsVisible && rowY + ppt.rowHeight',
            'DarkOnePerformance.createProfiler(',
            'function set_playlist_manager_refresh_rate(value)',
            'g_playlist_manager_cadence_reporter.announce();',
            'DarkOneUiCadence.createSourceReporter(window, {',
            'ppt.refreshRate = value;',
            'g_playlist_manager_frame.reschedule();',
            'set_playlist_manager_refresh_rate([8, 10, 12, 16][idx - 33]);',
            'Set custom refresh interval...',
            'timers.initialPopulate = window.SetTimeout(function () {',
            'function clearPlaylistManagerTimers()',
            'g_playlist_manager_frame.stop();',
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
        for obsolete in [
            'DarkOneDisplayRefresh.createController(window, {',
            'function set_playlist_manager_refresh_automatic()',
            'timers.repaint = window.SetInterval(function () {',
            'plman.IsAutoPlaylist(this.rows[i].idx)',
            'plman.IsPlaylistLocked(this.rows[i].idx)',
            'window.SetProperty("SMOOTH.UI.REFRESH.INTERVAL.MS", [8, 10, 12, 16][idx - 32]);',
        ]:
            if obsolete in body:
                errors.append('Playlist Manager retains an obsolete performance path: ' + obsolete)

    registry_path = project / 'shared' / 'reset_defaults.js'
    sample_registry_path = samples / 'shared' / 'sample_defaults.js'
    if registry_path.exists():
        registry = text(registry_path)
        for role in ['control-left', 'control-right', 'display', 'root', 'main-columns', 'info-stack',
                     'display-waveform', 'bottom-controls']:
            if f'"{role}"' not in registry:
                errors.append('DarkOneJSP3 reset role missing: ' + role)
        for role in ['album-notes', 'musicbrainz', 'queue-viewer', 'js-playlist', 'playlist-manager']:
            if f'"{role}"' in registry:
                errors.append('Sample-owned reset role remains in the DarkOneJSP3 registry: ' + role)
        if '"DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE": 0' not in registry:
            errors.append('Control Right reset registry is missing the automatic volume-cadence default')
        for token in [
            'darkOneJsp3AddOptionalButtonDefaults("control-left", 8);',
            'darkOneJsp3AddOptionalButtonDefaults("control-right", 10);',
            'add(entry.complete || {});',
        ]:
            if token not in registry:
                errors.append('Optional-button reset coverage is missing: ' + token)
        for token in [
            '"DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE": 1',
            '"DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR": 0xff000000',
        ]:
            if token not in registry:
                errors.append('Upper divider reset default is missing: ' + token)
        for token in [
            '"DARKONEJSP3.BOTTOM.BACKGROUND.MODE": 2',
            '"DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR": 0xff000000',
            '"DARKONEJSP3.BOTTOM.DIVIDER.MODE": 4',
            '"DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR": 0xff000000',
        ]:
            if token not in registry:
                errors.append('Bottom-area reset default is missing: ' + token)

    if sample_registry_path.exists():
        sample_registry = text(sample_registry_path)
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
            if token not in sample_registry:
                errors.append('JS Playlist reset default is missing: ' + token)
        for token in manager_defaults:
            if token not in sample_registry:
                errors.append('Playlist Manager reset default is missing: ' + token)

    for path in [project / 'jsplitter' / '04_art_spectrum.js']:
        if path.exists() and 'DARKONEJSP3_RESET_ROLE' in text(path):
            errors.append(rel(path) + ' declares a no-op reset role')

    shared = project / 'jsplitter' / 'shared.js'
    if shared.exists() and 'if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;' not in text(shared):
        errors.append('JSplitter reset handler does not reject invalid scopes or hosts without settings')

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

    sample_reset = samples / 'js' / 'jsp3_enhanced_reset.js'
    if sample_reset.exists():
        body = text(sample_reset)
        for token in [
            'function jsp3EnhancedSampleResetScope(info)',
            'var scope = jsp3EnhancedSampleResetScope(info);',
            'JSP3Enhanced.Reset.Properties',
            'DarkOneJSP3.Reset.Properties',
            'function darkOneJsp3HandleSampleReset(name, info, roles)',
            'JSON.parse(info)',
        ]:
            if token not in body:
                errors.append('Standalone sample reset bridge is missing: ' + token)
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
        enhanced_samples_target = 'DarkOneJSP3/docs/ENHANCED_SAMPLES.txt'
        if '## Enhanced Sample Library' not in readme_body:
            errors.append('README.md is missing the Enhanced Sample Library section')
        if f']({enhanced_samples_target})' not in readme_body:
            errors.append('README.md is missing a link to the enhanced sample guide')
        # Promotional artwork is maintained in the GitHub repository and may be
        # omitted from runtime release archives. When an assets folder is present,
        # however, every referenced repository image must also be present.
        repository_only_assets = {
            'assets/darkonejsp3-logo.png',
            'assets/darkonejsp3-screenshot-main.jpg',
            'assets/darkonejsp3-screenshot-albumnotes.jpg',
        }
        readme_targets = re.findall(r'\[[^\]]+\]\(([^)]+)\)', readme_body)
        readme_targets += re.findall(r'<img\s+[^>]*src=["\']([^"\']+)', readme_body, re.I)
        repository_assets_present = (root / 'assets').is_dir()
        for target in readme_targets:
            if '://' in target or target.startswith('#'):
                continue
            if Path(target).suffix.lower() == '.fcl':
                continue
            if target in repository_only_assets and not repository_assets_present:
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
            while i < len(lines) and not lines[i].strip():
                i += 1
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
        guide_lines = body.splitlines()
        for i in range(len(guide_lines) - 1):
            if not (
                    is_heading_underline(guide_lines[i + 1]) and
                    len(guide_lines[i]) == len(guide_lines[i + 1])):
                continue
            if i > 0 and guide_lines[i - 1] != '':
                errors.append(
                    'Configuration guide heading lacks a blank line before line ' +
                    str(i + 1)
                )
            if i + 2 < len(guide_lines) and guide_lines[i + 2] != '':
                errors.append(
                    'Configuration guide heading lacks a blank line after line ' +
                    str(i + 2)
                )
        if '13. Resetting DarkOneJSP3' not in body:
            errors.append('Configuration guide contents omit the reset section')
        if body.count('Album Notes cache files and downloaded provider data') > 1:
            errors.append('Configuration guide repeats cache-preservation guidance')
        for phrase in [
            'The enhanced JS Playlist participates in behaviour and full resets',
            'additionally clears its saved scroll anchors',
            'Automatic base scale ranges from 50% to 200%',
            'size bypasses responsive calculation',
            'Alternating row shading',
            'DarkOneJSP3-managed defaults',
            'DarkOne dark grey: RGB 24, 24, 24',
            'Generic upstream',
            'Optional scripted Queue Viewer',
            'Album Art/Spectrum side dividers',
            'Side divider colour',
            'InfoStack tab strip',
            'generic image panel rather than an InfoStack text page',
            'Transparent / inherit parent',
            'The lower control-panel dividers',
            'Page background colour',
            'DarkOne dark grey: RGB 24, 24, 24 (default)',
            'Each panel instance stores its choice independently',
        ]:
            if phrase not in body:
                errors.append('Configuration guide playlist reset coverage is missing: ' + phrase)


        for expectation in MENU_DOCUMENTATION_EXPECTATIONS:
            source_path = root / expectation['source']
            if not source_path.exists():
                errors.append(
                    'Menu documentation source is missing: ' + expectation['source']
                )
                continue
            source_body = text(source_path)
            for label in expectation['labels']:
                if label not in source_body:
                    errors.append(
                        expectation['name'] + ' source menu label is missing: ' + label
                    )
                if label not in body:
                    errors.append(
                        'Configuration guide omits ' + expectation['name'] +
                        ' menu label: ' + label
                    )
    troubleshooting = docs / 'TROUBLESHOOTING.txt'
    if troubleshooting.exists():
        body = text(troubleshooting)
        if ('8. Factory reset' not in body or '9. Performance and smoothness' not in body or
                '10. Diagnostics to include in a bug report' not in body):
            errors.append('Troubleshooting sections are not in the expected order')
        if re.search(r'\bv\d+\.\d+\.\d+\b', body) or 'Install v' in body:
            errors.append('Troubleshooting contains development-version upgrade advice')
        for phrase in [
            'The DarkOneJSP3 Queue Viewer wrapper must import the component-local',
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
            'darkOneInheritImage(NumImage);',
            'darkOneInheritImage(TimeImage);',
            'darkOneInheritImage(BitrateImage);',
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

    bottom_config = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if bottom_config.exists():
        body = text(bottom_config)
        for token in [
            "'DarkOneJSP3.BottomArea.Query'",
            "'DarkOneJSP3.BottomArea.Set'",
            "'DarkOneJSP3.BottomArea.State'",
            "'DARKONEJSP3.BOTTOM.BACKGROUND.MODE'",
            "'DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR'",
            "'DARKONEJSP3.BOTTOM.DIVIDER.MODE'",
            "'DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR'",
            "'Bottom area background'",
            "'Bottom area side divider colour'",
            "'Transparent / inherit parent'",
            "'Transparent / inherit background'",
            "'Columns UI global background'",
            'if (mode === DARKONE_BOTTOM_MODE_DARKONE) return 0xff202020;',
            'function darkOnePaintBottomAreaBackground(gr)',
            'function darkOneApplyBottomAreaState(state, repaint)',
            'function darkOneInitialiseBottomAreaState(queryPeers)',
            'function darkOneRequestBottomAreaState()',
            'var darkOneBottomAreaInitialised = false;',
            "var DARKONE_RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\\\';",
            "var DARKONE_BOTTOM_AREA_STATE_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';",
            "var DARKONE_BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\\\shared\\\\bottom-area-state.txt';",
            "var DARKONE_RESET_COMMAND_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';",
            'function darkOneWriteResetCommand(scope)',
            'function darkOneResetBottomAreaDefaults()',
            'function darkOneScheduleBottomAreaStateRetry(serialised)',
            "utils.WriteTextFile(path, String(content))",
            "appearance.AppendTo(m, MF_STRING, 'Appearance');",
        ]:
            if token not in body:
                errors.append('JScript bottom-area appearance is missing: ' + token)
        for obsolete in [
            'darkOneBottomAreaStatePollTimer',
            'window.SetInterval(function ()',
            "DARKONE_BOTTOM_AREA_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\\\shared\\\\bottom-area-state.txt'",
        ]:
            if obsolete in body[body.index('// Shared bottom-area appearance.'):body.index('function repeat(')]:
                errors.append('JScript bottom-area bridge retains obsolete polling/source-tree state: ' + obsolete)
        if 'serialised,\n                false' in body:
            errors.append('JScript bottom-area state writer still uses the failed three-argument call')

    bottom_controls = project / 'jsplitter' / '05_bottom_controls.js'
    if bottom_controls.exists():
        body = text(bottom_controls)
        for token in [
            'var DARKONEJSP3_RESET_ROLE = "bottom-controls";',
            'var BOTTOM_AREA_PROTOCOL = DarkOneProtocol.bottomArea;',
            "var BOTTOM_BACKGROUND_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.MODE';",
            "var BOTTOM_DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.DIVIDER.MODE';",
            'function bottomBackgroundColour()',
            'function bottomDividerColour()',
            "var RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\\\';",
            "var BOTTOM_AREA_STATE_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';",
            "var BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\\\shared\\\\bottom-area-state.txt';",
            "var RESET_COMMAND_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';",
            'var RUNTIME_BRIDGE_POLL_INTERVAL = 100;',
            'var RESET_COMMAND_POLL_INTERVAL = 500;',
            'var RESET_COMMAND_POLL_DIVISOR = Math.max(1, Math.round(',
            'function syncBottomAreaStateFile(createIfMissing)',
            'function broadcastBottomAreaState(state)',
            'BOTTOM_AREA_PROTOCOL.notifications.state',
            'function syncResetCommandFile()',
            'function processResetCommand(command)',
            'function acknowledgeResetCommandFile()',
            'runtimeBridgePollTimer = setInterval(function ()',
            'window.NotifyOthers(DARKONEJSP3_RESET_NOTIFICATION, payload)',
            'gr.FillSolidRect(0, 0, ww, wh, bottomBackgroundColour());',
            'DOJSP3.colours.separator',
            'if (state.dividerMode !== BOTTOM_AREA_PROTOCOL.modes.transparent)',
            'var leftDivider = DOJSP3.idiv(ww, 3) - px;',
            'var rightDivider = ww - DOJSP3.idiv(ww, 3) - px;',
            'gr.FillSolidRect(leftDivider, 0, px * 2, wh, dividerColour);',
            'gr.FillSolidRect(rightDivider, 0, px * 2, wh, dividerColour);',
            'function on_colours_changed()',
        ]:
            if token not in body:
                errors.append('Shared bottom-area appearance is missing: ' + token)
        for obsolete in [
            'bottomAreaStateBroadcast',
            'BOTTOM_AREA_PROTOCOL.notifications.query',
            'BOTTOM_AREA_PROTOCOL.notifications.set',
        ]:
            if obsolete in body:
                errors.append('Bottom Controls retains obsolete JSplitter notification plumbing: ' + obsolete)

    protocol_path = project / 'shared' / 'jsplitter_protocols.js'
    if protocol_path.exists():
        protocol_body = text(protocol_path)
        for token in [
            '{ id: baseId + 4, mode: dividerModes.columnsUi,',
            '{ id: baseId + 5, mode: dividerModes.custom, custom: true }',
        ]:
            if token not in protocol_body:
                errors.append('Shared colour-menu ID mapping has drifted: ' + token)

    display_waveform = project / 'jsplitter' / '06_display_waveform.js'
    if display_waveform.exists():
        body = text(display_waveform)
        for token in [
            'var BACKGROUND_CUSTOM = 3;',
            'var BACKGROUND_DARKONE_DARK = 4;',
            'var BACKGROUND_COLUMNS_UI = 5;',
            'var BACKGROUND_AUTOMATIC = 6;',
            'var BACKGROUND_MODES = [',
            "{ id: 106, mode: BACKGROUND_AUTOMATIC, label: 'Automatic - Bottom area background' }",
            "{ id: 104, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' }",
            "{ id: 105, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' }",
            "{ id: 103, mode: BACKGROUND_CUSTOM, custom: true }",
            'if (mode === BACKGROUND_DARKONE_DARK) return DOJSP3.colours.separator;',
            'if (mode === BACKGROUND_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);',
            "var BOTTOM_AREA_STATE_FILE = fb.ProfilePath + 'js_data\\\\darkonejsp3.bottom-area-state.txt';",
            'var sharedBottomAreaState = readBottomAreaStateFile();',
            'function applySharedBottomAreaState(data, repaint)',
            'if (mode === BACKGROUND_AUTOMATIC) return sharedBottomAreaBackgroundColour();',
            'return DOJSP3.colours.separator;',
            'gr.FillSolidRect(0, 0, ww, wh, backgroundColour());',
            'BOTTOM_AREA_PROTOCOL.notifications.state',
            'DarkOneColour.normaliseMode(',
            'DarkOneColour.appendRadioOptions(',
            'DarkOneColour.pickJsplitter(',
            'function on_colours_changed()',
        ]:
            if token not in body:
                errors.append('Waveform background palette is missing: ' + token)
        if 'window.GetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_AUTOMATIC)' not in body:
            errors.append('Waveform Automatic background is not the default for new properties')

    reset_defaults = project / 'shared' / 'reset_defaults.js'
    if reset_defaults.exists() and (
            '"DarkOneJSP3.DisplayWaveform.BackgroundMode": 6' not in
            text(reset_defaults)):
        errors.append(
            'Waveform appearance reset does not restore Automatic background mode'
        )
    if reset_defaults.exists():
        reset_body = text(reset_defaults)
        expected_waveform_reset = '''    "display-waveform": {
        appearance: {
            "DarkOneJSP3.DisplayWaveform.BackgroundColour": 0xff202020,
            "DarkOneJSP3.DisplayWaveform.BackgroundMode": 6
        },
        behaviour: {
            "DarkOneJSP3.DisplayWaveform.HideWhenStopped": true,
            "DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay": 200
        }
    }'''
        if expected_waveform_reset not in reset_body:
            errors.append('Waveform reset defaults do not separate appearance and behaviour correctly')

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

    standalone_colour_entries = [
        samples / 'Last.fm Bio.txt',
        samples / 'Last.fm Artist Info + User Info.txt',
        samples / 'Album Notes.txt',
        samples / 'Properties.txt',
        project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt',
    ]
    for path in standalone_colour_entries:
        if path.exists() and 'samples\\shared\\colour_utils.js' not in text(path):
            errors.append(rel(path) + ' does not import the standalone colour helper')
    display_entry = project / 'jscript' / 'DarkOneJSP3 - Display Panel.txt'
    if display_entry.exists() and 'DarkOneJSP3\\shared\\colour_utils.js' not in text(display_entry):
        errors.append(rel(display_entry) + ' does not import the project colour-helper mirror')

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

    volume_knob = project / 'jscript' / 'js' / 'Object_Volumeknob.js'
    if volume_knob.exists():
        body = text(volume_knob)
        for token in [
            'getDelay: function() { return darkOneGetVolumeWriteInterval(); }',
            'DarkOnePerformance.createRepaintScheduler(window, {',
            'this.preview_volume = v;',
            'preview_repaint.request();',
            'Volume drag refresh rate',
            'DarkOneUiCadence.volumeModeForMenuId(q)',
            'volume_writer.reschedule();',
            'preview_repaint.reschedule();',
        ]:
            if token not in body:
                errors.append('Adaptive volume-knob cadence is missing: ' + token)

    control_right_panel = project / 'jscript' / 'js' / 'Panel_Control_Right.js'
    if control_right_panel.exists():
        body = text(control_right_panel)
        for token in [
            'DarkOneUiCadence.createVolumeOwner(window, {',
            'DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE',
            'getDelay: darkOneGetVolumeDragInterval',
            'function darkOneGetVolumeWriteInterval()',
            'return Math.max(16, darkOneGetVolumeDragInterval());',
            'if (!v_drag) volume_knob_repaint.request();',
            'darkOneVolumeCadenceOwner.handleNotification(name, info)',
        ]:
            if token not in body:
                errors.append('Control Right volume-cadence ownership is missing: ' + token)

    display_system_path = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_system_path.exists():
        body = text(display_system_path)
        for token in [
            'DarkOneUiCadence.createVolumeFollower(window, {',
            'getDelay: function() { return darkOneDisplayVolumeCadence.getInterval(); }',
            'this.onVolumeCadenceChanged = function()',
        ]:
            if token not in body:
                errors.append('Display volume-cadence follower is missing: ' + token)

    control_entries = {
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Left.txt': '3.0.20-jsp3-3.8.5',
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Right.txt': '3.0.25-jsp3-3.8.5',
    }
    for path, expected_version in control_entries.items():
        if not path.exists():
            continue
        body = text(path)
        if 'DarkOneJSP3\\jscript\\js\\Buttons_OptionalMenu.js' not in body:
            errors.append(rel(path) + ' does not import the shared optional-button menu')
        if '@version "' + expected_version + '"' not in body:
            errors.append(rel(path) + ' has the wrong consolidated control-panel version')

    control_panels = [
        project / 'jscript' / 'js' / 'Panel_Control_Left.js',
        project / 'jscript' / 'js' / 'Panel_Control_Right.js',
    ]
    for path in control_panels:
        if not path.exists():
            continue
        body = text(path)
        if 'safeBitmapImage(imgPath + "buttons.png")' not in body or 'gr.DrawBitmap(g_btns,' not in body:
            errors.append(rel(path) + ' does not use a cached Direct2D button bitmap')
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

    volume_knob = project / 'jscript' / 'js' / 'Object_Volumeknob.js'
    if volume_knob.exists():
        body = text(volume_knob)
        for token in [
            'getDelay: function() { return darkOneGetVolumeWriteInterval(); }',
            'DarkOnePerformance.createRepaintScheduler(window, {',
            'preview_repaint.request()',
            'this.preview_volume = v',
            'Volume drag refresh rate',
            'DarkOnePerformance.createValueCoalescer',
            'volume_writer.request(v)',
            'volume_writer.flush()',
            'volume_writer.cancel()',
            'v_drag ? this.active_colour : this.inactive_colour',
            'if (v_drag) {',
            'this.Repaint();',
        ]:
            if token not in body:
                errors.append('Volume knob drag coalescing is missing: ' + token)
        if 'if (fb.Volume != v) fb.Volume = v' in body:
            errors.append('Volume knob still writes every raw mouse-move value directly')
        if 'preview_repaint.stop()' in body:
            errors.append('Volume knob calls unsupported repaint-scheduler stop(); use cancel()')
        if 'v_change ? this.active_colour' in body:
            errors.append('Volume knob still uses the trailing volume-change state as its pressed highlight')
        for token in ['preview_repaint.cancel()', 'volume_writer.cancel()']:
            if token not in body:
                errors.append('Volume knob cleanup is missing: ' + token)

    right_control = project / 'jscript' / 'js' / 'Panel_Control_Right.js'
    if right_control.exists():
        body = text(right_control)
        for token in [
            'DarkOnePerformance.createRepaintScheduler',
            'if (!v_drag) volume_knob_repaint.request()',
        ]:
            if token not in body:
                errors.append('Control Right volume update coalescing is missing: ' + token)
        if 'v_timer = clearPanelTimer(v_timer)' in body:
            errors.append('Control Right still recreates its three-second volume timer for every callback')
        for forbidden in ['volume_change_deadline', 'v_change = true']:
            if forbidden in body:
                errors.append('Control Right still retains a delayed knob-selection state: ' + forbidden)

    display_system_source = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_system_source.exists():
        body = text(display_system_source)
        for token in [
            'DarkOnePerformance.createRepaintScheduler',
            'DarkOnePerformance.createTrailingDeadline',
            'this.drawVolumeMatrix = function(gr, volume)',
            'this.drawVolumeMatrix(gr, fb.Volume.toFixed(2) + " db")',
        ]:
            if token not in body:
                errors.append('Display volume rendering optimisation is missing: ' + token)
        for forbidden in ['new VolumeImage()', 'this.images[4]', 'function VolumeImage()']:
            if forbidden in body:
                errors.append('Display still rebuilds an off-screen volume bitmap while dragging: ' + forbidden)

    ctx.version = version
    ctx.build = build
    ctx.manifest = manifest if "manifest" in locals() else {}
