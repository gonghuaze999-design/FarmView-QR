import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface Position { x: number; y: number; }

interface AiFloatingBallProps {
  onClick: () => void;
}

export const AiFloatingBall: React.FC<AiFloatingBallProps> = ({ onClick }) => {
  const [pos, setPos] = useState<Position>(() => {
    const saved = sessionStorage.getItem('ai_ball_pos');
    if (saved) return JSON.parse(saved);
    return { x: 0, y: window.innerHeight * 0.5 - 24 };
  });
  const [dragging, setDragging] = useState(false);
  const [snapSide, setSnapSide] = useState<'right' | 'left'>('right');
  const dragRef = useRef<{ startX: number; startY: number; startPos: Position } | null>(null);
  const isDragging = useRef(false);
  const [visible, setVisible] = useState(true);

  const BALL_SIZE = 48;
  const EDGE_OFFSET = BALL_SIZE * 0.45;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const snap = useCallback((x: number, y: number) => {
    const w = window.innerWidth;
    const side: 'right' | 'left' = x > w / 2 ? 'right' : 'left';
    setSnapSide(side);
    const sx = side === 'right' ? w - EDGE_OFFSET : -BALL_SIZE + EDGE_OFFSET;
    const sy = clamp(y, 64, window.innerHeight - BALL_SIZE - 80);
    setPos({ x: sx, y: sy });
    sessionStorage.setItem('ai_ball_pos', JSON.stringify({ x: sx, y: sy }));
    return { x: sx, y: sy };
  }, [EDGE_OFFSET, BALL_SIZE]);

  // 初始吸附
  useEffect(() => {
    const timer = setTimeout(() => snap(pos.x, pos.y), 500);
    return () => clearTimeout(timer);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    isDragging.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
    const nx = dragRef.current.startPos.x + dx;
    const ny = dragRef.current.startPos.y + dy;
    setPos({ x: nx, y: ny });
  };

  const handlePointerUp = () => {
    setDragging(false);
    if (isDragging.current) {
      const snapped = snap(pos.x, pos.y);
      setPos(snapped);
    }
    dragRef.current = null;
  };

  const handleClick = () => {
    if (!isDragging.current) onClick();
  };

  // 边缘hover滑出
  const isDocked = snapSide === 'right' ? pos.x + BALL_SIZE - EDGE_OFFSET < 8 : pos.x + EDGE_OFFSET > window.innerWidth - 8;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      className="fixed z-[150] select-none touch-none cursor-grab active:cursor-grabbing transition-transform duration-200"
      style={{
        width: BALL_SIZE,
        height: BALL_SIZE,
        left: pos.x,
        top: pos.y,
        transform: dragging ? 'scale(1.1)' : 'scale(1)',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
        borderRadius: '50%',
        boxShadow: '0 4px 20px rgba(139,92,246,0.4), 0 0 0 3px rgba(139,92,246,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Sparkles size={20} className="text-white" />
    </div>
  );
};
