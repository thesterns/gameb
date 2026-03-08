import { motion } from "framer-motion";

interface QuizLogoProps {
  logoUrl?: string | null;
  logoText?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: { img: "h-8 w-8", text: "text-sm" },
  md: { img: "h-12 w-12", text: "text-base" },
  lg: { img: "h-16 w-16", text: "text-lg" },
};

const QuizLogo = ({ logoUrl, logoText, className = "", size = "sm" }: QuizLogoProps) => {
  if (!logoUrl && !logoText) return null;

  const s = sizeClasses[size];

  return (
    <div className={`flex items-center gap-2 justify-center ${className}`}>
      {logoUrl && (
        <img
          src={logoUrl}
          alt={logoText || "לוגו"}
          className={`${s.img} object-contain rounded-lg`}
        />
      )}
      {logoText && (
        <span className={`font-heading font-bold ${s.text} text-foreground`}>
          {logoText}
        </span>
      )}
    </div>
  );
};

export default QuizLogo;
