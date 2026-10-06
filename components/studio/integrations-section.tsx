"use client";

import { SiElevenlabs, SiFigma } from "@icons-pack/react-simple-icons";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  PlugZapIcon,
  PlusIcon,
} from "lucide-react";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useIntegrations } from "@/hooks/use-integrations";
import { keyringName } from "@/lib/studio/platform";
import type {
  AuthorizationKind,
  Connection,
  ConnectionState,
  IntegrationCapability,
  IntegrationProvider,
} from "@/shared/integrations";
import { SettingsPanel as Group } from "./settings-group";

const STATE_LABELS = {
  checking: "Checking",
  connected: "Connected",
  "needs-authorization": "Action needed",
  unavailable: "Unavailable",
} satisfies Record<ConnectionState, string>;

const STATE_VARIANTS = {
  checking: "outline",
  connected: "success",
  "needs-authorization": "error",
  unavailable: "warning",
} satisfies Record<
  ConnectionState,
  "error" | "outline" | "success" | "warning"
>;

const SECRET_LABELS = {
  "api-key": "API key",
  browser: "Sign in",
  "personal-token": "Personal access token",
} satisfies Record<AuthorizationKind, string>;

const CAPABILITY_LABELS = {
  audio: "Audio creation",
  design: "Design tools",
  import: "Import assets",
  publish: "Publishing",
} satisfies Record<IntegrationCapability, string>;

function capabilitiesLabel(capabilities: readonly IntegrationCapability[]) {
  return capabilities
    .map((capability) => CAPABILITY_LABELS[capability])
    .join(" · ");
}

function ProviderIcon({ provider }: { provider: string }) {
  const icons: Record<string, typeof PlugZapIcon | typeof SiFigma> = {
    elevenlabs: SiElevenlabs,
    figma: SiFigma,
  };
  const Icon = icons[provider] ?? PlugZapIcon;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none flex size-11 shrink-0 select-none items-center justify-center rounded-xl bg-background text-foreground ring-1 ring-border/60"
    >
      <Icon className="size-5" />
    </span>
  );
}

function FlowError({ error }: { error: string | null }) {
  if (error === null) {
    return null;
  }
  return (
    <p
      className="flex items-start gap-2 rounded-lg bg-destructive/8 p-3 text-destructive-foreground text-xs leading-relaxed"
      id="integration-error"
      role="alert"
    >
      <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  );
}

export function IntegrationsSection() {
  const integrations = useIntegrations();

  return (
    <Group
      action={
        integrations.step === "closed" &&
        integrations.catalogue.length > 0 &&
        integrations.connections.length > 0 ? (
          <Button
            className="min-h-11 sm:min-h-10"
            onClick={integrations.onOpenAdd}
          >
            <PlusIcon data-icon="inline-start" />
            Add integration
          </Button>
        ) : null
      }
      description="Connect your tools to give the studio access to audio, design assets and more."
      title="Services"
    >
      {integrations.step === "closed" ? null : (
        <AddFlow integrations={integrations} />
      )}

      {integrations.connections.length === 0 &&
      integrations.step === "closed" ? (
        <Empty
          hasCatalogue={integrations.catalogue.length > 0}
          onAdd={integrations.onOpenAdd}
        />
      ) : null}

      {integrations.connections.length > 0 ? (
        <div className="grid gap-3">
          {integrations.connections.map((connection) => (
            <ConnectionRow
              busy={integrations.busy === connection.id}
              connection={connection}
              key={connection.id}
              onCheck={integrations.onCheck}
              onRemove={integrations.onRemove}
              onToggleDisabled={integrations.onToggleDisabled}
              providerName={
                integrations.catalogue.find(
                  (provider) => provider.id === connection.provider
                )?.name ?? connection.provider
              }
            />
          ))}
        </div>
      ) : null}

      {integrations.notice === null ? null : (
        <p className="break-words text-muted-foreground text-xs">
          {integrations.notice}
        </p>
      )}

      {integrations.step === "closed" ? (
        <FlowError error={integrations.error} />
      ) : null}
      <p className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
        <LockKeyholeIcon
          aria-hidden="true"
          className="mt-0.5 size-3.5 shrink-0"
        />
        Keys stay in {keyringName()}, outside your chats and projects.
      </p>
    </Group>
  );
}

function Empty({
  hasCatalogue,
  onAdd,
}: {
  hasCatalogue: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none flex select-none items-center gap-3"
      >
        <ProviderIcon provider="elevenlabs" />
        <span className="h-px w-5 bg-border" />
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <PlugZapIcon className="size-6" />
        </span>
        <span className="h-px w-5 bg-border" />
        <ProviderIcon provider="figma" />
      </div>
      <div className="grid max-w-sm gap-2">
        <h4 className="text-balance font-medium text-base">
          Nothing is connected yet
        </h4>
        <p className="text-pretty text-muted-foreground text-sm leading-relaxed">
          {hasCatalogue
            ? "Bring your tools into the studio. Connect a service so the agent can use it while working on your video."
            : "This build carries no service the studio can connect to."}
        </p>
      </div>
      {hasCatalogue ? (
        <Button className="min-h-11 sm:min-h-10" onClick={onAdd}>
          <PlusIcon />
          Add integration
        </Button>
      ) : null}
    </div>
  );
}

function AddFlow({
  integrations,
}: {
  integrations: ReturnType<typeof useIntegrations>;
}) {
  const { candidate, step } = integrations;

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-background p-4 ring-1 ring-border/60 sm:p-5">
      <div className="grid gap-4">
        <h4 className="text-balance font-medium text-base">Add integration</h4>
        <ol aria-label="Connection progress" className="grid grid-cols-3 gap-2">
          {["Service", "Access", "Connect"].map((label, index) => {
            const current = { chosen: 1, closed: 0, naming: 2, picking: 0 }[
              step
            ];
            return (
              <li
                aria-current={index === current ? "step" : undefined}
                className={`flex flex-wrap items-center gap-2 text-xs ${index <= current ? "text-foreground" : "text-muted-foreground"}`}
                key={label}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full font-medium tabular-nums ${index === current ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {index < current ? (
                    <CheckIcon aria-hidden="true" className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>
      {step === "picking" ? (
        <Picking
          catalogue={integrations.catalogue}
          onChoose={integrations.onChoose}
        />
      ) : null}

      {step === "chosen" && candidate !== null ? (
        <Authorizing
          busy={integrations.busy === "checking"}
          error={integrations.error}
          onSubmit={integrations.onSubmitSecret}
          provider={candidate}
        />
      ) : null}

      {step === "naming" && candidate !== null ? (
        <Naming
          account={integrations.attempt?.account ?? null}
          busy={integrations.busy === "saving"}
          error={integrations.error}
          onConfirm={integrations.onConfirm}
          provider={candidate}
        />
      ) : null}

      <Button
        className="min-h-11 self-start sm:min-h-10"
        onClick={integrations.onCancelAdd}
        size="sm"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}

function Picking({
  catalogue,
  onChoose,
}: {
  catalogue: readonly IntegrationProvider[];
  onChoose: (provider: IntegrationProvider) => void;
}) {
  const onPick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = catalogue.find(
        (one) => one.id === event.currentTarget.value
      );
      if (picked !== undefined) {
        onChoose(picked);
      }
    },
    [catalogue, onChoose]
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 font-medium text-sm">Choose a service</legend>
      <p className="pb-2 text-muted-foreground text-xs">
        Choose what you want to bring into your workflow.
      </p>
      {catalogue.map((provider) => (
        <button
          className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-start text-sm transition-colors duration-fast hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 active:bg-accent"
          key={provider.id}
          onClick={onPick}
          type="button"
          value={provider.id}
        >
          <ProviderIcon provider={provider.id} />
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="font-medium">{provider.name}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              {capabilitiesLabel(provider.capabilities)}
            </span>
          </span>
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
          />
        </button>
      ))}
    </fieldset>
  );
}

function Authorizing({
  busy,
  error,
  onSubmit,
  provider,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (secret: string) => void;
  provider: IntegrationProvider;
}) {
  const [secret, setSecret] = useState("");
  const label = SECRET_LABELS[provider.authorization[0]];

  const onChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    setSecret(event.currentTarget.value);
  }, []);

  const onCheck = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy || secret.trim().length === 0) {
        return;
      }
      onSubmit(secret);
    },
    [busy, onSubmit, secret]
  );

  return (
    <form aria-busy={busy} className="grid gap-5" onSubmit={onCheck}>
      <div className="flex items-center gap-3">
        <ProviderIcon provider={provider.id} />
        <div className="grid gap-1">
          <h5 className="font-medium text-sm">Connect {provider.name}</h5>
          <p className="text-muted-foreground text-xs">
            {capabilitiesLabel(provider.capabilities)}
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label className="text-sm" htmlFor="integration-secret">
          {label} for {provider.name}
        </Label>
        <Input
          aria-describedby={
            error
              ? "integration-secret-help integration-error"
              : "integration-secret-help"
          }
          aria-invalid={error !== null}
          autoComplete="off"
          className="min-h-11 sm:min-h-10"
          disabled={busy}
          id="integration-secret"
          onChange={onChange}
          placeholder={`Paste your ${label.toLowerCase()}`}
          type="password"
          value={secret}
        />
        <p
          className="text-muted-foreground text-xs leading-relaxed"
          id="integration-secret-help"
        >
          Use a {label.toLowerCase()} from your {provider.name} account. The
          studio will verify access before saving this connection.
          {provider.id === "elevenlabs"
            ? " Enable User read and the generation permissions you need for sound or music. Account access is checked now; generation access is checked when you approve a request that spends credits."
            : null}
        </p>
        <FlowError error={error} />
      </div>
      <Button
        className="min-h-11 justify-self-start sm:min-h-10"
        disabled={busy || secret.trim().length === 0}
        type="submit"
      >
        {busy ? <Spinner /> : <KeyRoundIcon />}
        {busy ? "Verifying access…" : "Verify access"}
      </Button>
    </form>
  );
}

function Naming({
  error,
  account,
  busy,
  onConfirm,
  provider,
}: {
  account: string | null;
  busy: boolean;
  error: string | null;
  onConfirm: (name: string) => void;
  provider: IntegrationProvider;
}) {
  const defaultName = account?.trim() || provider.name;
  const [name, setName] = useState(defaultName);

  const onChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const onSave = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) {
        return;
      }
      onConfirm(name.trim() || defaultName);
    },
    [busy, defaultName, name, onConfirm]
  );

  return (
    <form aria-busy={busy} className="grid gap-5" onSubmit={onSave}>
      <div
        className="flex items-start gap-3 rounded-lg bg-success/8 p-4 text-success-foreground"
        role="status"
      >
        <CheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="grid min-w-0 gap-1">
          <h5 className="font-medium text-sm">Access verified</h5>
          <p className="break-words text-xs leading-relaxed">
            {provider.name} accepted your credentials
            {account === null ? "." : ` for ${account}.`} Save the connection to
            finish and return to your integrations.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label className="text-sm" htmlFor="integration-name">
          Name this connection
        </Label>
        <Input
          aria-describedby={
            error
              ? "integration-name-help integration-error"
              : "integration-name-help"
          }
          className="min-h-11 sm:min-h-10"
          disabled={busy}
          id="integration-name"
          onChange={onChange}
          placeholder={defaultName}
          value={name}
        />
        <p
          className="text-muted-foreground text-xs leading-relaxed"
          id="integration-name-help"
        >
          You can change this name, or keep the suggested one.
        </p>
        <FlowError error={error} />
      </div>
      <Button
        className="min-h-11 justify-self-start sm:min-h-10"
        disabled={busy}
        type="submit"
      >
        {busy ? <Spinner /> : <CheckIcon />}
        {busy ? "Saving connection…" : "Save and return to integrations"}
      </Button>
    </form>
  );
}

function ConnectionRow({
  providerName,
  busy,
  connection,
  onCheck,
  onRemove,
  onToggleDisabled,
}: {
  busy: boolean;
  connection: Connection;
  providerName: string;
  onCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleDisabled: (id: string, disabled: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const onRecheck = useCallback(() => {
    onCheck(connection.id);
  }, [connection.id, onCheck]);

  const onFlip = useCallback(() => {
    onToggleDisabled(connection.id, !connection.disabled);
  }, [connection.disabled, connection.id, onToggleDisabled]);

  const onAskRemove = useCallback(() => {
    setConfirming(true);
  }, []);

  const onKeepIt = useCallback(() => {
    setConfirming(false);
  }, []);

  const onReallyRemove = useCallback(() => {
    setConfirming(false);
    onRemove(connection.id);
  }, [connection.id, onRemove]);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-background p-4 ring-1 ring-border/60">
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <ProviderIcon provider={connection.provider} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 break-words font-medium text-sm">
            {connection.name}
            <span className="font-normal text-muted-foreground text-xs">
              {providerName}
            </span>
          </p>
          <p className="mt-1 break-words text-muted-foreground text-xs leading-relaxed">
            {connection.account ?? "Account not known yet"}
          </p>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            {capabilitiesLabel(connection.capabilities)}
          </p>
          {connection.detail === null ? null : (
            <p className="break-words pt-1 text-muted-foreground text-xs">
              {connection.detail}
            </p>
          )}
        </div>

        <Badge
          variant={
            connection.disabled ? "outline" : STATE_VARIANTS[connection.state]
          }
        >
          {connection.disabled ? "Off" : STATE_LABELS[connection.state]}
        </Badge>
      </div>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 px-3 py-2">
          <p className="text-xs">
            Remove “{connection.name}”? Its key is deleted from {keyringName()}{" "}
            and the studio stops using it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="min-h-11 sm:min-h-10"
              onClick={onReallyRemove}
              size="sm"
              variant="destructive"
            >
              Remove
            </Button>
            <Button
              className="min-h-11 sm:min-h-10"
              onClick={onKeepIt}
              size="sm"
              variant="ghost"
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 sm:min-h-10"
            disabled={busy}
            onClick={onRecheck}
            size="sm"
            variant="outline"
          >
            {busy ? (
              <Spinner className="size-3.5" data-icon="inline-start" />
            ) : null}
            Check
          </Button>
          <Button
            className="min-h-11 sm:min-h-10"
            disabled={busy}
            onClick={onFlip}
            size="sm"
            variant="ghost"
          >
            {connection.disabled ? "Enable" : "Disable"}
          </Button>
          <Button
            className="min-h-11 sm:min-h-10"
            disabled={busy}
            onClick={onAskRemove}
            size="sm"
            variant="ghost"
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
