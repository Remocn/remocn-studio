"use client";

import { Fragment, useMemo } from "react";
import { mentionPieces } from "@/lib/studio/mentions";
import {
  type ReferenceCounts,
  segmentsOf,
  type TextSegment,
} from "@/shared/references";

export function MessageText({
  counts,
  text,
}: {
  counts: ReferenceCounts;
  text: string;
}) {
  const segments = useMemo(() => segmentsOf(text, counts), [counts, text]);

  return segments.map((segment) =>
    segment.kind === "reference" ? (
      <span className="text-reference" key={segment.id}>
        {segment.text}
      </span>
    ) : (
      <TextRun key={segment.id} segment={segment} />
    )
  );
}

function TextRun({ segment }: { segment: TextSegment }) {
  const pieces = useMemo(() => mentionPieces(segment.text), [segment.text]);

  return pieces.map((piece) =>
    piece.isPath ? (
      <span className="file-mention" key={`${segment.id}:${piece.start}`}>
        {piece.text}
      </span>
    ) : (
      <Fragment key={`${segment.id}:${piece.start}`}>{piece.text}</Fragment>
    )
  );
}
