function _volume(x, y, w, h) {
	this.containsXY = function (x, y) {
		var m = this.drag ? 200 : 0;
		return x > this.x - m && x < this.x + this.w + (m * 2) && y > this.y - m && y < this.y + this.h + (m * 2);
	}

	this.lbtn_down = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		this.drag = true;
		return true;
	}

	this.lbtn_up = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		if (this.drag) {
			this.drag = false;
			fb.Volume = this.drag_vol;
		}

		return true;
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;

		if (this.containsXY(x, y)) {
			if (fb.CustomVolume == -1) {
				x -= this.x;
				var pos = x < 0 ? 0 : x > this.w ? 1 : x / this.w;
				this.drag_vol = pos2vol(pos);
				_tt(this.drag_vol.toFixed(2) + ' dB');
				if (this.drag) {
					fb.Volume = this.drag_vol;
				}
			} else {
				_tt('The current output device does not support a volume slider');
			}

			this.hover = true;
			return true;
		}

		if (this.hover) {
			_tt('');
		}

		this.hover = false;
		this.drag = false;
		return false;
	}

	this.pos = function () {
		return this.w * vol2pos(fb.Volume);
	}

	this.volume_change = function () {
		window.RepaintRect(this.x, this.y, this.w, this.h);
	}

	this.wheel = function (s) {
		if (!this.containsXY(this.mx, this.my))
			return false;

		if (s == 1) {
			fb.VolumeUp();
		} else {
			fb.VolumeDown();
		}

		return true;
	}

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.mx = 0;
	this.my = 0;
	this.hover = false;
	this.drag = false;
	this.drag_vol = 0;
}
