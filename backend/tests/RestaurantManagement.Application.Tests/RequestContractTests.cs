using System.ComponentModel.DataAnnotations;
using RestaurantManagement.Application.Billing.Dtos;
using RestaurantManagement.Application.Orders.Dtos;
using RestaurantManagement.Domain.Payments;

namespace RestaurantManagement.Application.Tests;

/// <summary>
/// What the request contracts accept, and what they refuse before a service ever
/// sees them.
///
/// These bounds are business rules, not decoration: a quantity of zero, a
/// cancellation with no reason, or a tender that is not one of the three would each
/// produce a record the rest of the system cannot describe. The contracts refuse them
/// at the edge so no service has to.
/// </summary>
public class RequestContractTests
{
    /* ------------------------------------------------------------- Order lines */

    [Theory]
    [InlineData(OrderLimits.MinQuantity)]
    [InlineData(5)]
    [InlineData(OrderLimits.MaxQuantity)]
    public void A_quantity_inside_the_bounds_is_accepted(int quantity)
    {
        var request = new CreateOrderItemRequest
        {
            MenuItemId = Guid.NewGuid(),
            Quantity = quantity,
        };

        Assert.Empty(Validate(request));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(OrderLimits.MaxQuantity + 1)]
    public void A_quantity_outside_the_bounds_is_refused(int quantity)
    {
        var request = new CreateOrderItemRequest
        {
            MenuItemId = Guid.NewGuid(),
            Quantity = quantity,
        };

        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(CreateOrderItemRequest.Quantity)));
    }

    [Fact]
    public void A_note_longer_than_the_limit_is_refused()
    {
        var request = new CreateOrderItemRequest
        {
            MenuItemId = Guid.NewGuid(),
            Quantity = 1,
            Note = new string('x', OrderLimits.MaxNoteLength + 1),
        };

        // The column is sized to this, so a longer note would be truncated on its way
        // to the kitchen. Refusing beats silently changing what the guest asked for.
        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(CreateOrderItemRequest.Note)));
    }

    [Fact]
    public void A_note_at_exactly_the_limit_is_accepted()
    {
        var request = new CreateOrderItemRequest
        {
            MenuItemId = Guid.NewGuid(),
            Quantity = 1,
            Note = new string('x', OrderLimits.MaxNoteLength),
        };

        Assert.Empty(Validate(request));
    }

    [Fact]
    public void An_update_line_is_bounded_the_same_way_as_a_new_one()
    {
        var request = new UpdateOrderLineRequest
        {
            Id = Guid.NewGuid(),
            Quantity = OrderLimits.MaxQuantity + 1,
        };

        // The two paths must agree. A line that could be created at 99 but edited to
        // 200 would let the bound be walked around in two steps.
        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(UpdateOrderLineRequest.Quantity)));
    }

    /* ---------------------------------------------------------------- Payments */

    [Theory]
    [InlineData(PaymentMethod.Cash)]
    [InlineData(PaymentMethod.Card)]
    [InlineData(PaymentMethod.Digital)]
    public void Each_real_tender_is_accepted(PaymentMethod method)
    {
        var request = new RecordPaymentRequest { Method = method };

        Assert.Empty(Validate(request));
    }

    [Fact]
    public void A_tender_that_is_not_one_of_the_three_is_refused()
    {
        // An enum in C# will hold any integer, so without the EnumDataType check an
        // unrecognised value would be stored and then read back as nothing at all.
        var request = new RecordPaymentRequest { Method = (PaymentMethod)99 };

        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(RecordPaymentRequest.Method)));
    }

    [Fact]
    public void The_payment_request_carries_no_amount_at_all()
    {
        // The rule this protects is that a client cannot decide what a table paid.
        // It is enforced by the shape of the contract rather than by a check, so the
        // test asserts the shape: no property here may look like a money field.
        var moneyish = typeof(RecordPaymentRequest)
            .GetProperties()
            .Where(property =>
                property.Name.Contains("amount", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("total", StringComparison.OrdinalIgnoreCase) ||
                property.PropertyType == typeof(decimal) ||
                property.PropertyType == typeof(decimal?))
            .ToList();

        Assert.Empty(moneyish);
    }

    /* ----------------------------------------------------------- Cancellations */

    [Fact]
    public void A_cancellation_reason_is_required()
    {
        var request = new CancelOrderRequest { Reason = string.Empty };

        // A cancelled order with no explanation is the gap the whole state exists to
        // close, so the contract will not let one through.
        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(CancelOrderRequest.Reason)));
    }

    [Theory]
    [InlineData("no")]
    [InlineData("x")]
    public void A_reason_shorter_than_the_minimum_is_refused(string reason)
    {
        var request = new CancelOrderRequest { Reason = reason };

        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(CancelOrderRequest.Reason)));
    }

    [Fact]
    public void A_reason_longer_than_the_limit_is_refused()
    {
        var request = new CancelOrderRequest { Reason = new string('x', 201) };

        Assert.Contains(
            Validate(request),
            result => result.MemberNames.Contains(nameof(CancelOrderRequest.Reason)));
    }

    [Fact]
    public void A_real_sentence_is_accepted_as_a_reason()
    {
        var request = new CancelOrderRequest
        {
            Reason = "Guests left before the food arrived.",
        };

        Assert.Empty(Validate(request));
    }

    /* ------------------------------------------------------------------ Helper */

    /// <summary>
    /// Runs the same annotation validation the API model binder runs, so these tests
    /// exercise the real gate rather than a copy of its rules.
    /// </summary>
    private static List<ValidationResult> Validate(object request)
    {
        var results = new List<ValidationResult>();

        Validator.TryValidateObject(
            request,
            new ValidationContext(request),
            results,
            validateAllProperties: true);

        return results;
    }
}
