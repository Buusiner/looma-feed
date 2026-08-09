import { useEffect, useRef } from "react";

type Satellite = { angle: number; radius: number; size: number; phase: number; speed: number };

const SATELLITES: Satellite[] = [
  { angle: -1.48, radius: 0.78, size: 11, phase: 0.2, speed: 0.72 },
  { angle: -0.78, radius: 0.95, size: 8, phase: 2.1, speed: 0.58 },
  { angle: -0.1, radius: 0.83, size: 10, phase: 4.4, speed: 0.67 },
  { angle: 0.7, radius: 0.92, size: 7, phase: 1.1, speed: 0.81 },
  { angle: 1.36, radius: 0.76, size: 10, phase: 3.4, speed: 0.54 },
  { angle: 2.07, radius: 0.94, size: 8, phase: 5.5, speed: 0.7 },
  { angle: 2.82, radius: 0.79, size: 9, phase: 4.8, speed: 0.6 },
  { angle: 3.55, radius: 0.92, size: 7, phase: 2.8, speed: 0.78 },
  { angle: 4.15, radius: 0.74, size: 9, phase: 0.9, speed: 0.62 },
];

export function ConnectionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cursor = { x: -999, y: -999 };
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = !document.hidden;
    let satellitesActive = reducedMotion.matches;
    let activationStart = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (now: number) => {
      const time = reducedMotion.matches ? 0 : now / 1000;
      const satelliteOpacity = satellitesActive
        ? Math.min(1, reducedMotion.matches ? 1 : (now - activationStart) / 900)
        : 0;
      const center = { x: width / 2, y: height / 2 };
      const coreRadius = Math.min(width, height) * 0.175;
      const orbitX = Math.min(width, height) * 0.39;
      const orbitY = orbitX * 0.77;
      const satelliteCount = width < 430 ? 6 : SATELLITES.length;
      const rotation = reducedMotion.matches ? 0 : time * 0.035;
      const positions = SATELLITES.slice(0, satelliteCount).map((satellite) => {
        const jitter = reducedMotion.matches
          ? 0
          : Math.sin(time * satellite.speed + satellite.phase) * 7;
        const angle = satellite.angle + rotation + Math.sin(time * 0.16 + satellite.phase) * 0.04;
        const radius = satellite.radius * orbitX + jitter;
        return {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius * (orbitY / orbitX),
          satellite,
        };
      });

      context.clearRect(0, 0, width, height);
      positions.forEach(({ x, y }) => {
        const distance = Math.hypot(cursor.x - x, cursor.y - y);
        const active = distance < 70;
        context.beginPath();
        context.moveTo(center.x, center.y);
        context.lineTo(x, y);
        context.lineWidth = active ? 1.1 : 0.75;
        context.strokeStyle = active
          ? `rgba(255,109,38,${0.68 * satelliteOpacity})`
          : `rgba(255,255,255,${0.14 * satelliteOpacity})`;
        context.stroke();
      });

      positions.forEach((position, index) => {
        positions.slice(index + 1).forEach((other) => {
          const distance = Math.hypot(position.x - other.x, position.y - other.y);
          const threshold = orbitX * 0.82;
          if (distance > threshold) return;
          context.beginPath();
          context.moveTo(position.x, position.y);
          context.lineTo(other.x, other.y);
          context.lineWidth = 0.55;
          context.strokeStyle = `rgba(255,255,255,${0.08 * (1 - distance / threshold) * satelliteOpacity})`;
          context.stroke();
        });
      });

      const pulseCycle = 2.65;
      const pulseTime = reducedMotion.matches ? -1 : time % pulseCycle;
      if (satelliteOpacity > 0 && pulseTime > 0.34 && pulseTime < 1.42) {
        const target = positions[Math.floor(time / pulseCycle) % positions.length];
        const progress = (pulseTime - 0.34) / 1.08;
        const x = center.x + (target.x - center.x) * progress;
        const y = center.y + (target.y - center.y) * progress;
        const glow = context.createRadialGradient(x, y, 0, x, y, 11);
        glow.addColorStop(0, `rgba(255,218,197,${0.92 * satelliteOpacity})`);
        glow.addColorStop(0.32, `rgba(255,109,38,${0.72 * satelliteOpacity})`);
        glow.addColorStop(1, "rgba(255,109,38,0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, 11, 0, Math.PI * 2);
        context.fill();
      }

      positions.forEach(({ x, y, satellite }) => {
        const distance = Math.hypot(cursor.x - x, cursor.y - y);
        const influence = Math.max(0, 1 - distance / 70);
        const outwardX = x - center.x;
        const outwardY = y - center.y;
        const length = Math.hypot(outwardX, outwardY) || 1;
        x += (outwardX / length) * influence * 13;
        y += (outwardY / length) * influence * 13;
        const radius = satellite.size + influence * 1.4;
        const glass = context.createRadialGradient(
          x - radius * 0.35,
          y - radius * 0.4,
          0,
          x,
          y,
          radius,
        );
        glass.addColorStop(0, `rgba(255,255,255,${0.72 * satelliteOpacity})`);
        glass.addColorStop(0.18, `rgba(177,185,194,${0.72 * satelliteOpacity})`);
        glass.addColorStop(0.54, `rgba(74,80,88,${0.9 * satelliteOpacity})`);
        glass.addColorStop(0.82, `rgba(20,23,27,${0.94 * satelliteOpacity})`);
        glass.addColorStop(1, `rgba(6,8,10,${0.78 * satelliteOpacity})`);
        context.fillStyle = glass;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = influence
          ? `rgba(255,255,255,${0.44 * satelliteOpacity})`
          : `rgba(255,255,255,${0.26 * satelliteOpacity})`;
        context.lineWidth = 0.85;
        context.stroke();
      });

      const breathing = reducedMotion.matches ? 1 : 1 + Math.sin(time * (Math.PI / 2)) * 0.05;
      const radius = coreRadius * breathing;
      const core = context.createRadialGradient(
        center.x - radius * 0.34,
        center.y - radius * 0.38,
        0,
        center.x,
        center.y,
        radius,
      );
      core.addColorStop(0, "rgba(255,255,255,.95)");
      core.addColorStop(0.16, "rgba(255,214,191,.88)");
      core.addColorStop(0.36, "rgba(255,109,38,.85)");
      core.addColorStop(0.66, "rgba(49,34,29,.68)");
      core.addColorStop(1, "rgba(22,22,24,.16)");
      context.fillStyle = core;
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,.24)";
      context.lineWidth = 1;
      context.stroke();

      if (!reducedMotion.matches && visible) frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion.matches) render(0);
    });
    observer.observe(canvas);
    resize();
    const pointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      cursor.x = event.clientX - bounds.left;
      cursor.y = event.clientY - bounds.top;
    };
    const pointerLeave = () => {
      cursor.x = -999;
      cursor.y = -999;
    };
    const activateSatellites = () => {
      if (satellitesActive) return;
      satellitesActive = true;
      activationStart = performance.now();
    };
    const visibilityChange = () => {
      visible = !document.hidden;
      if (visible && !reducedMotion.matches && !frame) frame = window.requestAnimationFrame(render);
      if (!visible && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerleave", pointerLeave, { passive: true });
    canvas.addEventListener("pointerenter", activateSatellites, { passive: true });
    window.addEventListener("pointermove", activateSatellites, { passive: true });
    window.addEventListener("mousemove", activateSatellites, { passive: true });
    window.addEventListener("touchstart", activateSatellites, { passive: true });
    document.addEventListener("visibilitychange", visibilityChange);
    if (reducedMotion.matches) render(0);
    else frame = window.requestAnimationFrame(render);
    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("pointerenter", activateSatellites);
      window.removeEventListener("pointermove", activateSatellites);
      window.removeEventListener("mousemove", activateSatellites);
      window.removeEventListener("touchstart", activateSatellites);
      document.removeEventListener("visibilitychange", visibilityChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="connection-canvas" aria-hidden="true" />;
}
