import { type FormEvent, useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not sign in. Try again.");
      return;
    }
    onSignedIn();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        autoComplete="email"
        label="Email"
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        value={email}
      />
      <FormField
        autoComplete="current-password"
        label="Password"
        onChange={(event) => setPassword(event.target.value)}
        required
        type="password"
        value={password}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button disabled={pending} type="submit">
        Sign in
      </Button>
    </form>
  );
}
