import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "github";

const providerNames: Record<Provider, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
};

/** Shows a button for each OAuth provider that this deployment turned on. */
export function SocialSignIn({ callbackURL }: { callbackURL: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const response = await fetch("/api/auth-config", { signal: controller.signal });
      const config: { providers: Provider[] } = await response.json();
      setProviders(config.providers);
    }
    load().catch(() => {
      // Email and password still work without the provider list.
    });
    return () => controller.abort();
  }, []);

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          onClick={() => void authClient.signIn.social({ provider, callbackURL })}
          type="button"
          variant="outline"
        >
          {providerNames[provider]}
        </Button>
      ))}
    </div>
  );
}
