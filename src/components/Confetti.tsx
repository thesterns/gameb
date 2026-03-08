import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CONFETTI_COLORS = [
  "hsl(var(--answer-red))",
  "hsl(var(--answer-blue))",
  "hsl(var(--answer-yellow))",
  "hsl(var(--answer-green))",
  "hsl(var(--answer-purple))",
  "hsl(var(--answer-orange))",
  "hsl(var(--primary))",
];

const SHAPES = ["●", "■", "▲", "★", "◆"];

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  shape: string;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  xDrift: number;
}

export const Confetti = ({ show, duration = 2500 }: { show: boolean; duration?: number }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    const newPieces: ConfettiPiece[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 8 + Math.random() * 14,
      delay: Math.random() * 0.4,
      duration: 1.2 + Math.random() * 1,
      rotation: Math.random() * 720 - 360,
      xDrift: (Math.random() - 0.5) * 60,
    }));
    setPieces(newPieces);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [show, duration]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
          {pieces.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
              animate={{
                y: "110vh",
                x: `calc(${p.x}vw + ${p.xDrift}px)`,
                opacity: [1, 1, 0.8, 0],
                rotate: p.rotation,
                scale: [1, 1.1, 0.8],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeIn",
              }}
              style={{
                position: "absolute",
                fontSize: p.size,
                color: p.color,
                top: 0,
              }}
            >
              {p.shape}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};
