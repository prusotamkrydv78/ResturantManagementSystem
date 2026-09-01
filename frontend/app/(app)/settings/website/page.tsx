"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { Eye, ExternalLink, Globe, Pencil, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Surface, SurfaceHeader } from "@/components/ui/surface";
import { ErrorState, FormError, FormSuccess, Skeleton } from "@/components/ui/states";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { NoRestaurantAssigned } from "@/features/restaurants/no-restaurant";
import { ImageField } from "@/features/site/editor/image-field";
import { PreviewPane, type DeviceId } from "@/features/site/editor/preview-pane";
import { SectionNav } from "@/features/site/editor/section-nav";
import { type SiteFeature, supports } from "@/types/site-capabilities";
import { ListEditor } from "@/features/site/editor/list-editor";
import { SiteRenderer } from "@/features/site/templates";
import {
  getSite,
  listSiteImages,
  listSiteTemplates,
  saveSite,
  setSitePublished,
} from "@/features/site/api";
import { ApiError, isMissingRestaurant } from "@/lib/api/client";
import { emptySiteContent } from "@/types/site";
import type {
  Site,
  SiteContent,
  SiteImage,
  SiteTemplate,
  SiteTemplateOption,
} from "@/types/site";

/**
 * The restaurant's public website, as its manager builds it.
 *
 * Content only. The manager picks a design and fills it in; they cannot
 * move a section, add one, or write markup — which is exactly what makes this safe
 * to hand to somebody who has never built a page. Every field on this screen is
 * text, and the layout around it belongs to the template.
 *
 * Role is enforced by the settings layout, which wraps this.
 */
export default function WebsitePage() {
  const [site, setSite] = useState<Site | null>(null);
  const [templates, setTemplates] = useState<SiteTemplateOption[]>([]);
  const [images, setImages] = useState<SiteImage[]>([]);

  const [template, setTemplate] = useState<SiteTemplate>("Aurora");
  const [content, setContent] = useState<SiteContent>(emptySiteContent());

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missingRestaurant, setMissingRestaurant] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [device, setDevice] = useState<DeviceId>("desktop");
  const [focused, setFocused] = useState<string | null>(null);

  // The preview redraws a whole restaurant page, which is far more work than the
  // keystroke that caused it. Deferring it lets React paint the input first and
  // catch the preview up after, so typing never waits on a repaint of the page.
  const previewContent = useDeferredValue(content);
  const isPreviewStale = previewContent !== content;

  /** Scrolls the form to a section and points the preview at the same one. */
  const goToSection = useCallback((id: string) => {
    setFocused(id);
    document
      .getElementById("section-" + id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedSite, loadedTemplates, loadedImages] = await Promise.all([
          getSite(),
          listSiteTemplates(),
          listSiteImages(),
        ]);

        if (cancelled) return;

        setSite(loadedSite);
        setTemplate(loadedSite.template);
        setContent(loadedSite.content);
        setTemplates(loadedTemplates);
        setImages(loadedImages);
        setLoadError(null);
        setMissingRestaurant(false);
      } catch (caught) {
        if (cancelled) return;

        // A manager with no restaurant yet is a real state, not a failure.
        if (isMissingRestaurant(caught)) {
          setMissingRestaurant(true);
        } else {
          setLoadError(
            caught instanceof Error ? caught.message : "Unable to load your website.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /** Patches one top-level section, leaving the rest of the page alone. */
  const patch = useCallback(
    <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
      setContent((current) => ({ ...current, [key]: value }));
      setSavedAt(null);
    },
    [],
  );

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);

    try {
      const updated = await saveSite({ template, content });
      setSite(updated);
      setContent(updated.content);
      setSavedAt(Date.now());
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not save your website.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish(next: boolean) {
    setSaveError(null);
    setIsPublishing(true);

    try {
      // Saved first when publishing, so "publish" never puts an older version in
      // front of the public than the one on screen.
      if (next) {
        const saved = await saveSite({ template, content });
        setContent(saved.content);
      }

      setSite(await setSitePublished(next));
      setSavedAt(Date.now());
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : "Could not change whether the page is public.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function addImage(image: SiteImage) {
    setImages((current) => [image, ...current]);
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Website" crumbs={CRUMBS} />
        <PageBody>
          <Surface className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </Surface>
        </PageBody>
      </>
    );
  }

  if (missingRestaurant) {
    return (
      <>
        <PageHeader title="Website" crumbs={CRUMBS} />
        <PageBody>
          <NoRestaurantAssigned />
        </PageBody>
      </>
    );
  }

  if (loadError !== null || site === null) {
    return (
      <>
        <PageHeader title="Website" crumbs={CRUMBS} />
        <PageBody>
          <Surface>
            <ErrorState
              message={loadError ?? "Unable to load your website."}
              onRetry={() => {
                setIsLoading(true);
                setLoadError(null);
                setReloadKey((key) => key + 1);
              }}
            />
          </Surface>
        </PageBody>
      </>
    );
  }

  const publicPath = `/r/${site.slug}`;

  return (
    <>
      <PageHeader
        title="Website"
        description="A single page for your restaurant. You choose the design and write everything on it."
        crumbs={CRUMBS}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={site.isPublished ? "success" : "neutral"} dot>
              {site.isPublished ? "Live" : "Not published"}
            </Badge>

            <Button
              variant="secondary"
              size="sm"
              className="xl:hidden"
              icon={isPreviewing ? <Pencil /> : <Eye />}
              onClick={() => setIsPreviewing((current) => !current)}
            >
              {isPreviewing ? "Back to editing" : "Preview"}
            </Button>

            <Button size="sm" icon={<Save />} disabled={isSaving} onClick={() => void handleSave()}>
              {isSaving ? "Saving…" : "Save"}
            </Button>

            <Button
              variant={site.isPublished ? "secondary" : "primary"}
              size="sm"
              icon={<Globe />}
              disabled={isPublishing}
              onClick={() => void handlePublish(!site.isPublished)}
            >
              {isPublishing
                ? "Working…"
                : site.isPublished
                  ? "Take offline"
                  : "Publish"}
            </Button>
          </div>
        }
      />

      {/* Wider than the standard well, because this screen is three columns and
          the middle one is a form that still has to be comfortable to type in. */}
      <div className="mx-auto flex w-full max-w-[120rem] gap-6 px-4 py-5 sm:px-6">
        {/* The navigator, at the width where a third column stops crowding the
            form rather than at the width where it merely fits. */}
        <aside className="hidden w-52 shrink-0 2xl:block">
          <div className="sticky top-5">
            <SectionNav
              content={content}
              template={template}
              active={focused}
              onSelect={goToSection}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
        {saveError !== null && <FormError message={saveError} />}
        {savedAt !== null && saveError === null && (
          <FormSuccess message="Your website has been saved." />
        )}

        {site.isPublished && site.hasUnpublishedChanges && (
          <p className="rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning">
            You have saved changes that visitors cannot see yet. Publish again to put
            them live.
          </p>
        )}

        {/* The address, said plainly. A manager needs to know where their page is
            before they will believe it exists. */}
        <Surface className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-muted">Your page address</span>
            <span className="truncate font-mono text-sm text-text">{publicPath}</span>
          </div>
          <LinkButton
            href={publicPath}
            target="_blank"
            variant="secondary"
            size="sm"
            icon={<ExternalLink />}
          >
            {site.isPublished ? "Visit" : "Preview in a tab"}
          </LinkButton>
        </Surface>

        {isPreviewing ? (
          <Surface className="overflow-hidden p-0">
            {/* The real renderer, not an impression of it, so what is previewed is
                what a visitor gets. */}
            <SiteRenderer
              template={template}
              content={content}
              restaurantName={content.brand.name || site.slug}
            />
          </Surface>
        ) : (
          <>
            <Surface>
              <SurfaceHeader
                title="Design"
                description="Changes nothing you have written — try them all."
              />
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((option) => (
                  <button
                    key={option.template}
                    type="button"
                    onClick={() => {
                      setTemplate(option.template);
                      setSavedAt(null);
                    }}
                    aria-pressed={template === option.template}
                    className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                      template === option.template
                        ? "border-primary-border bg-primary-soft"
                        : "border-border hover:bg-surface-2"
                    }`}
                  >
                    <span className="text-sm font-semibold text-text">{option.name}</span>
                    <span className="text-xs text-muted">{option.description}</span>
                  </button>
                ))}
              </div>
            </Surface>

            <Section template={template} feature="brand" onFocus={setFocused} id="brand" title="Name and tagline" description="Shown in the header and footer">
              <Field htmlFor="brand-name" label="Restaurant name on the page">
                <Input
                  id="brand-name"
                  maxLength={80}
                  placeholder="Leave blank to use your registered name"
                  value={content.brand.name}
                  onChange={(event) =>
                    patch("brand", { ...content.brand, name: event.target.value })
                  }
                />
              </Field>
              <Field htmlFor="brand-tagline" label="Tagline">
                <Input
                  id="brand-tagline"
                  maxLength={120}
                  placeholder="Nepali home cooking since 1998"
                  value={content.brand.tagline}
                  onChange={(event) =>
                    patch("brand", { ...content.brand, tagline: event.target.value })
                  }
                />
              </Field>
            </Section>

            <Section template={template} feature="hero" onFocus={setFocused} id="hero" title="Hero" description="The first thing a visitor sees">
              <Field htmlFor="hero-eyebrow" label="Small text above the headline">
                <Input
                  id="hero-eyebrow"
                  maxLength={60}
                  placeholder="Kathmandu"
                  value={content.hero.eyebrow}
                  onChange={(event) =>
                    patch("hero", { ...content.hero, eyebrow: event.target.value })
                  }
                />
              </Field>
              <Field htmlFor="hero-headline" label="Headline">
                <Input
                  id="hero-headline"
                  maxLength={120}
                  placeholder="Food that tastes like home"
                  value={content.hero.headline}
                  onChange={(event) =>
                    patch("hero", { ...content.hero, headline: event.target.value })
                  }
                />
              </Field>
              <Field htmlFor="hero-body" label="A sentence or two under it">
                <Textarea
                  id="hero-body"
                  rows={3}
                  maxLength={400}
                  value={content.hero.body}
                  onChange={(event) =>
                    patch("hero", { ...content.hero, body: event.target.value })
                  }
                />
              </Field>
              <ImageField
                label="Hero image"
                value={content.hero.imageUrl}
                images={images}
                onUploaded={addImage}
                onChange={(url) => patch("hero", { ...content.hero, imageUrl: url })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="hero-primary-label" label="Main button text">
                  <Input
                    id="hero-primary-label"
                    maxLength={40}
                    placeholder="Book a table"
                    value={content.hero.primaryLabel}
                    onChange={(event) =>
                      patch("hero", { ...content.hero, primaryLabel: event.target.value })
                    }
                  />
                </Field>
                <Field
                  htmlFor="hero-primary-href"
                  label="Main button link"
                  hint="A web address, tel: or mailto:"
                >
                  <Input
                    id="hero-primary-href"
                    placeholder="tel:+9779800000000"
                    value={content.hero.primaryHref}
                    onChange={(event) =>
                      patch("hero", { ...content.hero, primaryHref: event.target.value })
                    }
                  />
                </Field>
                <Field htmlFor="hero-secondary-label" label="Second button text">
                  <Input
                    id="hero-secondary-label"
                    maxLength={40}
                    value={content.hero.secondaryLabel}
                    onChange={(event) =>
                      patch("hero", {
                        ...content.hero,
                        secondaryLabel: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field htmlFor="hero-secondary-href" label="Second button link">
                  <Input
                    id="hero-secondary-href"
                    value={content.hero.secondaryHref}
                    onChange={(event) =>
                      patch("hero", {
                        ...content.hero,
                        secondaryHref: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section
              template={template}
              feature="marquee"
              onFocus={setFocused}
              id="marquee"
              title="Accolades strip"
              description="A single line of short boasts, under the hero"
            >
              <ListEditor
                label="Line"
                addLabel="Add an accolade"
                emptyHint="Nothing here yet. A star, a guide listing, a year established."
                max={6}
                items={content.marquee.map((text) => ({ text }))}
                blank={() => ({ text: "" })}
                onChange={(next) => patch("marquee", next.map((entry) => entry.text))}
                renderRow={(entry, update) => (
                  <Input
                    aria-label="Accolade"
                    placeholder="Michelin Guide 2025"
                    maxLength={60}
                    value={entry.text}
                    onChange={(event) => update({ text: event.target.value })}
                  />
                )}
              />
            </Section>

            <Section template={template} feature="about" onFocus={setFocused} id="about" title="Your story" description="Who you are and why">
              <Field htmlFor="about-title" label="Heading">
                <Input
                  id="about-title"
                  maxLength={80}
                  placeholder="Our story"
                  value={content.about.title}
                  onChange={(event) =>
                    patch("about", { ...content.about, title: event.target.value })
                  }
                />
              </Field>
              <Field
                htmlFor="about-body"
                label="The story"
                hint="Leave a blank line between paragraphs."
              >
                <Textarea
                  id="about-body"
                  rows={7}
                  maxLength={2000}
                  value={content.about.body}
                  onChange={(event) =>
                    patch("about", { ...content.about, body: event.target.value })
                  }
                />
              </Field>
              <ImageField
                label="Photograph beside the story"
                value={content.about.imageUrl}
                images={images}
                onUploaded={addImage}
                onChange={(url) => patch("about", { ...content.about, imageUrl: url })}
              />
            </Section>

            <Section
              template={template}
              feature="chef"
              onFocus={setFocused}
              id="chef"
              title="The kitchen"
              description="Who cooks, and what they would say about it"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="chef-name" label="Name">
                  <Input
                    id="chef-name"
                    maxLength={80}
                    value={content.chef.name}
                    onChange={(event) =>
                      patch("chef", { ...content.chef, name: event.target.value })
                    }
                  />
                </Field>
                <Field htmlFor="chef-role" label="Role">
                  <Input
                    id="chef-role"
                    maxLength={60}
                    placeholder="Head chef"
                    value={content.chef.role}
                    onChange={(event) =>
                      patch("chef", { ...content.chef, role: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field
                htmlFor="chef-quote"
                label="A line they would say"
                hint="Set large, above the biography."
              >
                <Input
                  id="chef-quote"
                  maxLength={200}
                  value={content.chef.quote}
                  onChange={(event) =>
                    patch("chef", { ...content.chef, quote: event.target.value })
                  }
                />
              </Field>
              <Field
                htmlFor="chef-bio"
                label="Biography"
                hint="Leave a blank line between paragraphs."
              >
                <Textarea
                  id="chef-bio"
                  rows={5}
                  maxLength={1200}
                  value={content.chef.bio}
                  onChange={(event) =>
                    patch("chef", { ...content.chef, bio: event.target.value })
                  }
                />
              </Field>
              <ImageField
                label="Portrait"
                value={content.chef.imageUrl}
                images={images}
                onUploaded={addImage}
                onChange={(url) => patch("chef", { ...content.chef, imageUrl: url })}
              />
            </Section>

            <Section
              template={template}
              feature="menuGroups"
              onFocus={setFocused}
              id="menuGroups"
              title="Menu by course"
              description="Starters, mains, desserts - set in two columns"
            >
              <ListEditor
                label="Course"
                addLabel="Add a course"
                emptyHint="No courses yet. Add Starters, then the dishes on it."
                max={10}
                items={content.menuGroups}
                blank={() => ({ name: "", description: "", items: [] })}
                onChange={(next) => patch("menuGroups", next)}
                renderRow={(group, update) => (
                  <div className="flex flex-col gap-3">
                    <Input
                      aria-label="Course name"
                      placeholder="Starters"
                      maxLength={60}
                      value={group.name}
                      onChange={(event) => update({ name: event.target.value })}
                    />
                    <Input
                      aria-label="Course description"
                      placeholder="Optional line under the course name"
                      maxLength={160}
                      value={group.description}
                      onChange={(event) => update({ description: event.target.value })}
                    />

                    {/* A list inside a list. The course is what is ordered on the
                        page, and its dishes are ordered within it. */}
                    <div className="rounded-lg border border-border bg-surface p-3">
                      <ListEditor
                        label="Dish"
                        addLabel="Add a dish to this course"
                        emptyHint="No dishes on this course yet."
                        max={30}
                        items={group.items}
                        blank={() => ({
                          name: "",
                          description: "",
                          price: "",
                          imageUrl: "",
                        })}
                        onChange={(next) => update({ items: next })}
                        renderRow={(dish, updateDish) => (
                          <div className="flex flex-col gap-3">
                            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                              <Input
                                aria-label="Dish name"
                                placeholder="Seared scallops"
                                maxLength={80}
                                value={dish.name}
                                onChange={(event) =>
                                  updateDish({ name: event.target.value })
                                }
                              />
                              <Input
                                aria-label="Price"
                                placeholder="Rs 900"
                                maxLength={24}
                                value={dish.price}
                                onChange={(event) =>
                                  updateDish({ price: event.target.value })
                                }
                              />
                            </div>
                            <Input
                              aria-label="Dish description"
                              placeholder="Cauliflower, brown butter, capers"
                              maxLength={200}
                              value={dish.description}
                              onChange={(event) =>
                                updateDish({ description: event.target.value })
                              }
                            />
                          </div>
                        )}
                      />
                    </div>
                  </div>
                )}
              />
            </Section>

            <Section template={template} feature="dishes" onFocus={setFocused} id="dishes" title="Signature dishes" description="Shown as cards or a menu list">
              <ListEditor
                label="Dish"
                addLabel="Add a dish"
                emptyHint="No dishes yet. Add the three or four things people come for."
                items={content.dishes}
                blank={() => ({ name: "", description: "", price: "", imageUrl: "" })}
                onChange={(next) => patch("dishes", next)}
                renderRow={(dish, update) => (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                      <Input
                        aria-label="Dish name"
                        placeholder="Buff Momo"
                        maxLength={80}
                        value={dish.name}
                        onChange={(event) => update({ name: event.target.value })}
                      />
                      <Input
                        aria-label="Price"
                        placeholder="Rs 220"
                        maxLength={24}
                        value={dish.price}
                        onChange={(event) => update({ price: event.target.value })}
                      />
                    </div>
                    <Textarea
                      aria-label="Dish description"
                      rows={2}
                      maxLength={240}
                      placeholder="Steamed dumplings with tomato achar"
                      value={dish.description}
                      onChange={(event) => update({ description: event.target.value })}
                    />
                    <ImageField
                      label="Photograph"
                      value={dish.imageUrl}
                      images={images}
                      onUploaded={addImage}
                      onChange={(url) => update({ imageUrl: url })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section
              template={template}
              feature="spotlight"
              onFocus={setFocused}
              id="spotlight"
              title="Dish of the moment"
              description="One dish given a band of its own, with a large photograph"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="spot-eyebrow" label="Small text above it">
                  <Input
                    id="spot-eyebrow"
                    maxLength={40}
                    placeholder="This month"
                    value={content.spotlight.eyebrow}
                    onChange={(event) =>
                      patch("spotlight", {
                        ...content.spotlight,
                        eyebrow: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field htmlFor="spot-price" label="Price">
                  <Input
                    id="spot-price"
                    maxLength={24}
                    value={content.spotlight.price}
                    onChange={(event) =>
                      patch("spotlight", {
                        ...content.spotlight,
                        price: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field htmlFor="spot-name" label="Dish">
                <Input
                  id="spot-name"
                  maxLength={80}
                  value={content.spotlight.name}
                  onChange={(event) =>
                    patch("spotlight", { ...content.spotlight, name: event.target.value })
                  }
                />
              </Field>
              <Field htmlFor="spot-description" label="Why it is worth a whole section">
                <Textarea
                  id="spot-description"
                  rows={3}
                  maxLength={400}
                  value={content.spotlight.description}
                  onChange={(event) =>
                    patch("spotlight", {
                      ...content.spotlight,
                      description: event.target.value,
                    })
                  }
                />
              </Field>
              <ImageField
                label="Photograph"
                value={content.spotlight.imageUrl}
                images={images}
                onUploaded={addImage}
                onChange={(url) =>
                  patch("spotlight", { ...content.spotlight, imageUrl: url })
                }
              />
            </Section>

            <Section template={template} feature="features" onFocus={setFocused} id="features" title="Why visit" description="Three short reasons, at most">
              <ListEditor
                label="Reason"
                addLabel="Add a reason"
                emptyHint="Nothing here yet. Parking, live music, a garden — whatever sets you apart."
                max={6}
                items={content.features}
                blank={() => ({ title: "", description: "" })}
                onChange={(next) => patch("features", next)}
                renderRow={(feature, update) => (
                  <div className="flex flex-col gap-3">
                    <Input
                      aria-label="Reason title"
                      placeholder="Rooftop seating"
                      maxLength={60}
                      value={feature.title}
                      onChange={(event) => update({ title: event.target.value })}
                    />
                    <Input
                      aria-label="Reason description"
                      placeholder="Views over the valley at sunset"
                      maxLength={160}
                      value={feature.description}
                      onChange={(event) => update({ description: event.target.value })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section
              template={template}
              feature="awards"
              onFocus={setFocused}
              id="awards"
              title="Awards"
              description="Prizes and listings, shown as a row of figures"
            >
              <ListEditor
                label="Award"
                addLabel="Add an award"
                emptyHint="Nothing here yet."
                max={8}
                items={content.awards}
                blank={() => ({ title: "", source: "", year: "" })}
                onChange={(next) => patch("awards", next)}
                renderRow={(award, update) => (
                  <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr]">
                    <Input
                      aria-label="Year"
                      placeholder="2025"
                      maxLength={10}
                      value={award.year}
                      onChange={(event) => update({ year: event.target.value })}
                    />
                    <Input
                      aria-label="Award"
                      placeholder="One star"
                      maxLength={60}
                      value={award.title}
                      onChange={(event) => update({ title: event.target.value })}
                    />
                    <Input
                      aria-label="Awarded by"
                      placeholder="Michelin Guide"
                      maxLength={60}
                      value={award.source}
                      onChange={(event) => update({ source: event.target.value })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section template={template} feature="gallery" onFocus={setFocused} id="gallery" title="Gallery" description="Photographs of the room and the food">
              <ListEditor
                label="Photo"
                addLabel="Add a photo"
                emptyHint="No photographs yet."
                items={content.gallery}
                blank={() => ({ imageUrl: "", caption: "" })}
                onChange={(next) => patch("gallery", next)}
                renderRow={(image, update) => (
                  <div className="flex flex-col gap-3">
                    <ImageField
                      label="Photograph"
                      value={image.imageUrl}
                      images={images}
                      onUploaded={addImage}
                      onChange={(url) => update({ imageUrl: url })}
                    />
                    <Input
                      aria-label="Caption"
                      placeholder="Describe the photo — this is also read aloud to blind visitors"
                      maxLength={120}
                      value={image.caption}
                      onChange={(event) => update({ caption: event.target.value })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section
              template={template}
              feature="events"
              onFocus={setFocused}
              id="events"
              title="Events and private dining"
              description="What the room is also for: parties, functions, whole buyouts. Slate heads this section “Private dining” and Terrace heads it “Celebrations”."
            >
              <Field htmlFor="events-title" label="Heading">
                <Input
                  id="events-title"
                  maxLength={80}
                  placeholder="Private dining"
                  value={content.events.title}
                  onChange={(event) =>
                    patch("events", { ...content.events, title: event.target.value })
                  }
                />
              </Field>
              <Field
                htmlFor="events-body"
                label="What is on offer"
                hint="Leave a blank line between paragraphs."
              >
                <Textarea
                  id="events-body"
                  rows={4}
                  maxLength={900}
                  value={content.events.body}
                  onChange={(event) =>
                    patch("events", { ...content.events, body: event.target.value })
                  }
                />
              </Field>
              <ImageField
                label="Photograph of the space"
                value={content.events.imageUrl}
                images={images}
                onUploaded={addImage}
                onChange={(url) => patch("events", { ...content.events, imageUrl: url })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="events-label" label="Button text">
                  <Input
                    id="events-label"
                    maxLength={40}
                    placeholder="Enquire"
                    value={content.events.buttonLabel}
                    onChange={(event) =>
                      patch("events", {
                        ...content.events,
                        buttonLabel: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field htmlFor="events-href" label="Where enquiries go">
                  <Input
                    id="events-href"
                    placeholder="mailto:events@example.com"
                    value={content.events.buttonHref}
                    onChange={(event) =>
                      patch("events", {
                        ...content.events,
                        buttonHref: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section template={template} feature="hours" onFocus={setFocused} id="hours" title="Opening hours" description="One line per group of days">
              <ListEditor
                label="Row"
                addLabel="Add a row"
                emptyHint="No hours listed yet."
                max={10}
                items={content.hours}
                blank={() => ({ label: "", value: "" })}
                onChange={(next) => patch("hours", next)}
                renderRow={(row, update) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Days"
                      placeholder="Sunday – Friday"
                      maxLength={40}
                      value={row.label}
                      onChange={(event) => update({ label: event.target.value })}
                    />
                    <Input
                      aria-label="Times"
                      placeholder="11:00 – 22:00"
                      maxLength={40}
                      value={row.value}
                      onChange={(event) => update({ value: event.target.value })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section template={template} feature="testimonials" onFocus={setFocused} id="testimonials" title="What guests say" description="Quotes, in their words">
              <ListEditor
                label="Quote"
                addLabel="Add a quote"
                emptyHint="No quotes yet."
                max={8}
                items={content.testimonials}
                blank={() => ({ quote: "", author: "" })}
                onChange={(next) => patch("testimonials", next)}
                renderRow={(quote, update) => (
                  <div className="flex flex-col gap-3">
                    <Textarea
                      aria-label="Quote"
                      rows={2}
                      maxLength={300}
                      value={quote.quote}
                      onChange={(event) => update({ quote: event.target.value })}
                    />
                    <Input
                      aria-label="Who said it"
                      placeholder="Sita R."
                      maxLength={60}
                      value={quote.author}
                      onChange={(event) => update({ author: event.target.value })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section template={template} feature="contact" onFocus={setFocused} id="contact" title="Find us" description="How a guest reaches you">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="contact-address" label="Address">
                  <Input
                    id="contact-address"
                    maxLength={160}
                    value={content.contact.addressLine}
                    onChange={(event) =>
                      patch("contact", {
                        ...content.contact,
                        addressLine: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field htmlFor="contact-city" label="City">
                  <Input
                    id="contact-city"
                    maxLength={80}
                    value={content.contact.city}
                    onChange={(event) =>
                      patch("contact", { ...content.contact, city: event.target.value })
                    }
                  />
                </Field>
                <Field htmlFor="contact-phone" label="Telephone">
                  <Input
                    id="contact-phone"
                    maxLength={40}
                    value={content.contact.phone}
                    onChange={(event) =>
                      patch("contact", { ...content.contact, phone: event.target.value })
                    }
                  />
                </Field>
                <Field htmlFor="contact-email" label="Email">
                  <Input
                    id="contact-email"
                    type="email"
                    maxLength={160}
                    value={content.contact.email}
                    onChange={(event) =>
                      patch("contact", { ...content.contact, email: event.target.value })
                    }
                  />
                </Field>
                <Field htmlFor="contact-map" label="Map link" hint="A Google Maps link">
                  <Input
                    id="contact-map"
                    value={content.contact.mapUrl}
                    onChange={(event) =>
                      patch("contact", { ...content.contact, mapUrl: event.target.value })
                    }
                  />
                </Field>
                <Field htmlFor="contact-booking" label="Booking link">
                  <Input
                    id="contact-booking"
                    value={content.contact.bookingUrl}
                    onChange={(event) =>
                      patch("contact", {
                        ...content.contact,
                        bookingUrl: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section template={template} feature="cta" onFocus={setFocused} id="cta" title="Closing invitation" description="The band above the footer">
              <Field htmlFor="cta-title" label="Heading">
                <Input
                  id="cta-title"
                  maxLength={100}
                  placeholder="Come and eat with us"
                  value={content.callToAction.title}
                  onChange={(event) =>
                    patch("callToAction", {
                      ...content.callToAction,
                      title: event.target.value,
                    })
                  }
                />
              </Field>
              <Field htmlFor="cta-body" label="A line under it">
                <Input
                  id="cta-body"
                  maxLength={200}
                  value={content.callToAction.body}
                  onChange={(event) =>
                    patch("callToAction", {
                      ...content.callToAction,
                      body: event.target.value,
                    })
                  }
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field htmlFor="cta-label" label="Button text">
                  <Input
                    id="cta-label"
                    maxLength={40}
                    value={content.callToAction.buttonLabel}
                    onChange={(event) =>
                      patch("callToAction", {
                        ...content.callToAction,
                        buttonLabel: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field htmlFor="cta-href" label="Button link">
                  <Input
                    id="cta-href"
                    value={content.callToAction.buttonHref}
                    onChange={(event) =>
                      patch("callToAction", {
                        ...content.callToAction,
                        buttonHref: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section template={template} feature="footer" onFocus={setFocused} id="footer" title="Footer" description="The last line of the page">
              <Field htmlFor="footer-note" label="Small print">
                <Input
                  id="footer-note"
                  maxLength={160}
                  placeholder="© 2026 Janak Hotel"
                  value={content.footer.note}
                  onChange={(event) =>
                    patch("footer", { ...content.footer, note: event.target.value })
                  }
                />
              </Field>
              <ListEditor
                label="Link"
                addLabel="Add a link"
                emptyHint="No links yet. Facebook, Instagram, TripAdvisor."
                max={8}
                items={content.footer.links}
                blank={() => ({ label: "", url: "" })}
                onChange={(next) => patch("footer", { ...content.footer, links: next })}
                renderRow={(link, update) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Link text"
                      placeholder="Facebook"
                      maxLength={40}
                      value={link.label}
                      onChange={(event) => update({ label: event.target.value })}
                    />
                    <Input
                      aria-label="Link address"
                      placeholder="https://facebook.com/…"
                      value={link.url}
                      onChange={(event) => update({ url: event.target.value })}
                    />
                  </div>
                )}
              />
            </Section>

            <Section
              template={template}
              feature="seo"
              onFocus={setFocused}
              id="settings"
              title="Colour and search"
              description="One accent colour, and what search engines show"
            >
              <Field
                htmlFor="theme-accent"
                label="Accent colour"
                hint="A hex value such as #b45309. Leave blank to keep the design's own."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="theme-accent"
                    maxLength={7}
                    placeholder="#b45309"
                    value={content.theme.accent}
                    onChange={(event) => patch("theme", { accent: event.target.value })}
                  />
                  <input
                    type="color"
                    aria-label="Pick an accent colour"
                    className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-surface"
                    value={/^#[0-9a-fA-F]{6}$/.test(content.theme.accent)
                      ? content.theme.accent
                      : "#b45309"}
                    onChange={(event) => patch("theme", { accent: event.target.value })}
                  />
                </div>
              </Field>
              <Field htmlFor="seo-title" label="Title in search results">
                <Input
                  id="seo-title"
                  maxLength={70}
                  placeholder="Leave blank to use your restaurant name"
                  value={content.seo.title}
                  onChange={(event) =>
                    patch("seo", { ...content.seo, title: event.target.value })
                  }
                />
              </Field>
              <Field htmlFor="seo-description" label="Description in search results">
                <Textarea
                  id="seo-description"
                  rows={2}
                  maxLength={180}
                  value={content.seo.description}
                  onChange={(event) =>
                    patch("seo", { ...content.seo, description: event.target.value })
                  }
                />
              </Field>
            </Section>
          </>
        )}
        </div>

        {/* Sticky rather than a fixed pane, so the preview keeps its place while
            the form scrolls past it and no height has to be computed from the
            header. Hidden below xl: two columns in less than that leaves a form
            too narrow to write in, and the Preview button already covers it. */}
        <div className="hidden w-[34rem] shrink-0 xl:block 2xl:w-[42rem]">
          <div className="sticky top-5 h-[calc(100svh-2.5rem)]">
            <PreviewPane
              template={template}
              content={previewContent}
              restaurantName={previewContent.brand.name || site.slug}
              slug={site.slug}
              device={device}
              onDeviceChange={setDevice}
              focusedSection={focused}
              isStale={isPreviewStale}
            />
          </div>
        </div>
      </div>
    </>
  );
}

const CRUMBS = [
  { label: "Workspace", href: "/dashboard" },
  { label: "Settings", href: "/settings" },
  { label: "Website" },
];

/**
 * One block of the form, matching the section of the page it edits.
 *
 * Focusing anything inside it tells the page which section is being worked on,
 * which is what steers the preview. Focus rather than scroll position, because a
 * manager tabbing through the gallery fields means the gallery even if the page
 * has not moved, and a scroll-spy would fight the navigator every time it jumped.
 */
function Section({
  id,
  feature,
  template,
  title,
  description,
  onFocus,
  children,
}: {
  id: string;
  /** The capability a design must declare for this block to be offered. */
  feature: SiteFeature;
  template: SiteTemplate;
  title: string;
  description: string;
  onFocus: (id: string) => void;
  children: React.ReactNode;
}) {
  // Hidden rather than disabled. A manager on the cafe design has no use for
  // knowing a chef biography exists somewhere in the product, and a form full of
  // greyed-out blocks is a form mostly made of things you cannot do.
  if (!supports(template, feature)) {
    return null;
  }

  return (
    <Surface id={"section-" + id} onFocusCapture={() => onFocus(id)}>
      <SurfaceHeader title={title} description={description} />
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </Surface>
  );
}
