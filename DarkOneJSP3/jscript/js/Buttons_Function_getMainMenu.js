// =========================================================================================================
// Main Menu Function - v2.0build20191002-jscript-panel3-opt1
// =========================================================================================================

function getMainMenu(x, y) {
	x = x == null ? this.left : x;
	y = y == null ? this.top : y;

	var a = {}, b = {}, c = "File;Edit;View;Playback;Library;Help".split(";");

	a[0] = window.CreatePopupMenu();
	for (var i = 1; i < 7; i++) a[i] = fb.CreateMainMenuManager(c[i - 1]);
	a[7] = fb.CreateContextMenuManager();
	for (var j = 0; j < 7; j++) b[j] = window.CreatePopupMenu();

	for (var k = 0; k < 6; k++) b[k].AppendTo(a[0], 16, c[k]);
	for (var m = 1; m < 7; m++) a[m].BuildMenu(b[m - 1], m * 1000);
	
	if (fb.IsPlaying) {
		a[0].AppendMenuSeparator();
		a[7].InitNowPlaying();
		a[7].BuildMenu(b[6], 7000);
		b[6].AppendTo(a[0], 16, "Now Playing");
	}

	var idx = a[0].TrackPopupMenu(x, y);

	switch (true) {
		case idx == 0:
			break;

		case (idx >= 1000 && idx < 8000):
			var d = Math.floor(idx / 1000);
			a[d].ExecuteByID(idx - d * 1000);
			break;
	}
	
	for (var n = 0; n < 8; n++) a[n].Dispose();
}