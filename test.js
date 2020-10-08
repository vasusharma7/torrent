class abc {
	constructor(a) {
		abc.prototype.d = 45;
		this.a = a;
	}
	print() {
		console.log(this.a)
	}
	modify() {
		abc.prototype.d = 46;
	}
}

let a = new abc(6);
let b = new abc(9);
a.print()
b.print()
a.modify()
console.log(a.d)
console.log(b.d)