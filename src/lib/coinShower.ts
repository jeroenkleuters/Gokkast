// Muntenregen bij winst: losse elementen die na hun animatie verdwijnen.

export function coinShower(container: HTMLElement) {
  for (let n = 0; n < 60; n++) {
    const c = document.createElement("div");
    c.className = "coin";
    c.style.left = 220 + Math.random() * 580 + "px";
    c.style.top = "-30px";
    container.appendChild(c);
    const dx = (Math.random() - 0.5) * 200;
    const dur = 1400 + Math.random() * 1400;
    c.animate(
      [
        { transform: "translate(0,0) rotateY(0deg)" },
        { transform: `translate(${dx}px, 820px) rotateY(${720 + Math.random() * 720}deg)` },
      ],
      { duration: dur, delay: Math.random() * 900, easing: "cubic-bezier(.4,0,.9,.6)", fill: "both" },
    ).onfinish = () => c.remove();
  }
}
