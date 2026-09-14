"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { FormError } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RequireAuth } from "@/features/auth/require-auth";
import { listManagers } from "@/features/managers/api";
import { createRestaurant } from "@/features/restaurants/api";
import type { Manager } from "@/types/manager";
import type { CreateRestaurantPayload } from "@/types/restaurant";

/**
 * Create a restaurant and the manager who will run it, in one page.
 *
 * These used to be two steps: create the restaurant, then find its row and assign
 * somebody. A restaurant with nobody assigned cannot trade at all, so step one on its
 * own produced a record that was useless until somebody came back to it - and that is
 * where every abandoned half-setup began.
 *
 * The server takes both in one request and commits them together, so a rejected email
 * leaves nothing behind to tidy up.
 */
export default function NewRestaurantPage() {
  return (
    <RequireAuth roles={["SuperAdmin"]}>
      <NewRestaurant />
    </RequireAuth>
  );
}

/** How the restaurant gets its manager. */
type ManagerMode = "create" | "existing" | "later";

function NewRestaurant() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [mode, setMode] = useState<ManagerMode>("create");
  const [managerFullName, setManagerFullName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerId, setManagerId] = useState("");

  const [unassigned, setUnassigned] = useState<Manager[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only managers who run nothing can be offered: one manager runs one restaurant, so
  // listing the rest would be offering a choice the server refuses.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listManagers({ status: "Unassigned" });

        if (!cancelled) setUnassigned(loaded);
      } catch {
        // Not fatal. The other two ways of getting a manager still work, and the
        // select below says so rather than blocking the whole form.
        if (!cancelled) setUnassigned([]);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: CreateRestaurantPayload = {
      name: name.trim(),
      // Omitted rather than sent blank: an empty string fails the slug pattern and
      // the email validator, where an absent field means "derive it" or "no value".
      ...(slug.trim() === "" ? {} : { slug: slug.trim() }),
      ...(city.trim() === "" ? {} : { city: city.trim() }),
      ...(country.trim() === "" ? {} : { country: country.trim() }),
      ...(addressLine.trim() === "" ? {} : { addressLine: addressLine.trim() }),
      ...(contactEmail.trim() === "" ? {} : { contactEmail: contactEmail.trim() }),
      ...(contactPhone.trim() === "" ? {} : { contactPhone: contactPhone.trim() }),
      ...(mode === "create"
        ? {
            managerFullName: managerFullName.trim(),
            managerEmail: managerEmail.trim(),
            managerPassword,
          }
        : {}),
      ...(mode === "existing" ? { managerId } : {}),
    };

    try {
      await createRestaurant(payload);

      // Back to the list, which is where the new restaurant and its next steps are.
      router.push("/admin/restaurants");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create the restaurant.",
      );
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    name.trim().length >= 2 &&
    (mode === "later" ||
      (mode === "existing" && managerId !== "") ||
      (mode === "create" &&
        managerFullName.trim().length >= 2 &&
        managerEmail.trim() !== "" &&
        managerPassword !== ""));

  return (
    <>
      <PageHeader
        title="New restaurant"
        description="Create the restaurant and hand it to a manager in one step."
      />

      <PageBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error !== null && (
            <Surface>
              <div className="px-4 py-4">
                <FormError message={error} />
              </div>
            </Surface>
          )}

          <Surface>
            <SurfaceHeader
              title="The restaurant"
              description="Only the name is required. Everything else can be filled in later."
            />

            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field htmlFor="name" label="Name" required>
                  <Input
                    id="name"
                    required
                    minLength={2}
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>

                <Field
                  htmlFor="slug"
                  label="Slug"
                  hint="Lower-case letters, digits and single hyphens. Derived from the name when blank."
                >
                  <Input
                    id="slug"
                    placeholder="derived from name"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    aria-describedby={describedBy("slug", { hasHint: true })}
                  />
                </Field>
              </div>

              <Field htmlFor="addressLine" label="Address">
                <Input
                  id="addressLine"
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field htmlFor="city" label="City">
                  <Input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </Field>

                <Field htmlFor="country" label="Country">
                  <Input
                    id="country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  />
                </Field>

                <Field htmlFor="contactEmail" label="Contact email">
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                  />
                </Field>

                <Field htmlFor="contactPhone" label="Contact phone">
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Surface>

          <Surface>
            <SurfaceHeader
              title="Its manager"
              description="A restaurant with nobody assigned cannot trade, so this is part of setting one up rather than a later step."
            />

            <div className="flex flex-col gap-4 px-4 py-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">How to assign a manager</legend>

                <ModeOption
                  name="manager-mode"
                  checked={mode === "create"}
                  onSelect={() => setMode("create")}
                  title="Create a new manager account"
                  detail="They sign in with the email and password you set here."
                />

                <ModeOption
                  name="manager-mode"
                  checked={mode === "existing"}
                  onSelect={() => setMode("existing")}
                  title="Use an existing manager"
                  detail={
                    unassigned === null
                      ? "Loading accounts that run nothing yet…"
                      : unassigned.length === 0
                        ? "No manager accounts are free right now."
                        : `${unassigned.length} ${unassigned.length === 1 ? "account runs" : "accounts run"} nothing yet.`
                  }
                />

                <ModeOption
                  name="manager-mode"
                  checked={mode === "later"}
                  onSelect={() => setMode("later")}
                  title="Assign somebody later"
                  detail="The restaurant is created but cannot trade until it has a manager."
                />
              </fieldset>

              {mode === "create" && (
                <div className="flex flex-col gap-4 border-t border-border pt-4">
                  <Field htmlFor="managerFullName" label="Manager name" required>
                    <Input
                      id="managerFullName"
                      required
                      minLength={2}
                      value={managerFullName}
                      onChange={(event) => setManagerFullName(event.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field htmlFor="managerEmail" label="Manager email" required>
                      <Input
                        id="managerEmail"
                        type="email"
                        required
                        value={managerEmail}
                        onChange={(event) => setManagerEmail(event.target.value)}
                      />
                    </Field>

                    <Field
                      htmlFor="managerPassword"
                      label="Initial password"
                      required
                      hint="Tell it to them directly. Nothing emails it out."
                    >
                      <PasswordInput
                        id="managerPassword"
                        required
                        autoComplete="new-password"
                        value={managerPassword}
                        onChange={(event) => setManagerPassword(event.target.value)}
                        aria-describedby={describedBy("managerPassword", {
                          hasHint: true,
                        })}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {mode === "existing" && (
                <div className="border-t border-border pt-4">
                  <Field
                    htmlFor="managerId"
                    label="Manager"
                    required
                    hint="Only accounts that run no restaurant appear here: one manager runs one restaurant."
                  >
                    <Select
                      id="managerId"
                      value={managerId}
                      onChange={setManagerId}
                      aria-describedby={describedBy("managerId", { hasHint: true })}
                      options={[
                        { value: "", label: "Choose a manager" },
                        ...(unassigned ?? []).map((manager) => ({
                          value: manager.id,
                          label: `${manager.fullName} · ${manager.email}`,
                        })),
                      ]}
                    />
                  </Field>
                </div>
              )}
            </div>
          </Surface>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <LinkButton href="/admin/restaurants" variant="secondary">
              Cancel
            </LinkButton>
            <Button type="submit" icon={<Store />} disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Creating…" : "Create restaurant"}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  );
}

/** A radio presented as a selectable row, so the choice is easy to hit. */
function ModeOption({
  name,
  checked,
  onSelect,
  title,
  detail,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
        checked
          ? "border-primary-border bg-primary-soft"
          : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-3.5 shrink-0 accent-[var(--primary)]"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
    </label>
  );
}
