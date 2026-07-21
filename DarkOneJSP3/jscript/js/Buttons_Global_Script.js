// =========================================================================================================
// Global Button Script - v2.0build20191006-jscript-panel3-opt1
// =========================================================================================================

var ButtonStates = {normal: 0, hover: 1, down: 2, hide: 3}, Buttons = {}, btn_down = false, cur_btn = null, btn_tooltip;

function buttonsDraw(gr) {
	for (var i in Buttons) if (Buttons.hasOwnProperty(i)) Buttons[i].draw(gr);
}

function buttonsTraceMouse(x, y) {
	var btn = null, i;
	for (i in Buttons) if (Buttons.hasOwnProperty(i)) Buttons[i].traceMouse(x, y) && !btn && (btn = Buttons[i]);
	return btn;
}

function buttonsMouseMove(x, y) {
	cur_btn = buttonsTraceMouse(x, y);
}

function buttonsMouseLbtnDown(x, y) {
	btn_down = cur_btn;
	cur_btn && cur_btn.changeState(ButtonStates.down);
}

function buttonsMouseLbtnUp(x, y) {
	cur_btn && (cur_btn.changeState(ButtonStates.hover), btn_down == cur_btn && cur_btn.onClick(x, y));
	btn_down = false;
}

function buttonsMouseLeave() {
	cur_btn && cur_btn.changeState(ButtonStates.normal);
	cur_btn = null;
	btn_down = false;
}

function buttonsUnload() {
	buttonsMouseLeave();
	Buttons = {};
	btn_font = null;
}
