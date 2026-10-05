"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  MeterValue,
} from "@/components/ui/meter";
import { OTPField, OTPFieldInput } from "@/components/ui/otp-field";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar";

const DIGITS = [1, 2, 3, 4, 5, 6];
const ITEMS = Array.from({ length: 12 }, (_, index) => `Scene ${index + 1}`);

export function RemainingPrimitives() {
  const [value, setValue] = useState(62);
  const [otp, setOtp] = useState("");
  const [legacyOtp, setLegacyOtp] = useState("");
  const decrease = useCallback(
    () => setValue((current) => Math.max(0, current - 10)),
    []
  );
  const increase = useCallback(
    () => setValue((current) => Math.min(100, current + 10)),
    []
  );

  return (
    <section
      aria-label="Remaining primitives"
      className="flex flex-col gap-6 pb-6"
    >
      <h2 className="font-medium text-lg">Fields and indicators</h2>
      <Toolbar aria-label="Progress controls">
        <ToolbarButton
          onClick={decrease}
          render={<Button size="xs" variant="ghost" />}
        >
          Decrease
        </ToolbarButton>
        <ToolbarButton
          onClick={increase}
          render={<Button size="xs" variant="ghost" />}
        >
          Increase
        </ToolbarButton>
      </Toolbar>
      <div className="grid gap-6 md:grid-cols-2">
        <Progress value={value}>
          <div className="flex gap-3">
            <ProgressLabel>Rendering</ProgressLabel>
            <ProgressValue />
          </div>
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
        <Meter value={value}>
          <div className="flex gap-3">
            <MeterLabel>Context used</MeterLabel>
            <MeterValue />
          </div>
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </Meter>
        <Field name="output">
          <FieldLabel>Output folder</FieldLabel>
          <Input defaultValue="exports" />
          <FieldDescription>
            The exported video will be saved here.
          </FieldDescription>
        </Field>
        <Field disabled name="disabled-output">
          <FieldLabel>Unavailable folder</FieldLabel>
          <Input defaultValue="exports" />
        </Field>
        <div className="flex flex-col gap-2">
          <Label htmlFor="base-code">Verification code</Label>
          <OTPField
            id="base-code"
            length={6}
            onValueChange={setOtp}
            value={otp}
          >
            {DIGITS.map((digit) => (
              <OTPFieldInput
                aria-label={digit === 1 ? undefined : `Code digit ${digit}`}
                key={digit}
              />
            ))}
          </OTPField>
          <output
            aria-label="Entered code"
            className="text-muted-foreground text-xs"
          >
            {otp || "Not entered"}
          </output>
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm" id="single-code">
            Single-input code
          </p>
          <InputOTP
            aria-labelledby="single-code"
            maxLength={6}
            onChange={setLegacyOtp}
            value={legacyOtp}
          >
            <InputOTPGroup>
              {DIGITS.map((digit) => (
                <InputOTPSlot index={digit - 1} key={digit} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <output
            aria-label="Single-input value"
            className="text-muted-foreground text-xs"
          >
            {legacyOtp || "Not entered"}
          </output>
        </div>
      </div>
      <Marker variant="separator">
        <MarkerContent>Today</MarkerContent>
      </Marker>
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="ghost" />}>
          Show loading placeholders
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div className="flex flex-col gap-2 py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </CollapsiblePanel>
      </Collapsible>
      <div className="h-32 rounded-xl bg-control p-3">
        <ScrollArea>
          <ul aria-label="Scene list" className="flex flex-col gap-2 text-sm">
            {ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ScrollArea>
      </div>
    </section>
  );
}
