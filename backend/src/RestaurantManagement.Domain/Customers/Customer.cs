using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Domain.Customers;

/// <summary>
/// Somebody the restaurant knows.
///
/// Belongs to exactly one restaurant. Deliberately not an account: there is no
/// password, no sign-in and no self-service, because a guest never authenticates
/// anywhere in this product. This is a name a manager writes down so a reservation can
/// be put against it and a regular can be recognised.
///
/// Carries no loyalty balance, no address, no birthday and no marketing consent. None
/// of those exist here, and a column for each would imply they were being used.
/// </summary>
public class Customer
{
    /// <summary>Longest name accepted.</summary>
    public const int MaxNameLength = 120;

    /// <summary>Longest phone number accepted.</summary>
    public const int MaxPhoneLength = 32;

    /// <summary>Longest email accepted.</summary>
    public const int MaxEmailLength = 256;

    /// <summary>Longest note accepted.</summary>
    public const int MaxNotesLength = 500;

    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>The restaurant that knows them.</summary>
    public Guid RestaurantId { get; set; }

    /// <summary>Navigation to the owning restaurant.</summary>
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>What to call them.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// How to reach them, and in practice how they are found.
    ///
    /// Optional, because a walk-in who gave only a name is still worth recording. Unique
    /// within the restaurant when given, so two rows cannot claim the same number and
    /// leave a manager guessing which is the real one.
    /// </summary>
    public string? Phone { get; set; }

    /// <summary>Optional email. Nothing is ever sent to it.</summary>
    public string? Email { get; set; }

    /// <summary>Anything worth remembering: a usual table, an allergy, a preference.</summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Whether they are still on the books.
    ///
    /// Deactivated rather than deleted once they have any history, because an order or a
    /// reservation pointing at a row nobody can look up would lose the answer to who it
    /// was for.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>When they were first recorded.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When the record last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }
}
