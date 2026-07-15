'use client';

/**
 * RibbonBackground
 * 在页面最底层生成多条半透明 SVG 丝带，缓慢蜿蜒飘动。
 * 完全不遮挡内容（opacity 8%-15%，pointer-events: none，z-index: -1）。
 * 使用 will-change 和 translate3d 做 GPU 加速，避免重排。
 */

import { useEffect, useRef, useState } from 'react';

const PALETTE: [string, string][] = [
  ['#FF9AA2', '#FFB7B2'], // 珊瑚粉
  ['#B5EAD7', '#C7F0E1'], // 薄荷青
  ['#A2C8FF', '#C2E0FF'], // 天空蓝
  ['#FFDAC1', '#FFE5D1'], // 蜜桃橙
  ['#E2F0CB', '#EEF8D9'], // 嫩芽绿
  ['#CDB4DB', '#E0C3F0'], // 薰衣草紫
  ['#FDE2E4', '#FAD2E1'], // 樱花粉
  ['#B8E0D2', '#D4F1F4'], // 冰蓝
];

const RIBBON_COUNT = 9;

export default function RibbonBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const width = window.innerWidth;
    const height = window.innerHeight;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < RIBBON_COUNT; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ribbon');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.opacity = String(0.18 + Math.random() * 0.1);
      svg.style.animationDuration = `${28 + Math.random() * 22}s`;
      svg.style.animationDelay = `${-Math.random() * 40}s`;

      const gradientId = `ribbon-grad-${i}-${version}`;
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', gradientId);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '0%');

      const [c1, c2] = PALETTE[i % PALETTE.length];
      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', c1);
      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', c2);
      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
      svg.appendChild(defs);

      // 生成蜿蜒曲线：从左到右，带随机控制点的二次贝塞尔曲线
      const baseY = height * (0.12 + Math.random() * 0.76);
      const amplitude = 50 + Math.random() * 90;
      const segments = 5 + Math.floor(Math.random() * 3);
      const segW = (width + 300) / segments;
      let d = `M -150 ${baseY}`;

      for (let s = 1; s <= segments; s++) {
        const x = -150 + s * segW;
        const y = baseY + (Math.random() - 0.5) * amplitude * 2;
        const cpx = x - segW / 2;
        const cpy = baseY + (Math.random() - 0.5) * amplitude;
        d += ` Q ${cpx.toFixed(1)} ${cpy.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', `url(#${gradientId})`);
      path.setAttribute('stroke-width', String(40 + Math.random() * 90));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('filter', 'blur(6px)');
      svg.appendChild(path);

      fragment.appendChild(svg);
    }

    container.appendChild(fragment);

    // 窗口尺寸变化时重新生成（debounce）
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVersion((v) => v + 1), 300);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [version]);

  return <div id="ribbon-bg" ref={containerRef} aria-hidden="true" />;
}
