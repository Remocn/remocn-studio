"use client";

import { Fragment, useMemo } from "react";
import { segmentsOf } from "@/shared/references";

export function MessageText({ count, text }: { count: number; text: string }) {
  const segments = useMemo(() => segmentsOf(text, count), [count, text]);

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
