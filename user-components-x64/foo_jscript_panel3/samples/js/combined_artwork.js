"use strict";

var COMBINED_ARTWORK_VERSION = '0.1.0';

var COMBINED_ARTWORK_DISPLAY_MENU_ID = 1700;
var COMBINED_ARTWORK_BACKGROUND_MENU_ID = 1710;
var COMBINED_ARTWORK_BACKGROUND_BLUR_MENU_ID = 1711;
var COMBINED_ARTWORK_BACKGROUND_LIGHT_MENU_ID = 1712;
var COMBINED_ARTWORK_BACKGROUND_MEDIUM_MENU_ID = 1713;
var COMBINED_ARTWORK_BACKGROUND_DARK_MENU_ID = 1714;
var COMBINED_ARTWORK_BORDER_NONE_MENU_ID = 1720;
var COMBINED_ARTWORK_BORDER_SOLID_MENU_ID = 1721;
var COMBINED_ARTWORK_BORDER_SUNKEN_MENU_ID = 1722;
var COMBINED_ARTWORK_BORDER_DEFAULT_MENU_ID = 1723;
var COMBINED_ARTWORK_BORDER_CUSTOM_MENU_ID = 1724;
var COMBINED_ARTWORK_BORDER_PICKER_MENU_ID = 1725;

function _combined_artwork(property_prefix, display_label, callbacks) {
	callbacks = callbacks || {};
	property_prefix = String(property_prefix || '2K3.COMBINED.ARTWORK');
	display_label = String(display_label || 'Display image');

	this.displayed = function () {
		return this.properties.display.enabled;
	}

	this.wants_artwork = function () {
		return this.displayed() || this.properties.background.enabled;
	}

	this.wants_blur = function () {
		return this.properties.background.enabled && this.properties.background_blur.enabled;
	}

	this.darkness_alpha = function () {
		return [120, 180, 220][_clamp(Math.round(Number(this.properties.background_darkness.value) || 0), 0, 2)];
	}

	this.border_colour = function () {
		return this.properties.border_colour_mode.value == 1
			? DarkOneColour.opaque(this.properties.border_custom.value)
			: RGB(150, 150, 150);
	}

	this.fill_ring = function (gr, rect, inset, thickness, colour) {
		var x = Math.round(rect[0]) + inset;
		var y = Math.round(rect[1]) + inset;
		var w = Math.max(0, Math.round(rect[2]) - (inset * 2));
		var h = Math.max(0, Math.round(rect[3]) - (inset * 2));
		thickness = Math.max(1, Math.round(thickness));
		if (w <= 0 || h <= 0)
			return;

		var horizontal = Math.min(thickness, h);
		var vertical = Math.min(thickness, w);
		gr.FillRectangle(x, y, w, horizontal, colour);
		if (h > horizontal)
			gr.FillRectangle(x, y + h - horizontal, w, horizontal, colour);

		var side_y = y + horizontal;
		var side_h = Math.max(0, h - (horizontal * 2));
		if (side_h <= 0)
			return;

		gr.FillRectangle(x, side_y, vertical, side_h, colour);
		if (w > vertical)
			gr.FillRectangle(x + w - vertical, side_y, vertical, side_h, colour);
	}

	this.paint_border = function (gr, rect) {
		if (!rect || rect.length < 4 || this.properties.border_style.value == 0)
			return;

		var colour = this.border_colour();
		if (this.properties.border_style.value == 1) {
			this.fill_ring(gr, rect, 0, 2, colour);
			return;
		}

		this.fill_ring(gr, rect, 0, 1, colour);
		this.fill_ring(gr, rect, 1, 1, DarkOneColour.scaleBrightness(colour, 0.3));
	}

	this.paint_background = function (gr, normal, blur, ensure_blur) {
		if (!this.properties.background.enabled || !normal)
			return false;

		if (this.properties.background_blur.enabled && typeof ensure_blur == 'function')
			ensure_blur();

		var source = this.properties.background_blur.enabled && blur ? blur : normal;
		_drawImage(gr, source, 0, 0, panel.w, panel.h, image.crop);
		_drawOverlay(gr, 0, 0, panel.w, panel.h, this.darkness_alpha());
		return true;
	}

	this.append_menu = function (menu) {
		menu.AppendMenuItem(CheckMenuIf(this.properties.display.enabled), COMBINED_ARTWORK_DISPLAY_MENU_ID, display_label);

		var background_menu = window.CreatePopupMenu();
		background_menu.AppendMenuItem(CheckMenuIf(this.properties.background.enabled), COMBINED_ARTWORK_BACKGROUND_MENU_ID, 'Use displayed image as background');
		background_menu.AppendMenuItem(GetMenuFlags(this.properties.background.enabled, this.properties.background_blur.enabled), COMBINED_ARTWORK_BACKGROUND_BLUR_MENU_ID, 'Blur image background');
		background_menu.AppendMenuSeparator();
		background_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BACKGROUND_LIGHT_MENU_ID, 'Light');
		background_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BACKGROUND_MEDIUM_MENU_ID, 'Medium');
		background_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BACKGROUND_DARK_MENU_ID, 'Dark');
		background_menu.CheckMenuRadioItem(
			COMBINED_ARTWORK_BACKGROUND_LIGHT_MENU_ID,
			COMBINED_ARTWORK_BACKGROUND_DARK_MENU_ID,
			COMBINED_ARTWORK_BACKGROUND_LIGHT_MENU_ID + this.properties.background_darkness.value
		);
		background_menu.AppendTo(menu, MF_STRING, 'Image background');

		var border_menu = window.CreatePopupMenu();
		border_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BORDER_NONE_MENU_ID, 'None');
		border_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BORDER_SOLID_MENU_ID, 'Solid');
		border_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BORDER_SUNKEN_MENU_ID, 'Sunken');
		border_menu.CheckMenuRadioItem(
			COMBINED_ARTWORK_BORDER_NONE_MENU_ID,
			COMBINED_ARTWORK_BORDER_SUNKEN_MENU_ID,
			COMBINED_ARTWORK_BORDER_NONE_MENU_ID + this.properties.border_style.value
		);
		border_menu.AppendMenuSeparator();
		border_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BORDER_DEFAULT_MENU_ID, 'Default colour');
		border_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BORDER_CUSTOM_MENU_ID, 'Custom colour');
		border_menu.CheckMenuRadioItem(
			COMBINED_ARTWORK_BORDER_DEFAULT_MENU_ID,
			COMBINED_ARTWORK_BORDER_CUSTOM_MENU_ID,
			COMBINED_ARTWORK_BORDER_DEFAULT_MENU_ID + this.properties.border_colour_mode.value
		);
		border_menu.AppendMenuSeparator();
		border_menu.AppendMenuItem(MF_STRING, COMBINED_ARTWORK_BORDER_PICKER_MENU_ID, 'Set custom colour...');
		border_menu.AppendTo(menu, MF_STRING, 'Image border');
		menu.AppendMenuSeparator();
	}

	this.invoke = function (name) {
		if (typeof callbacks[name] == 'function')
			callbacks[name]();
	}

	this.handle_menu = function (idx) {
		switch (idx) {
		case COMBINED_ARTWORK_DISPLAY_MENU_ID:
			this.properties.display.toggle();
			this.invoke('layout_changed');
			window.Repaint();
			return true;
		case COMBINED_ARTWORK_BACKGROUND_MENU_ID:
			this.properties.background.toggle();
			this.invoke('background_changed');
			window.Repaint();
			return true;
		case COMBINED_ARTWORK_BACKGROUND_BLUR_MENU_ID:
			if (!this.properties.background.enabled)
				return true;
			this.properties.background_blur.toggle();
			this.invoke('background_changed');
			window.Repaint();
			return true;
		case COMBINED_ARTWORK_BACKGROUND_LIGHT_MENU_ID:
		case COMBINED_ARTWORK_BACKGROUND_MEDIUM_MENU_ID:
		case COMBINED_ARTWORK_BACKGROUND_DARK_MENU_ID:
			this.properties.background_darkness.value = idx - COMBINED_ARTWORK_BACKGROUND_LIGHT_MENU_ID;
			window.Repaint();
			return true;
		case COMBINED_ARTWORK_BORDER_NONE_MENU_ID:
		case COMBINED_ARTWORK_BORDER_SOLID_MENU_ID:
		case COMBINED_ARTWORK_BORDER_SUNKEN_MENU_ID:
			this.properties.border_style.value = idx - COMBINED_ARTWORK_BORDER_NONE_MENU_ID;
			window.Repaint();
			return true;
		case COMBINED_ARTWORK_BORDER_DEFAULT_MENU_ID:
		case COMBINED_ARTWORK_BORDER_CUSTOM_MENU_ID:
			this.properties.border_colour_mode.value = idx - COMBINED_ARTWORK_BORDER_DEFAULT_MENU_ID;
			window.Repaint();
			return true;
		case COMBINED_ARTWORK_BORDER_PICKER_MENU_ID:
			var chosen = DarkOneColour.pickJscript(
				this.properties.border_custom.value,
				window.Name,
				'Enter an image-border colour as #RRGGBB or R,G,B.'
			);
			if (chosen === null)
				return true;
			this.properties.border_custom.value = chosen;
			this.properties.border_colour_mode.value = 1;
			window.Repaint();
			return true;
		default:
			return false;
		}
	}

	this.properties = {
		display : new _p(property_prefix + '.DISPLAY', true),
		background : new _p(property_prefix + '.BACKGROUND.ENABLED', true),
		background_blur : new _p(property_prefix + '.BACKGROUND.BLURRED', true),
		background_darkness : new _p(property_prefix + '.BACKGROUND.DARKNESS', 1),
		border_style : new _p(property_prefix + '.BORDER.STYLE', 1),
		border_colour_mode : new _p(property_prefix + '.BORDER.COLOUR.MODE', 0),
		border_custom : new _p(property_prefix + '.BORDER.COLOUR.CUSTOM', RGB(150, 150, 150)),
	};
	var darkness = _clamp(Math.round(Number(this.properties.background_darkness.value) || 0), 0, 2);
	var border_style = _clamp(Math.round(Number(this.properties.border_style.value) || 0), 0, 2);
	var border_colour_mode = this.properties.border_colour_mode.value == 1 ? 1 : 0;
	if (darkness != this.properties.background_darkness.value) this.properties.background_darkness.value = darkness;
	if (border_style != this.properties.border_style.value) this.properties.border_style.value = border_style;
	if (border_colour_mode != this.properties.border_colour_mode.value) this.properties.border_colour_mode.value = border_colour_mode;
}
