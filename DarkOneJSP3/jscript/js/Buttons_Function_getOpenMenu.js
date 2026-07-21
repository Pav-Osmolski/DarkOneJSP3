// =========================================================================================================
// Open Menu Function - v2.0build20191006-jscript-panel3-opt1
// =========================================================================================================

function getOpenMenu(x, y) {
	x = x == null ? this.left : x;
	y = y == null ? this.top : y;
	var a = window.CreatePopupMenu();

	a.AppendMenuItem(0, 1, "Open...");
	a.AppendMenuItem(0, 2, "Open audio CD...");
	a.AppendMenuSeparator();
	a.AppendMenuItem(0, 3, "Add files...");
	a.AppendMenuItem(0, 4, "Add folders...");
	a.AppendMenuItem(0, 5, "Add location...");

	switch (a.TrackPopupMenu(x, y)) {
		case 1:
			fb.RunMainMenuCommand("File/Open...");
			break;

		case 2:
			fb.RunMainMenuCommand("File/Open audio CD...");
			break;

		case 3:
			fb.AddFiles();
			break;

		case 4:
			fb.AddDirectory();
			break;

		case 5:
			fb.RunMainMenuCommand("File/Add Location...");
			break;
	}

	a.Dispose();
}