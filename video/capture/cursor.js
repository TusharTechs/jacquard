// Init script for the capture: the screencast has no mouse pointer, so a small walnut arrow follows
// the mouse (pointer-events none, above everything). A recording aid only; not part of the app.
(() => {
  const add = () => {
    if (document.getElementById("__capture-cursor")) return;
    const cursor = document.createElement("div");
    cursor.id = "__capture-cursor";
    cursor.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2 L4 22 L9.5 17 L13 25 L16.5 23.5 L13 15.8 L20.5 15.8 Z" fill="#5b3a24" stroke="#fffaf0" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(cursor.style, { position: "fixed", left: "-40px", top: "-40px", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-3px, -2px)", transition: "transform 80ms" });
    document.documentElement.append(cursor);
    addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    }, true);
    addEventListener("mousedown", () => (cursor.style.transform = "translate(-3px, -2px) scale(0.85)"), true);
    addEventListener("mouseup", () => (cursor.style.transform = "translate(-3px, -2px)"), true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add);
  else add();
})();
