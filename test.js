class def {
	constructor() {

	}
	disp() {
		console.log(def.prototype.check)

	}
}
class abc extends def {
	constructor(a) {
		super(a)
		abc.prototype.d = 45;
		this.a = a;
		def.prototype.check = a;
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
a.disp()
b.disp()
// a.modify()
// console.log(a.d)
// console.log(b.d)