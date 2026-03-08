import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import JoinGame from "./pages/JoinGame";
import CreateQuiz from "./pages/CreateQuiz";
import MyQuizzes from "./pages/MyQuizzes";
import GameLobby from "./pages/GameLobby";
import PlayerWaiting from "./pages/PlayerWaiting";
import GamePlay from "./pages/GamePlay";
import CreateChallenge from "./pages/CreateChallenge";
import MyChallenges from "./pages/MyChallenges";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quiz/new" element={<CreateQuiz />} />
          <Route path="/quiz/:quizId/edit" element={<CreateQuiz />} />
          <Route path="/my-quizzes" element={<MyQuizzes />} />
          <Route path="/join" element={<JoinGame />} />
          <Route path="/join/:directLink" element={<JoinGame />} />
          <Route path="/game/:sessionId/lobby" element={<GameLobby />} />
          <Route path="/game/:sessionId/waiting" element={<PlayerWaiting />} />
          <Route path="/game/:sessionId/play" element={<GamePlay />} />
          <Route path="/challenge/new" element={<CreateChallenge />} />
          <Route path="/challenge/:challengeId/edit" element={<CreateChallenge />} />
          <Route path="/my-challenges" element={<MyChallenges />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
