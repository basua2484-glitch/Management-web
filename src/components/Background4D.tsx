import React, { useEffect, useRef } from 'react';

export interface Background4DProps {
  className?: string;
}

export const Background4D: React.FC<Background4DProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 4D hyper-particle cluster representation
    const numParticles = 90;
    const particles = Array.from({ length: numParticles }, (_, i) => ({
      x: (Math.random() - 0.5) * width * 1.4,
      y: (Math.random() - 0.5) * height * 1.4,
      z: (Math.random() - 0.5) * 500,
      w: Math.random() * Math.PI * 2, // 4th dimension temporal phase
      radius: Math.random() * 2.2 + 1,
      speedW: (Math.random() * 0.008 + 0.006) * (Math.random() > 0.5 ? 1 : -1),
      isCyan: i % 2 === 0, // Alternate cyan and electric blue
    }));

    let time = 0;

    const render = () => {
      time += 0.012;
      // Smooth trail effect with deep obsidian background
      ctx.fillStyle = 'rgba(8, 10, 15, 0.28)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Cache projected points for connection lines
      const projected: Array<{
        x: number;
        y: number;
        scale: number;
        alpha: number;
        isCyan: boolean;
        radius: number;
      }> = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.w += p.speedW;

        // 4D Hyper-dimensional temporal rotation
        const cosW = Math.cos(p.w + time * 0.2);
        const sinW = Math.sin(p.w + time * 0.2);
        const projectedZ = p.z * cosW - p.x * sinW;
        const projectedX = p.z * sinW + p.x * cosW;

        const depth = 450;
        const scale = depth / (depth + projectedZ);
        const x2d = projectedX * scale + cx;
        const y2d = p.y * scale + cy;

        if (x2d >= -20 && x2d <= width + 20 && y2d >= -20 && y2d <= height + 20) {
          const alpha = Math.min(0.95, Math.max(0.15, (projectedZ + 250) / 500));
          projected.push({ x: x2d, y: y2d, scale, alpha, isCyan: p.isCyan, radius: p.radius });

          // Render glowing neon hyper-particle
          ctx.beginPath();
          ctx.arc(x2d, y2d, Math.max(0.6, p.radius * scale), 0, Math.PI * 2);

          if (p.isCyan) {
            ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#06b6d4';
          } else {
            ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#3b82f6';
          }
          ctx.fill();
        }
      }

      // Draw subtle neon energy webs between nearby projected nodes
      ctx.shadowBlur = 0;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const p1 = projected[i];
          const p2 = projected[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 11000) {
            const lineAlpha = (1 - distSq / 11000) * 0.18 * Math.min(p1.alpha, p2.alpha);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p1.isCyan
              ? `rgba(6, 182, 212, ${lineAlpha})`
              : `rgba(59, 130, 246, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="background-4d-canvas"
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ background: '#080a0f' }}
    />
  );
};

export default Background4D;
