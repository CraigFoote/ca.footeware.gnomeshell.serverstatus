'use strict';

export class Status {

	static Init = Symbol("init")
	static Up = Symbol("up")
	static Down = Symbol("down")
	static Bad = Symbol("bad")

	constructor(name) {
		this.name = name;
	}
}