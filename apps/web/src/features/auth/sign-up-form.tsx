import { type FormEvent, useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignUpForm({ onSignedUp }: { onSignedUp: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not create the account. Try again.");
      return;
    }
    // With SMTP, the user must verify their email before a session exists.
    if (!result.data.token) {
      setCheckEmail(true);
      return;
    }
    onSignedUp();
  }

  if (checkEmail) {
    return <output>Check your email for a link to verify your address.</output>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        autoComplete="name"
        label="Name"
        onChange={(event) => setName(event.target.value)}
        required
        value={name}
      />
      <FormField
        autoComplete="email"
        label="Email"
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        value={email}
      />
      <FormField
        autoComplete="new-password"
        label="Password"
        minLength={8}
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
        Create account
      </Button>
    </form>
  );
}
