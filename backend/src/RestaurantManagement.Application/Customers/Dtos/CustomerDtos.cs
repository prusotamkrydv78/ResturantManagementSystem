using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Reservations;

namespace RestaurantManagement.Application.Customers.Dtos;

/// <summary>
/// Somebody the restaurant knows.
///
/// Carries the counts behind the two things that make a customer undeletable, so a
/// manager can see what archiving would preserve.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What to call them.</param>
/// <param name="Phone">How they are found. Unique within the restaurant when given.</param>
/// <param name="Email">Optional. Nothing is ever sent to it.</param>
/// <param name="Notes">Anything worth remembering.</param>
/// <param name="IsActive">Whether they are still on the books.</param>
/// <param name="OrderCount">Orders raised against them.</param>
/// <param name="ReservationCount">Bookings taken for them.</param>
/// <param name="LastVisitAtUtc">When they were last in, if they ever have been.</param>
/// <param name="CreatedAtUtc">When first recorded.</param>
/// <param name="UpdatedAtUtc">When last changed.</param>
public sealed record CustomerResponse(
    Guid Id,
    string Name,
    string? Phone,
    string? Email,
    string? Notes,
    bool IsActive,
    int OrderCount,
    int ReservationCount,
    DateTimeOffset? LastVisitAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

/// <summary>One order a customer has had, for their history.</summary>
/// <param name="Id">Identifier, so a row can link to the order.</param>
/// <param name="OrderNumber">Readable number.</param>
/// <param name="Status">Where it ended up.</param>
/// <param name="TableName">Where they sat.</param>
/// <param name="Subtotal">What it came to.</param>
/// <param name="ItemCount">Units on it.</param>
/// <param name="CreatedAtUtc">When it was placed.</param>
public sealed record CustomerOrderResponse(
    Guid Id,
    int OrderNumber,
    OrderStatus Status,
    string TableName,
    decimal Subtotal,
    int ItemCount,
    DateTimeOffset CreatedAtUtc);

/// <summary>One booking a customer has had, for their history.</summary>
/// <param name="Id">Identifier.</param>
/// <param name="ReservedForUtc">When they were expected.</param>
/// <param name="GuestCount">How many.</param>
/// <param name="TableName">Which table, if one was set aside.</param>
/// <param name="Status">Where the booking ended up.</param>
public sealed record CustomerReservationResponse(
    Guid Id,
    DateTimeOffset ReservedForUtc,
    int GuestCount,
    string? TableName,
    ReservationStatus Status);

/// <summary>
/// A customer with what they have done.
///
/// Both histories are bounded rather than paged, which matches every other list in this
/// product.
/// </summary>
/// <param name="Customer">The customer.</param>
/// <param name="Orders">Their orders, newest first.</param>
/// <param name="Reservations">Their bookings, newest first.</param>
public sealed record CustomerDetailResponse(
    CustomerResponse Customer,
    IReadOnlyList<CustomerOrderResponse> Orders,
    IReadOnlyList<CustomerReservationResponse> Reservations);

/// <summary>
/// Payload for recording a customer.
///
/// There is no restaurant field: the customer is placed in the restaurant of the
/// authenticated manager.
/// </summary>
public sealed class CreateCustomerRequest
{
    /// <summary>What to call them.</summary>
    [Required(ErrorMessage = "Enter the customer name.")]
    [StringLength(
        Customer.MaxNameLength,
        MinimumLength = 1,
        ErrorMessage = "The name cannot be longer than 120 characters.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// How to reach them. Optional, because a walk-in who gave only a name is still
    /// worth recording, but unique within the restaurant when given.
    /// </summary>
    [StringLength(
        Customer.MaxPhoneLength,
        ErrorMessage = "A phone number cannot be longer than 32 characters.")]
    public string? Phone { get; set; }

    /// <summary>Optional email.</summary>
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(
        Customer.MaxEmailLength,
        ErrorMessage = "An email cannot be longer than 256 characters.")]
    public string? Email { get; set; }

    /// <summary>Anything worth remembering: a usual table, an allergy, a preference.</summary>
    [StringLength(
        Customer.MaxNotesLength,
        ErrorMessage = "Notes cannot be longer than 500 characters.")]
    public string? Notes { get; set; }
}

/// <summary>Payload for editing a customer. The same fields; none is fixed.</summary>
public sealed class UpdateCustomerRequest
{
    /// <summary>What to call them.</summary>
    [Required(ErrorMessage = "Enter the customer name.")]
    [StringLength(Customer.MaxNameLength, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    /// <summary>How to reach them.</summary>
    [StringLength(Customer.MaxPhoneLength)]
    public string? Phone { get; set; }

    /// <summary>Optional email.</summary>
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(Customer.MaxEmailLength)]
    public string? Email { get; set; }

    /// <summary>Anything worth remembering.</summary>
    [StringLength(Customer.MaxNotesLength)]
    public string? Notes { get; set; }
}

/// <summary>Payload for taking a customer off the books, or putting them back.</summary>
public sealed class SetCustomerActiveRequest
{
    /// <summary>Whether they are still on the books.</summary>
    public bool IsActive { get; set; }
}
