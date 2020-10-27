class A {
  constructor(params) {
    this.name = params;
  }

  static get() {
    if (global.config.debug) console.log("object", this.name);
  }
}
A.prototype.get();
