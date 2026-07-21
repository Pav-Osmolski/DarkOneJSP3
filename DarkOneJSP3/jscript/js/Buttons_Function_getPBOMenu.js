// =========================================================================================================
// Playback Order Menu Function - v2.0build20191006-jscript-panel3-opt1
// =========================================================================================================

function getPBOMenu(x, y) {
	x = x == null ? this.left : x;
	y = y == null ? this.top : y;

	var a = window.CreatePopupMenu();
	var idx;

	var b = "Default;Repeat (playlist);Repeat (track);Random;Shuffle (tracks);Shuffle (albums);Shuffle (folders)".split(";");
	for (var i = 0; i < 7; i++) a.AppendMenuItem(0, 1 + i, b[i]);
	a.CheckMenuRadioItem(1, 7, plman.PlaybackOrder + 1);

	idx = a.TrackPopupMenu(x, y);
	if (idx >= 1 && idx <= 7) plman.PlaybackOrder = idx - 1;

	a.Dispose();
}