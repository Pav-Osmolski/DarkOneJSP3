function oTopBar() {
	this.setSize = function (x, y, w, h) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.visible = (h > 0);
		this.setButtons();
	}

	this.setDatas = function () {
		if (g_active_playlist == -1) {
			this.line1 = "No playlist.";
			this.line2 = "";
		} else {
			this.line1 = plman.GetPlaylistName(g_active_playlist);

			var item_count = plman.GetPlaylistItemCount(g_active_playlist);
			if (item_count == 1) this.line2 = "1 track.";
			else this.line2 = item_count + " tracks.";

			if (p.list) this.line2 += " " + utils.FormatDuration(plman.GetPlaylistItems(g_active_playlist).CalcTotalDuration()) + ".";
		}
	}

	this.setButtons = function () {
		var close_off = utils.CreateImage(12, 12);
		var gb = close_off.GetGraphics();
		gb.WriteTextSimple(chars.close, g_font_fluent_12, blendColours(g_colour_background, g_colour_text, 0.75), 0, 0, 12, 12, 2, 2);
		close_off.ReleaseGraphics();

		this.button = new button(close_off, close_off, close_off);
	}

	this.draw = function (gr) {
		if (this.visible) {
			gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_background);
			gr.DrawImage(this.logo, this.x, this.y, this.h, this.h, 0, 0, this.logo.Width, this.logo.Height);
			gr.WriteTextSimple(this.line1, g_font_20_bold, g_colour_text, this.x + this.h, this.y + 2, this.w - this.h - 20, height(g_font_20_bold), DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
			gr.WriteTextSimple(this.line2, g_font_12_bold, setAlpha(g_colour_text, 180), this.x + this.h, this.y + 2 + height(g_font_20_bold), this.w - this.h - 20, height(g_font_12_bold), DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
			this.button.draw(gr, this.x + this.w - 16, this.y + 4);
		}
	}

	this.buttonCheck = function (event, x, y) {
		var state = this.button.checkstate(event, x, y);
		switch (event) {
		case "lbtn_down":
			if (state == ButtonStates.down) {
				this.buttonClicked = true;
			}
			break;
		case "lbtn_up":
			if (this.buttonClicked && state == ButtonStates.hover) {
				// action
				cTopBar.visible = false;
				window.SetProperty("JSPLAYLIST.TopBar.Visible", cTopBar.visible);
				resize_panels();
				full_repaint();
			}
			break;
		}
		return state;
	}

	this.line1 = "";
	this.line2 = "";
	this.logo = utils.LoadImage(fb.ComponentPath + "samples\\images\\foobar2000.png");
	this.setDatas();
}
