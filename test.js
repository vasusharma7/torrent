let i = 1;
const x = setInterval(() => {
  console.log(i++);
  if (i == 10) clearInterval(x);
}, 100);
