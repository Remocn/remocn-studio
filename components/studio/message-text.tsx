"use client";

import { Fragment, useMemo } from "react";
import { type ReferenceCounts, segmentsOf } from "@/shared/references";

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
      <Fragment key={segment.id}>{segment.text}</Fragment>
    )
  );
}
