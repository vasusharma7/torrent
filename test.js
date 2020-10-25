class A {
  constructor(params) {
    this.name = params;
  }

  static get() {
    console.log("object", this.name);
  }
}
A.prototype.get();
