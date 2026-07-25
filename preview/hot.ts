declare const module: {
  hot?: {
    check: (autoApply: boolean) => Promise<unknown[] | null>;
  };
};

export const HOT_PATH = "/__remocn/hot";

export function connectHotReload(): void {
  const source = new EventSource(HOT_PATH);

  source.addEventListener("rebuilt", () => {
    apply();
  });
}

function apply(): void {
  if (module.hot === undefined) {
    window.location.reload();
    return;
  }

  module.hot
    .check(true)
    .then((updated) => {
      if (updated === null || updated.length === 0) {
        window.location.reload();
      }
    })
    .catch(() => {
      window.location.reload();
    });
}
