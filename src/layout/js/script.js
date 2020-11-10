const toggle = (target) => {
  let view = document.getElementsByClassName("view")[0];
  if (view) {
    view.classList.remove("view");
    view.classList.add("hidden");
  }
  document.getElementById(target).classList.remove("hidden");
  document.getElementById(target).classList.add("view");
};
const change = (ele, target) => {
  let views = document.getElementsByClassName("tab");
  for (let view of views) view.style.display = "none";

  let tabs = document.getElementsByClassName("tab-item");
  for (let tab of tabs) tab.classList.remove("active");

  document.getElementsByClassName(target)[0].style.display = "block";
  ele.classList.add("active");
};

function move(width) {
  var elem = document.getElementById("progressBar");
  elem.classList.add("w3-blue");
  elem.classList.remove("w3-light-grey");
  // console.log(width);
  if (width >= 100) {
    elem.style.width = Math.min(100, width) + "%";
    document.getElementById("progressBar").innerHTML =
      "Successfully Downloaded Torrent!";
  } else {
    elem.style.width = width + "%";
  }
}

toggle("root");
