namespace RestaurantManagement.Application.Sites.Dtos;

/// <summary>
/// Everything on a restaurant's page that a manager can change.
///
/// One record for all five designs, but not one that every design uses all of. A
/// template declares which parts it can draw, and the editor shows a manager only
/// those; a dining room carries a menu in courses, a chef and a list of awards, and
/// a cafe page has no use for any of them.
///
/// Still one record rather than one per design, because that is what keeps switching
/// lossless. Content a design does not draw is kept, not discarded, so trying a
/// different look and going back costs nothing.
///
/// Every property has a default, so a record written by an older build - or a
/// half-filled one saved by a manager who stopped halfway - deserialises into the
/// current shape rather than failing. Empty is a legitimate state everywhere: the
/// templates drop a section they have no content for instead of rendering a heading
/// over nothing.
/// </summary>
/// <param name="Brand">Identity in the header and the footer.</param>
/// <param name="Hero">The first screen.</param>
/// <param name="About">The story section.</param>
/// <param name="Marquee">Short accolades, for designs that run a ticker.</param>
/// <param name="Dishes">Signature dishes, for designs that show a flat list.</param>
/// <param name="MenuGroups">The menu split into courses, for designs that carry one.</param>
/// <param name="Spotlight">One dish given a section of its own.</param>
/// <param name="Chef">The person behind the kitchen.</param>
/// <param name="Awards">Prizes and listings.</param>
/// <param name="Events">Private dining, or whatever the room is also for.</param>
/// <param name="Features">Short reasons to visit, shown as a row.</param>
/// <param name="Gallery">Photographs.</param>
/// <param name="Hours">Opening times, one row per line.</param>
/// <param name="Testimonials">What guests have said.</param>
/// <param name="Contact">How to find and reach the restaurant.</param>
/// <param name="CallToAction">The closing band above the footer.</param>
/// <param name="Footer">The last line of the page.</param>
/// <param name="Theme">The one colour a manager may set.</param>
/// <param name="Seo">What search engines and link previews show.</param>
public sealed record SiteContent(
    BrandContent Brand,
    HeroContent Hero,
    AboutContent About,
    IReadOnlyList<string> Marquee,
    IReadOnlyList<DishContent> Dishes,
    IReadOnlyList<MenuGroupContent> MenuGroups,
    SpotlightContent Spotlight,
    ChefContent Chef,
    IReadOnlyList<AwardContent> Awards,
    EventsContent Events,
    IReadOnlyList<FeatureContent> Features,
    IReadOnlyList<GalleryImageContent> Gallery,
    IReadOnlyList<HoursRowContent> Hours,
    IReadOnlyList<TestimonialContent> Testimonials,
    ContactContent Contact,
    CallToActionContent CallToAction,
    FooterContent Footer,
    ThemeContent Theme,
    SeoContent Seo)
{
    /// <summary>
    /// A page with nothing filled in.
    ///
    /// Used both for a site being created and as the floor under a stored record, so
    /// a missing property deserialises to empty rather than to null and no template
    /// has to guard every field it touches.
    /// </summary>
    public static SiteContent Empty() =>
        new(
            new BrandContent(string.Empty, string.Empty),
            new HeroContent(
                string.Empty, string.Empty, string.Empty, string.Empty,
                string.Empty, string.Empty, string.Empty, string.Empty),
            new AboutContent(string.Empty, string.Empty, string.Empty),
            // Marquee, Dishes, MenuGroups
            [],
            [],
            [],
            new SpotlightContent(
                string.Empty, string.Empty, string.Empty, string.Empty, string.Empty),
            new ChefContent(
                string.Empty, string.Empty, string.Empty, string.Empty, string.Empty),
            // Awards
            [],
            new EventsContent(
                string.Empty, string.Empty, string.Empty, string.Empty, string.Empty),
            // Features, Gallery, Hours, Testimonials
            [],
            [],
            [],
            [],
            new ContactContent(
                string.Empty, string.Empty, string.Empty,
                string.Empty, string.Empty, string.Empty),
            new CallToActionContent(
                string.Empty, string.Empty, string.Empty, string.Empty),
            new FooterContent(string.Empty, []),
            new ThemeContent(string.Empty),
            new SeoContent(string.Empty, string.Empty));

    /// <summary>
    /// Replaces anything missing with its empty form.
    ///
    /// A positional record deserialises through its constructor, so a property that
    /// is not in the stored JSON arrives as null rather than as an empty list. Every
    /// page written before a field existed is in exactly that state, and a template
    /// mapping over a null list is a crash rather than a missing section. This is the
    /// one place that has to know, so nothing downstream does.
    /// </summary>
    public SiteContent Normalised()
    {
        var empty = Empty();

        return new SiteContent(
            Brand ?? empty.Brand,
            Hero ?? empty.Hero,
            About ?? empty.About,
            Marquee ?? [],
            Dishes ?? [],
            MenuGroups ?? [],
            Spotlight ?? empty.Spotlight,
            Chef ?? empty.Chef,
            Awards ?? [],
            Events ?? empty.Events,
            Features ?? [],
            Gallery ?? [],
            Hours ?? [],
            Testimonials ?? [],
            Contact ?? empty.Contact,
            CallToAction ?? empty.CallToAction,
            Footer is null
                ? empty.Footer
                : Footer with { Links = Footer.Links ?? [] },
            Theme ?? empty.Theme,
            Seo ?? empty.Seo);
    }
}

/// <param name="Name">Shown in the header. Falls back to the restaurant name.</param>
/// <param name="Tagline">A few words under it.</param>
public sealed record BrandContent(string Name, string Tagline);

/// <param name="Eyebrow">Small text above the headline.</param>
/// <param name="Headline">The largest words on the page.</param>
/// <param name="Body">A sentence or two under the headline.</param>
/// <param name="ImageUrl">The backdrop. Templates fall back to colour without it.</param>
/// <param name="PrimaryLabel">Text on the main button. Blank hides the button.</param>
/// <param name="PrimaryHref">Where the main button goes.</param>
/// <param name="SecondaryLabel">Text on the quieter button. Blank hides it.</param>
/// <param name="SecondaryHref">Where the quieter button goes.</param>
public sealed record HeroContent(
    string Eyebrow,
    string Headline,
    string Body,
    string ImageUrl,
    string PrimaryLabel,
    string PrimaryHref,
    string SecondaryLabel,
    string SecondaryHref);

/// <param name="Title">Section heading.</param>
/// <param name="Body">The story. Blank lines separate paragraphs.</param>
/// <param name="ImageUrl">A photograph beside it.</param>
public sealed record AboutContent(string Title, string Body, string ImageUrl);

/// <param name="Name">The dish.</param>
/// <param name="Description">What is in it.</param>
/// <param name="Price">Shown as written, so a restaurant sets its own currency.</param>
/// <param name="ImageUrl">A photograph of it.</param>
public sealed record DishContent(
    string Name,
    string Description,
    string Price,
    string ImageUrl);

/// <param name="Title">A short reason to visit.</param>
/// <param name="Description">One line under it.</param>
public sealed record FeatureContent(string Title, string Description);

/// <param name="ImageUrl">The photograph.</param>
/// <param name="Caption">Also used as the alt text, so it is worth writing.</param>
public sealed record GalleryImageContent(string ImageUrl, string Caption);

/// <param name="Label">The days, as the restaurant says them.</param>
/// <param name="Value">The times, or a word like "Closed".</param>
public sealed record HoursRowContent(string Label, string Value);

/// <param name="Quote">What the guest said.</param>
/// <param name="Author">Who said it.</param>
public sealed record TestimonialContent(string Quote, string Author);

/// <param name="AddressLine">Street.</param>
/// <param name="City">Town or city.</param>
/// <param name="Phone">Rendered as a callable link.</param>
/// <param name="Email">Rendered as a mail link.</param>
/// <param name="MapUrl">A link to the restaurant on a map.</param>
/// <param name="BookingUrl">Where a guest books, if not by telephone.</param>
public sealed record ContactContent(
    string AddressLine,
    string City,
    string Phone,
    string Email,
    string MapUrl,
    string BookingUrl);

/// <param name="Title">The closing invitation.</param>
/// <param name="Body">A line under it.</param>
/// <param name="ButtonLabel">Blank hides the whole band.</param>
/// <param name="ButtonHref">Where the button goes.</param>
public sealed record CallToActionContent(
    string Title,
    string Body,
    string ButtonLabel,
    string ButtonHref);

/// <param name="Note">A line of small print.</param>
/// <param name="Links">Social or external links.</param>
public sealed record FooterContent(string Note, IReadOnlyList<FooterLinkContent> Links);

/// <param name="Label">What the link says.</param>
/// <param name="Url">Where it goes.</param>
public sealed record FooterLinkContent(string Label, string Url);

/// <summary>
/// The single design choice a manager gets beyond picking a template.
/// </summary>
/// <param name="Accent">
/// A hex colour such as "#b45309". Blank means the template keeps its own. Validated
/// on the way in, because it is interpolated into a style attribute and a value that
/// is not a colour has no business being there.
/// </param>
public sealed record ThemeContent(string Accent);

/// <param name="Title">The browser tab and the search result heading.</param>
/// <param name="Description">The line under it in a search result.</param>
public sealed record SeoContent(string Title, string Description);

/// <summary>
/// A course, and what is on it.
///
/// Separate from <see cref="DishContent"/> rather than replacing it, because the two
/// answer different designs. A cafe page wants four cards; a dining room wants
/// Starters, Mains and Desserts with a dozen lines under them, and flattening that
/// into one list loses the only structure a menu has.
/// </summary>
/// <param name="Name">The course.</param>
/// <param name="Description">An optional line under it.</param>
/// <param name="Items">The dishes on it.</param>
public sealed record MenuGroupContent(
    string Name,
    string Description,
    IReadOnlyList<DishContent> Items);

/// <summary>One dish given a section of its own.</summary>
/// <param name="Eyebrow">Small text above it, such as "This month".</param>
/// <param name="Name">The dish.</param>
/// <param name="Description">Why it is worth a whole section.</param>
/// <param name="Price">Shown as written.</param>
/// <param name="ImageUrl">A photograph, given real size.</param>
public sealed record SpotlightContent(
    string Eyebrow,
    string Name,
    string Description,
    string Price,
    string ImageUrl);

/// <summary>The person behind the kitchen.</summary>
/// <param name="Name">Their name.</param>
/// <param name="Role">Head chef, owner, whatever they are.</param>
/// <param name="Bio">A paragraph or two.</param>
/// <param name="ImageUrl">A portrait.</param>
/// <param name="Quote">Something they would say about the food.</param>
public sealed record ChefContent(
    string Name,
    string Role,
    string Bio,
    string ImageUrl,
    string Quote);

/// <summary>A prize, a listing, or a mention worth showing.</summary>
/// <param name="Title">What it was.</param>
/// <param name="Source">Who gave it.</param>
/// <param name="Year">When.</param>
public sealed record AwardContent(string Title, string Source, string Year);

/// <summary>What the room is also for: private dining, parties, functions.</summary>
/// <param name="Title">The heading.</param>
/// <param name="Body">What is on offer.</param>
/// <param name="ImageUrl">A photograph of the space.</param>
/// <param name="ButtonLabel">Blank hides the button.</param>
/// <param name="ButtonHref">Where enquiries go.</param>
public sealed record EventsContent(
    string Title,
    string Body,
    string ImageUrl,
    string ButtonLabel,
    string ButtonHref);
