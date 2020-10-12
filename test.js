class def {
	disp() {
		console.log(this.check[0])

	}
}
class abc extends def {
	constructor(a) {
		super(a)
		// abc.prototype.d = 45;
		this.a = a;
		this.check[0] = a;
	}
	print() {
		console.log(this.a)
	}
	modify() {
		abc.prototype.d = 46;
	}
}
def.prototype.check = [0];
let a = new abc(6);
a.disp()
let b = new abc(9);
a.disp()
b.disp()
// a.modify()
// console.log(a.d)
// console.log(b.d)

let d = [1, 3, 5].map(i => { return i - 1 })
console.log(d)