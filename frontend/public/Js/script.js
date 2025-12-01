let btns = document.querySelectorAll(".features-details");

btns.forEach((btn) => {
  btn.addEventListener("click", () => {
    let ans = btn.nextElementSibling;
    let cross = btn.querySelector(".cross");
    let icon = btn.querySelector(".icon"); 

    if (btn.classList.contains("active")) {
      btn.classList.remove("active");
      ans.style.display = "none";
      cross.style.display = "none";
      icon.style.display = "block";
    } else {
      btn.classList.add("active");
      ans.style.display = "block";
      cross.style.display = "block";
      icon.style.display = "none";

      btns.forEach((otherBtn) => {
        if (otherBtn !== btn) {
          otherBtn.classList.remove("active");
          otherBtn.nextElementSibling.style.display = "none";

          // Hide other buttons' .cross and show .icon
          let otherCross = otherBtn.querySelector(".cross");
          let otherIcon = otherBtn.querySelector(".icon");

          if (otherCross) otherCross.style.display = "none";
          if (otherIcon) otherIcon.style.display = "block";
        }
      });
    }
  });
});
