export type GameTheme = "default" | "birthday" | "party" | "formal" | "colorful" | "calm";

export const themeOptions: { value: GameTheme; label: string; emoji: string; description: string }[] = [
  { value: "default", label: "ברירת מחדל", emoji: "🎮", description: "העיצוב הסטנדרטי" },
  { value: "birthday", label: "יום הולדת", emoji: "🎂", description: "חגיגי עם צבעי ורוד וסגול" },
  { value: "party", label: "מסיבה", emoji: "🎉", description: "ניאון על רקע כהה" },
  { value: "formal", label: "רשמי", emoji: "🎩", description: "אלגנטי עם כחול כהה" },
  { value: "colorful", label: "צבעוני", emoji: "🌈", description: "קשת צבעים עליזה" },
  { value: "calm", label: "רגוע", emoji: "🌿", description: "פסטלי ורך" },
];

export const themeClasses: Record<GameTheme, {
  bg: string;
  card: string;
  text: string;
  textSecondary: string;
  accent: string;
  answerColors: string[];
  timerBg: string;
  timerText: string;
  timerDanger: string;
  progressBg: string;
  headerBg: string;
}> = {
  default: {
    bg: "bg-gradient-to-br from-[hsl(220,85%,50%)] via-[hsl(260,80%,55%)] to-[hsl(300,70%,50%)]",
    card: "bg-white/10",
    text: "text-white",
    textSecondary: "text-white/70",
    accent: "bg-white/20",
    answerColors: [
      "bg-[hsl(0,80%,58%)]",
      "bg-[hsl(220,85%,55%)]",
      "bg-[hsl(45,95%,55%)]",
      "bg-[hsl(155,70%,45%)]",
      "bg-[hsl(270,70%,58%)]",
      "bg-[hsl(28,95%,55%)]",
    ],
    timerBg: "bg-white/10",
    timerText: "text-white",
    timerDanger: "bg-red-500/20 text-red-300",
    progressBg: "bg-white/20",
    headerBg: "",
  },
  birthday: {
    bg: "bg-gradient-to-br from-[hsl(330,80%,60%)] via-[hsl(280,70%,55%)] to-[hsl(340,85%,65%)]",
    card: "bg-white/15",
    text: "text-white",
    textSecondary: "text-white/75",
    accent: "bg-pink-300/30",
    answerColors: [
      "bg-[hsl(330,80%,55%)]",
      "bg-[hsl(280,70%,55%)]",
      "bg-[hsl(45,90%,60%)]",
      "bg-[hsl(180,60%,50%)]",
      "bg-[hsl(300,60%,60%)]",
      "bg-[hsl(20,85%,60%)]",
    ],
    timerBg: "bg-pink-300/20",
    timerText: "text-white",
    timerDanger: "bg-red-400/30 text-red-200",
    progressBg: "bg-pink-300/30",
    headerBg: "",
  },
  party: {
    bg: "bg-gradient-to-br from-[hsl(260,90%,10%)] via-[hsl(280,80%,15%)] to-[hsl(240,85%,12%)]",
    card: "bg-white/5 border border-[hsl(300,100%,60%)]/30",
    text: "text-[hsl(300,100%,85%)]",
    textSecondary: "text-[hsl(280,80%,70%)]",
    accent: "bg-[hsl(300,100%,60%)]/20",
    answerColors: [
      "bg-[hsl(350,100%,55%)]",
      "bg-[hsl(180,100%,45%)]",
      "bg-[hsl(60,100%,50%)]",
      "bg-[hsl(120,100%,40%)]",
      "bg-[hsl(280,100%,60%)]",
      "bg-[hsl(30,100%,55%)]",
    ],
    timerBg: "bg-[hsl(300,100%,60%)]/15",
    timerText: "text-[hsl(300,100%,85%)]",
    timerDanger: "bg-red-500/30 text-red-300",
    progressBg: "bg-[hsl(300,100%,60%)]/20",
    headerBg: "",
  },
  formal: {
    bg: "bg-gradient-to-br from-[hsl(220,40%,15%)] via-[hsl(215,35%,20%)] to-[hsl(210,30%,25%)]",
    card: "bg-white/8",
    text: "text-[hsl(40,30%,95%)]",
    textSecondary: "text-[hsl(40,20%,70%)]",
    accent: "bg-[hsl(40,40%,50%)]/20",
    answerColors: [
      "bg-[hsl(220,50%,40%)]",
      "bg-[hsl(200,45%,35%)]",
      "bg-[hsl(40,40%,45%)]",
      "bg-[hsl(160,35%,35%)]",
      "bg-[hsl(250,35%,40%)]",
      "bg-[hsl(15,40%,40%)]",
    ],
    timerBg: "bg-[hsl(40,40%,50%)]/15",
    timerText: "text-[hsl(40,30%,95%)]",
    timerDanger: "bg-red-800/30 text-red-300",
    progressBg: "bg-[hsl(40,40%,50%)]/20",
    headerBg: "",
  },
  colorful: {
    bg: "bg-gradient-to-br from-[hsl(0,85%,60%)] via-[hsl(45,90%,55%)] via-[hsl(120,70%,45%)] to-[hsl(270,80%,55%)]",
    card: "bg-white/20",
    text: "text-white",
    textSecondary: "text-white/80",
    accent: "bg-white/25",
    answerColors: [
      "bg-[hsl(0,85%,55%)]",
      "bg-[hsl(200,85%,50%)]",
      "bg-[hsl(50,90%,50%)]",
      "bg-[hsl(130,70%,40%)]",
      "bg-[hsl(280,80%,55%)]",
      "bg-[hsl(25,90%,55%)]",
    ],
    timerBg: "bg-white/15",
    timerText: "text-white",
    timerDanger: "bg-red-500/30 text-red-200",
    progressBg: "bg-white/25",
    headerBg: "",
  },
  calm: {
    bg: "bg-gradient-to-br from-[hsl(170,30%,85%)] via-[hsl(200,35%,80%)] to-[hsl(230,30%,82%)]",
    card: "bg-white/50",
    text: "text-[hsl(220,25%,20%)]",
    textSecondary: "text-[hsl(220,15%,40%)]",
    accent: "bg-[hsl(170,30%,60%)]/20",
    answerColors: [
      "bg-[hsl(350,45%,65%)]",
      "bg-[hsl(210,50%,60%)]",
      "bg-[hsl(45,50%,65%)]",
      "bg-[hsl(160,40%,55%)]",
      "bg-[hsl(270,40%,65%)]",
      "bg-[hsl(25,50%,65%)]",
    ],
    timerBg: "bg-[hsl(170,30%,60%)]/15",
    timerText: "text-[hsl(220,25%,20%)]",
    timerDanger: "bg-red-300/30 text-red-700",
    progressBg: "bg-[hsl(170,30%,60%)]/25",
    headerBg: "",
  },
};
