// Celebration confetti burst for Sharp — lightweight canvas particles with reduced motion support.

export function burstConfetti(container = document.body, count = 60) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return; // Respect reduced motion
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'celebration-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#6366f1', '#38bdf8', '#ec4899', '#10b981', '#f59e0b', '#a855f7'];
  const particles = Array.from({ length: count }, () => {
    return {
      x: width / 2 + (Math.random() - 0.5) * 80,
      y: height * 0.45 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 12 - 5,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      opacity: 1,
      decay: Math.random() * 0.015 + 0.012
    };
  });

  let animationFrame;
  let active = true;
  function dispose() {
    active = false;
    cancelAnimationFrame(animationFrame);
    canvas.remove();
  }
  function update() {
    if (!active) return;
    ctx.clearRect(0, 0, width, height);
    let activeCount = 0;

    particles.forEach((p) => {
      if (p.opacity <= 0) return;
      activeCount++;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4; // gravity
      p.vx *= 0.98; // friction
      p.rotation += p.vRot;
      p.opacity -= p.decay;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (activeCount > 0) {
      animationFrame = requestAnimationFrame(update);
    } else {
      dispose();
    }
  }

  animationFrame = requestAnimationFrame(update);
  return dispose;
}
