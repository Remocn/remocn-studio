import { SparklesIcon } from "lucide-react";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";

export function Thinking() {
  return (
    <Marker>
      <MarkerIcon>
        <SparklesIcon />
      </MarkerIcon>
      <MarkerContent className="shimmer">Thinking…</MarkerContent>
    </Marker>
  );
}
