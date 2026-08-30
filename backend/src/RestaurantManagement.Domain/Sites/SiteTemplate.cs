namespace RestaurantManagement.Domain.Sites;

/// <summary>
/// Which design a restaurant public page is drawn with.
///
/// A closed set rather than free-form markup, because the manager is choosing a
/// design and not authoring one: everything they can change is content, and the
/// structure is the platform's. That is what makes it safe to hand a page to
/// somebody with no HTML and no way to break the layout.
///
/// Every template renders the same content record. Switching between them is
/// therefore lossless - a manager can try all five and lose nothing - and adding a
/// sixth costs one component rather than a migration.
/// </summary>
public enum SiteTemplate
{
    /// <summary>
    /// Warm and photographic. A full-bleed hero with the name over the picture,
    /// generous spacing, rounded corners. The safe default for a restaurant with
    /// good photographs.
    /// </summary>
    Aurora = 0,

    /// <summary>
    /// Dark and editorial. Type-led, restrained colour, photographs used sparingly
    /// as accents. Suits a place that wants to look expensive.
    /// </summary>
    Slate = 1,

    /// <summary>
    /// Rustic and split. Alternating text-and-image bands, serif headings, a paper
    /// ground. Suits family restaurants and anywhere with a story to tell.
    /// </summary>
    Terrace = 2,

    /// <summary>
    /// Bright and blocky. Strong colour fields, asymmetric layout, large numerals.
    /// Suits cafes, street food and anywhere aiming younger.
    /// </summary>
    Lantern = 3,

    /// <summary>
    /// Classical and centred. Ruled borders, small caps, a printed-menu feel.
    /// Suits fine dining and hotel restaurants.
    /// </summary>
    Press = 4,
}
