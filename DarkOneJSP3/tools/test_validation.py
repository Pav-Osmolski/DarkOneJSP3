#!/usr/bin/env python3
"""Offline mutation tests for the release validator (never edits the input tree)."""
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

sys.dont_write_bytecode = True
from validation.context import ValidationContext
from validation import manifest_checks, inventory_checks
from validation.markdown_checks import check_pages
from build_release import package, validate_archive

ROOT = Path(__file__).resolve().parents[2]


class ValidationRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='darkone-validation-test-')
        self.addCleanup(self.temp.cleanup)
        self.scratch = Path(self.temp.name)

    def mutated_release(self, relative, change, expected):
        root = Path(tempfile.mkdtemp(dir=self.scratch)) / 'release'
        shutil.copytree(ROOT, root)
        path = root / relative
        path.write_text(change(path.read_text(encoding='utf-8-sig')), encoding='utf-8')
        result = subprocess.run([sys.executable, '-B', str(root / 'DarkOneJSP3/tools/validate_release.py'), str(root)],
                                capture_output=True, text=True, timeout=90)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(expected, result.stdout, result.stdout + result.stderr)
        self.assertNotIn('Traceback', result.stderr)

    def test_nested_sample_syntax(self):
        self.mutated_release('user-components-x64/foo_jscript_panel3/samples/basic/Timer.txt',
                             lambda body: body + '\nfunction invalid( {\n', 'syntax failed')

    def test_waveform_real_geometry(self):
        self.mutated_release('DarkOneJSP3/jsplitter/06_display_waveform.js',
                             lambda body: body.replace('half + waveformVerticalInset(lowerHeight)',
                                                       'half + 20 /* half + waveformVerticalInset(lowerHeight) */'),
                             'Waveform layout geometry differs')

    def test_missing_fade_disposal(self):
        self.mutated_release('user-components-x64/foo_jscript_panel3/samples/js/common.js',
                             lambda body: body.replace('_scroll_fade_surface.Dispose();', 'void 0;'),
                             'Fade replacement retained obsolete native images')

    def test_manifest_exact_contract(self):
        build = json.loads((ROOT / 'DarkOneJSP3/build-info.json').read_text())
        original = json.loads((ROOT / 'DarkOneJSP3/darkonejsp3-layout-manifest.json').read_text())
        for mutate in (
            lambda value: value['jsplitters'][0].update(title='WRONG.Root'),
            lambda value: value['panels'][1].update(title='WRONG.LastfmBio'),
            lambda value: value['panels'][9].pop('version'),
            lambda value: value['panels'][0].update(note='unexpected'),
        ):
            manifest = json.loads(json.dumps(original))
            mutate(manifest)
            ctx = ValidationContext(ROOT)
            manifest_checks.run(ctx, manifest, build, build['version'])
            self.assertTrue(ctx.errors)

    def test_json_top_level_types(self):
        for value in ([], 'wrong', None, 42):
            ctx = ValidationContext(ROOT)
            manifest_checks.run(ctx, value, {}, '1.1.3')
            self.assertTrue(ctx.errors)
        self.mutated_release('DarkOneJSP3/build-info.json', lambda _: '[]', 'top-level value must be an object')
        self.mutated_release('DarkOneJSP3/darkonejsp3-layout-manifest.json', lambda _: '[]', 'must be JSON objects')

    def test_unexpected_inventory_file(self):
        root = self.scratch / 'release'
        shutil.copytree(ROOT, root)
        (root / 'debug.log').write_text('not a release file')
        ctx = ValidationContext(root)
        inventory_checks.run(ctx)
        self.assertIn('Unexpected release file: debug.log', ctx.errors)

    def test_required_file_not_directory(self):
        ctx = ValidationContext(self.scratch)
        ctx.require(self.scratch)
        self.assertTrue(ctx.errors)

    def test_markdown_regressions(self):
        for body, expected in (
            ('# Migration\n\nPanel Stack Splitter 01\n', 'hierarchy must be in a text fence'),
            ('# Requirements\n\n- Columns UI (https://example.test)\n', 'descriptive component link'),
            ('# Test\n\n[Missing](Absent)\n', 'missing local link target'),
            ('# Test\n\n```text\nopen\n', 'unclosed code fence'),
        ):
            path = self.scratch / 'Test.md'
            path.write_text(body)
            errors = []
            check_pages([path], self.scratch, errors, wiki=True)
            self.assertTrue(any(expected in error for error in errors), errors)

    def test_harness_cleans_leaked_timer(self):
        bundle = self.scratch / 'timer.js'
        bundle.write_text("suite('timer', function () { setInterval(function () {}, 1000); });")
        result = subprocess.run(['node', str(ROOT / 'DarkOneJSP3/tools/validation/js/harness.js'),
                                 str(ROOT), str(bundle), '1000', '1'], capture_output=True, timeout=3)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_harness_failure_json_survives_console_output(self):
        bundle = self.scratch / 'failure.js'
        bundle.write_text("suite('failure', function () { console.log('noise'); throw new Error('expected'); });")
        result = subprocess.run(['node', str(ROOT / 'DarkOneJSP3/tools/validation/js/harness.js'),
                                 str(ROOT), str(bundle), '1000', '1'], capture_output=True, timeout=3)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)[0]['name'], 'failure')

    def test_archive_reproducibility_and_member_rejection(self):
        source = self.scratch / 'source'
        source.mkdir()
        (source / 'test.txt').write_text('test')
        first, second = self.scratch / 'one.zip', self.scratch / 'two.zip'
        package(source, first)
        package(source, second)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        for name in ('../escape.txt', '/absolute.txt', 'test.txt', 'TEST.txt'):
            package(source, first)
            with zipfile.ZipFile(first, 'a') as archive:
                archive.writestr(name, 'extra')
            with self.assertRaises(ValueError):
                validate_archive(first, source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
