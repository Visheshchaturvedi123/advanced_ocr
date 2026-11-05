const shadeTop = document.getElementById('shade-top');
const shadeBottom = document.getElementById('shade-bottom');
const shadeLeft = document.getElementById('shade-left');
const shadeRight = document.getElementById('shade-right');
const selection = document.getElementById('selection');
const sizeLabel = document.getElementById('size');
const hint = document.getElementById('hint');
const title = hint.querySelector('.title');
const sub = hint.querySelector('.sub');

let start = null;
let current = null;
let locked = false;

function normalize(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function paint(rect) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  shadeTop.style.cssText = `left:0;top:0;width:${width}px;height:${rect.y}px`;
  shadeBottom.style.cssText = `left:0;top:${bottom}px;width:${width}px;height:${Math.max(0, height - bottom)}px`;
  shadeLeft.style.cssText = `left:0;top:${rect.y}px;width:${rect.x}px;height:${rect.height}px`;
  shadeRight.style.cssText = `left:${right}px;top:${rect.y}px;width:${Math.max(0, width - right)}px;height:${rect.height}px`;

  selection.hidden = false;
  selection.style.left = `${rect.x}px`;
  selection.style.top = `${rect.y}px`;
  selection.style.width = `${rect.width}px`;
  selection.style.height = `${rect.height}px`;
  sizeLabel.textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
}

function resetShade() {
  shadeTop.style.cssText = 'left:0;top:0;width:100%;height:100%';
  shadeBottom.style.cssText = 'left:0;top:100%;width:100%;height:0';
  shadeLeft.style.cssText = 'left:0;top:0;width:0;height:0';
  shadeRight.style.cssText = 'left:0;top:0;width:0;height:0';
  selection.hidden = true;
}

function point(event) {
  return {
    x: Math.max(0, Math.min(window.innerWidth, event.clientX)),
    y: Math.max(0, Math.min(window.innerHeight, event.clientY)),
  };
}

document.addEventListener('mousedown', (event) => {
  if (locked || event.button !== 0) return;
  event.preventDefault();
  start = point(event);
  current = start;
  document.body.classList.add('dragging');
  title.textContent = 'Release to capture';
  sub.textContent = 'Brahma will OCR this region immediately.';
  paint({ ...start, width: 0, height: 0 });
});

document.addEventListener('mousemove', (event) => {
  if (!start || locked) return;
  current = point(event);
  paint(normalize(start, current));
});

document.addEventListener('mouseup', (event) => {
  if (!start || locked || event.button !== 0) return;
  locked = true;
  current = point(event);
  const rect = normalize(start, current);

  if (rect.width < 8 || rect.height < 8) {
    locked = false;
    start = null;
    current = null;
    document.body.classList.remove('dragging');
    title.textContent = 'Drag a larger region';
    sub.textContent = 'Select at least 8 x 8 pixels.';
    resetShade();
    setTimeout(() => {
      title.textContent = 'Drag a box around the text';
      sub.textContent = 'Works on any app outside Chrome. Press Esc to cancel.';
    }, 1300);
    return;
  }

  paint(rect);
  sizeLabel.textContent = 'Capturing...';
  window.screenOcr.selectRegion({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    window.screenOcr.cancelCapture();
  }
});

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.screenOcr.cancelCapture();
});

resetShade();
