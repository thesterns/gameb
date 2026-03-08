import { useState } from "react";

interface YouTubeEmbedProps {
  url: string;
  className?: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isValidYouTubeUrl(url: string): boolean {
  return !!extractYouTubeId(url);
}

const YouTubeEmbed = ({ url, className = "" }: YouTubeEmbedProps) => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <div className={`relative w-full aspect-video rounded-2xl overflow-hidden ${className}`}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};

export default YouTubeEmbed;
