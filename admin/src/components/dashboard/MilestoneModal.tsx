import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { formatCurrency } from "@/helper/formatCurrency";

const CONFETTI_COLORS = ["#fbc21b", "#fdbf08", "#f8cf54", "#fadd85", "#fbe298", "#f5b812"];

interface MilestoneModalProps {
  milestone: number;
  nextMilestone: number | null;
  onAcknowledge: () => void;
}

export function MilestoneModal({ milestone, nextMilestone, onAcknowledge }: MilestoneModalProps) {
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const end = Date.now() + 4 * 1000;

    const frame = () => {
      if (Date.now() > end) return;

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: CONFETTI_COLORS,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: CONFETTI_COLORS,
      });

      animFrameRef.current = requestAnimationFrame(frame);
    };

    animFrameRef.current = requestAnimationFrame(frame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-primary/10 rounded-full p-4">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          Parabéns! 🎉
        </h2>

        <p className="text-muted-foreground mb-1 text-sm">Você atingiu</p>

        <p className="text-4xl font-extrabold text-primary mb-4">
          {formatCurrency(milestone)}
        </p>

        <p className="text-foreground mb-6">
          Incrível conquista! Seu negócio está crescendo forte.
          {nextMilestone && (
            <span className="block mt-1 text-muted-foreground text-sm">
              Próxima meta: <span className="text-primary font-semibold">{formatCurrency(nextMilestone)}</span>
            </span>
          )}
        </p>

        <Button className="w-full" onClick={onAcknowledge}>
          Continuar crescendo!
        </Button>
      </div>
    </div>
  );
}
