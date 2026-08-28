using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Application.Billing.Dtos;

/// <summary>One line on a receipt, at the price it was actually charged.</summary>
/// <param name="ItemName">Name at the time of ordering.</param>
/// <param name="Quantity">How many.</param>
/// <param name="UnitPrice">Price at the time of ordering.</param>
/// <param name="LineTotal">Server-calculated line amount.</param>
/// <param name="Note">The guest instruction, when there was one.</param>
public sealed record ReceiptLineResponse(
    string ItemName,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    string? Note);

/// <summary>
/// A record of what a table was charged and how they paid.
///
/// Assembled from the order, its lines and its payment, and nothing else. There is no
/// receipt record in the database and deliberately none added: everything on here is
/// already stored, so a second copy could only ever disagree with the first. Asking
/// for the same receipt twice produces the same document rather than a new one.
///
/// Not an invoice. There is no tax, no discount, no service charge and no sequence of
/// its own, because none of those exist in this product. Calling it a receipt is the
/// honest name for a record of money already taken.
/// </summary>
/// <param name="RestaurantName">Who took the money.</param>
/// <param name="RestaurantAddressLine">Street, if the profile has one.</param>
/// <param name="RestaurantCity">City, if the profile has one.</param>
/// <param name="RestaurantCountry">Country, if the profile has one.</param>
/// <param name="RestaurantContactPhone">Phone, if the profile has one.</param>
/// <param name="RestaurantContactEmail">Email, if the profile has one.</param>
/// <param name="OrderNumber">The number staff said out loud.</param>
/// <param name="TableName">Where it was served.</param>
/// <param name="PlacedByName">The waiter who took the order.</param>
/// <param name="OpenedAtUtc">When the table opened.</param>
/// <param name="ClosedAtUtc">When the order was closed.</param>
/// <param name="Lines">What was charged, at the stored prices.</param>
/// <param name="ItemCount">Units in total.</param>
/// <param name="Total">
/// The sum of the lines. Equal to the amount taken, since nothing in this product can
/// make the two differ; both are shown because a receipt that only stated one would be
/// hiding the arithmetic.
/// </param>
/// <param name="PaymentMethod">How the money arrived.</param>
/// <param name="AmountPaid">What was taken, from the payment record.</param>
/// <param name="PaidAtUtc">When it was recorded.</param>
/// <param name="RecordedByName">The manager who took it.</param>
public sealed record ReceiptResponse(
    string RestaurantName,
    string? RestaurantAddressLine,
    string? RestaurantCity,
    string? RestaurantCountry,
    string? RestaurantContactPhone,
    string? RestaurantContactEmail,
    int OrderNumber,
    string TableName,
    string PlacedByName,
    DateTimeOffset OpenedAtUtc,
    DateTimeOffset ClosedAtUtc,
    IReadOnlyList<ReceiptLineResponse> Lines,
    int ItemCount,
    decimal Total,
    PaymentMethod PaymentMethod,
    decimal AmountPaid,
    DateTimeOffset PaidAtUtc,
    string RecordedByName);
