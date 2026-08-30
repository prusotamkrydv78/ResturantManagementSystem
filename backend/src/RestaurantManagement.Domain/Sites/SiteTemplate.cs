namespace RestaurantManagement.Domain.Sites;

/// <summary>
/// Which design a restaurant public page is drawn with.
///
/// A closed set rather than free-form markup, because the manager is choosing a
/// design and not authoring one: everything they can change is content, and the
/// structure is the platform's. That is what makes it safe to hand a page to
/// somebody with no HTML and no way to break the layout.
///
/// A template declares which parts of the content record it draws, so the designs
/// are genuinely different pages rather than skins on one. Switching is still
/// lossless - content a design does not draw is kept, not deleted - so a manager can
/// try all of them and lose nothing.
///
/// The numbers are stored, so they are permanent. 3 was Lantern, withdrawn because
/// it overlapped Aurora without doing anything Aurora does not do better. It must
/// not be reused, and a row still holding it is read as Aurora rather than migrated.
/// </summary>
public enum SiteTemplate
{
    /// <summary>
    /// Photographs first. A full-bleed hero under an overlapping details card,
    /// dishes as a rail of cards, a spotlight set into the corner of a picture, and
    /// a mosaic gallery. For a restaurant whose food is the argument.
    /// </summary>
    Aurora = 0,

    /// <summary>
    /// The dining-room page. Dark, type-led and the fullest of the set: a menu in
    /// courses, the chef, awards, a dish of the moment and private dining.
    /// </summary>
    Slate = 1,

    /// <summary>
    /// A story told in bands. Paper ground, serif setting, text and picture
    /// alternating side down the page. Carries the chef and the celebrations block;
    /// suits family restaurants and anywhere with a story to tell.
    /// </summary>
    Terrace = 2,

    /// <summary>
    /// A printed menu on a page. Masthead, hairline rules, small caps, a narrow
    /// measure and a centred bill of fare. Deliberately the least featured of the
    /// set; suits fine dining and hotel restaurants.
    /// </summary>
    Press = 4,
}
