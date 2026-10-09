"use client";

import type { ReactNode } from "react";
import {
  ChevronRightIcon,
  ClipboardCheckIcon,
  InfoIcon,
  WrenchIcon,
} from "@/components/icons";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  type FindingGroup,
  groupFindings,
  reviewStatus,
  type VideoReview,
} from "@/lib/studio/design-review";
import { cn } from "@/lib/utils";
import { ActivityDetail } from "./activity-detail";

const CATEGORIES = [
  {
    Icon: WrenchIcon,
    label: "improvement",
    severity: "error",
    tone: "text-warning-foreground",
  },
  {
    Icon: InfoIcon,
    label: "caution",
    severity: "warning",
    tone: "text-warning-foreground",
  },
  {
    Icon: InfoIcon,
    label: "observation",
    severity: "info",
    tone: "text-foreground/75",
  },
] as const;

export function DesignReview({
  review,
  raw,
}: {
  review: VideoReview;
  raw: string;
}) {
  const disclosure = useDisclosure();
  const findings = groupFindings(review.findings);
  const groups = CATEGORIES.map((category) => ({
    ...category,
    items: findings.filter((finding) => finding.severity === category.severity),
  }));
  const ordered = groups.flatMap((group) => group.items);
  const visible = new Set(
    (disclosure.isOpen ? ordered : ordered.slice(0, 3)).map((item) => item.id)
  );
  const limited =
    review.readiness?.stale ||
    review.readiness?.coverage?.cancelled ||
    review.readiness?.coverage?.complete === false;

  return (
    <section
      aria-label={`Video review: ${review.composition}`}
      className="min-w-0 overflow-hidden rounded-xl bg-secondary text-card-foreground text-xs"
    >
      <div className="space-y-4 px-4 py-3">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <ClipboardCheckIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-foreground/75"
            />
            <h3 className="min-w-0 font-medium text-sm leading-snug">
              Video review
            </h3>
          </div>
          <span
            className={cn(
              "max-w-full text-pretty leading-normal",
              limited ? "text-warning-foreground" : "text-foreground/75"
            )}
          >
            {reviewStatus(review)}
          </span>
        </header>

        {findings.length === 0 ? (
          <p className="text-pretty text-sm leading-relaxed">
            {limited
              ? "No findings returned before the review stopped or became stale."
              : "No findings in the checked frames."}
          </p>
        ) : (
          <div className="space-y-4">
            {groups
              .filter((group) => group.items.length > 0)
              .map(({ severity, label, Icon, tone, items }) => (
                <div className="space-y-1" key={severity}>
                  <p
                    className={cn(
                      "flex items-center gap-2 font-medium tabular-nums",
                      tone
                    )}
                  >
                    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span>{`${items.length} ${label}${items.length === 1 ? "" : "s"}`}</span>
                  </p>
                  <ul className="space-y-1">
                    {items
                      .filter((item) => visible.has(item.id))
                      .map((item) => (
                        <Finding finding={item} key={item.id} />
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
        {limited ? (
          <Disclosure label="Review limitations">
            <div className="space-y-2 text-foreground/75 leading-relaxed">
              {review.readiness?.coverage?.limitations.map((text) => (
                <p className="wrap-break-word" key={text}>
                  {text}
                </p>
              ))}
            </div>
          </Disclosure>
        ) : null}
      </div>
      <footer className="space-y-1 px-3 pt-0 pb-2">
        {findings.length > 3 ? (
          <button
            aria-expanded={disclosure.isOpen}
            className="flex min-h-8 w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-start font-medium outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
            onClick={disclosure.toggle}
            type="button"
          >
            {disclosure.isOpen
              ? "Show fewer findings"
              : `Show all ${findings.length} findings`}
            <ChevronRightIcon
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0",
                disclosure.isOpen && "rotate-90"
              )}
            />
          </button>
        ) : null}
        <Disclosure label="Technical report">
          <ActivityDetail detail={{ kind: "text", text: raw }} />
        </Disclosure>
      </footer>
    </section>
  );
}

function Disclosure({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group/review-disclosure min-w-0">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-2 py-1.5 text-foreground/75 outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="wrap-break-word min-w-0">{label}</span>
        <ChevronRightIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 group-open/review-disclosure:rotate-90"
        />
      </summary>
      <div className="min-w-0 px-2 pt-1 pb-2">{children}</div>
    </details>
  );
}

function Finding({ finding }: { finding: FindingGroup }) {
  return (
    <li>
      <details className="group/finding">
        <summary className="-mx-2 flex cursor-pointer list-none items-start gap-3 rounded-md px-2 py-2 text-sm leading-relaxed outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="wrap-break-word min-w-0 flex-1 text-pretty group-open/finding:font-medium">
            {finding.message}
            {finding.occurrences > 1 ? (
              <span className="ms-2 whitespace-nowrap text-foreground/75 text-xs tabular-nums">{`(${finding.occurrences} occurrences)`}</span>
            ) : null}
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="mt-1 size-3.5 shrink-0 text-foreground/75 group-open/finding:rotate-90"
          />
        </summary>
        <div className="wrap-break-word mt-1 mb-3 space-y-3 rounded-lg bg-field px-3 py-3 leading-relaxed">
          {finding.fix ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground/75 text-xs">
                Suggested change
              </p>
              <p className="text-pretty text-foreground/85 text-sm">
                {finding.fix}
              </p>
            </div>
          ) : null}
          {finding.frames.length > 0 || finding.selector ? (
            <div className="space-y-1 text-foreground/75 text-xs">
              {finding.frames.length > 0 ? (
                <p className="tabular-nums">{`Frames ${finding.frames.join(", ")}`}</p>
              ) : null}
              {finding.selector ? (
                <p>
                  <span className="me-2">Element</span>
                  <bdi className="font-mono">{finding.selector}</bdi>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}
