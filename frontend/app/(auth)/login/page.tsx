"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Surface } from "@/components/ui/surface";
import { FormError } from "@/components/ui/states";
import { homeFor } from "@/components/layout/nav-config";
import { useAuth } from "@/features/auth/auth-context";

export default function LoginPage() {
  const { signIn, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Someone already signed in has no reason to see the sign-in form. Sent to their
  // own role home rather than to a fixed path, so a waiter who follows an old
  // bookmark lands somewhere they are allowed to be.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(homeFor(user?.platformRole, user?.staffRole));
    }
  }, [isAuthenticated, isLoading, router, user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // The signed-in user is returned rather than read from context, which has not
      // re-rendered yet at this point in the handler.
      const session = await signIn({ email, password });

      router.replace(homeFor(session.platformRole, session.staffRole));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasError = error !== null;

  return (
    <Surface className="p-5 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-text">Sign in</h1>
          <p className="text-sm text-muted">Continue to your workspace.</p>
        </div>

        {hasError && <FormError message={error} />}

        <Field htmlFor="email" label="Email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={hasError}
          />
        </Field>

        <Field htmlFor="password" label="Password" required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={hasError}
            aria-describedby={describedBy("password", { hasError })}
          />
        </Field>

        <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>

        {/* No sign-up link, because there is no sign-up. Accounts are issued: a
            platform administrator creates a restaurant and its manager, and that
            manager creates their own staff. Saying so here is kinder than leaving
            somebody hunting for a button that was never built. */}
        <p className="text-center text-sm text-muted">
          Accounts are issued by your restaurant administrator. Ask them if you do
          not have one yet.
        </p>
      </form>
    </Surface>
  );
}
