using RestaurantManagement.Application.Reports.Dtos;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Orders;

namespace RestaurantManagement.Application.Platform.Dtos;

/// <summary>
/// What one restaurant did over the range, as the platform sees it.
///
/// This used to carry the instants its own window opened and closed, because each
/// restaurant once read the range in its own timezone and two rows could genuinely
/// cover different absolute periods. That configuration is gone - one deployment, one
/// country, one day boundary - so every row carried the same two instants under a
/// column heading explaining a difference that no longer existed. Both are removed
/// rather than left to be misread.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What the restaurant is called.</param>
/// <param name="Slug">Its platform-wide handle.</param>
/// <param name="ManagerName">Who runs it, or null while nobody has been assigned.</param>
/// <param name="CompletedCount">Orders paid for and closed in the range.</param>
/// <param name="CancelledCount">Orders called off in the range.</param>
/// <param name="PaymentTotal">Everything taken.</param>
/// <param name="PreviousPaymentTotal">
/// What it took over the period of the same length immediately before this one, so a
/// row can be read as a movement rather than as a figure with nothing behind it.
/// </param>
/// <param name="AverageOrderValue">Payment total over payment count, or zero.</param>
public sealed record PlatformRestaurantRowResponse(
    Guid Id,
    string Name,
    string Slug,
    string? ManagerName,
    int CompletedCount,
    int CancelledCount,
    decimal PaymentTotal,
    decimal PreviousPaymentTotal,
    decimal AverageOrderValue);

/// <summary>
/// One service day inside a report range.
///
/// The spine of the whole screen. Without it a ninety-day report is four numbers and
/// a table, and no amount of arithmetic on four numbers will say which day something
/// broke.
/// </summary>
/// <param name="LocalDate">The service day.</param>
/// <param name="Bills">Orders settled that day.</param>
/// <param name="Takings">What those bills came to.</param>
/// <param name="Cancelled">Orders called off that day.</param>
/// <param name="CancelledValue">What the cancelled orders would have come to.</param>
public sealed record PlatformReportDayResponse(
    DateOnly LocalDate,
    int Bills,
    decimal Takings,
    int Cancelled,
    decimal CancelledValue);

/// <summary>
/// One day of the week, summed across the range.
///
/// Seven rows, always, in the order a week is spoken. A restaurant platform lives or
/// dies on the weekend, and a total over a month hides which end of it carried the
/// month.
/// </summary>
/// <param name="Weekday">Sunday through Saturday.</param>
/// <param name="Bills">Bills settled on that weekday across the range.</param>
/// <param name="Takings">What they came to.</param>
public sealed record PlatformWeekdayResponse(
    DayOfWeek Weekday,
    int Bills,
    decimal Takings);

/// <summary>
/// Why orders were called off, and what they were worth.
///
/// The product records a reason on every cancellation and has never shown one
/// anywhere. On a platform the useful signal is not the total - it is one reason
/// climbing at one restaurant.
/// </summary>
/// <param name="Reason">What the manager typed, or a stand-in when they typed nothing.</param>
/// <param name="Count">How many were called off for it.</param>
/// <param name="Value">What those orders would have come to. Never revenue.</param>
public sealed record PlatformCancellationReasonResponse(
    string Reason,
    int Count,
    decimal Value);

/// <summary>
/// The totals for a period, thin, so one period can be read against another.
///
/// Only the figures a headline compares. Everything else on the report describes the
/// range asked for; this describes the range before it, and exists to turn a number
/// into a direction.
/// </summary>
/// <param name="FromLocalDate">First day of the comparison period.</param>
/// <param name="ToLocalDate">Last day of it, inclusive.</param>
/// <param name="CompletedCount">Orders paid for and closed.</param>
/// <param name="CancelledCount">Orders called off.</param>
/// <param name="CancelledValue">
/// What those cancelled orders would have come to.
///
/// Carried even though the count is here too, because the screen compares money with
/// money. A card showing a value and an arrow measuring a count is a card that will
/// eventually say "down 50%" beside a figure that doubled.
/// </param>
/// <param name="PaymentTotal">Everything taken.</param>
/// <param name="PaymentCount">How many bills were settled.</param>
/// <param name="AverageOrderValue">Payment total over payment count, or zero.</param>
public sealed record PlatformPeriodResponse(
    DateOnly FromLocalDate,
    DateOnly ToLocalDate,
    int CompletedCount,
    int CancelledCount,
    decimal CancelledValue,
    decimal PaymentTotal,
    int PaymentCount,
    decimal AverageOrderValue);

/// <summary>
/// What the whole platform did over a range of days.
///
/// The one thing worth knowing about this figure before reading it: every restaurant
/// range is read in that restaurant own timezone and service day, so the platform total
/// is the sum of exactly what each manager sees on their own report. The alternative was
/// one absolute window for everybody, which would have produced a headline figure that
/// disagreed with every single manager. A number nobody can reconcile is worse than no
/// number.
///
/// Deliberately thin, for the same reasons the per-restaurant report is: no tax, no
/// cost, no margin, no comparison with another period. None of those exist in this
/// product.
/// </summary>
/// <param name="FromLocalDate">First day asked for.</param>
/// <param name="ToLocalDate">Last day asked for, inclusive.</param>
/// <param name="DayCount">How many days the range covers.</param>
/// <param name="RestaurantCount">Restaurants on the platform.</param>
/// <param name="WithoutManagerCount">
/// How many are still waiting for one. These cannot trade at all, which is why the
/// figure sits beside the takings rather than in a settings screen.
/// </param>
/// <param name="TradingCount">How many took at least one payment in the range.</param>
/// <param name="CompletedCount">Orders closed across the platform.</param>
/// <param name="CancelledCount">Orders called off across the platform.</param>
/// <param name="PaymentTotal">Everything taken, across every restaurant.</param>
/// <param name="PaymentCount">How many bills were settled.</param>
/// <param name="CancelledValue">
/// What the cancelled orders would have come to. Never added to the total, here or
/// anywhere else.
/// </param>
/// <param name="AverageOrderValue">Payment total over payment count, or zero.</param>
/// <param name="ByMethod">The total split by tender, every method listed even at zero.</param>
/// <param name="RestaurantsTotal">
/// How many restaurants exist, against how many this report covers. The two differ
/// only when the cap bites, and a report that silently truncates is worse than one
/// that says it did.
/// </param>
/// <param name="Previous">The period of the same length immediately before this one.</param>
/// <param name="Days">Every day in the range, oldest first, present even at zero.</param>
/// <param name="ByWeekday">The range summed into seven weekdays.</param>
/// <param name="Cancellations">Why orders were called off, heaviest first.</param>
/// <param name="Restaurants">One row per restaurant, busiest first.</param>
public sealed record PlatformReportResponse(
    DateOnly FromLocalDate,
    DateOnly ToLocalDate,
    int DayCount,
    int RestaurantCount,
    int WithoutManagerCount,
    int TradingCount,
    int CompletedCount,
    int CancelledCount,
    decimal PaymentTotal,
    int PaymentCount,
    decimal CancelledValue,
    decimal AverageOrderValue,
    IReadOnlyList<MethodTotalResponse> ByMethod,
    int RestaurantsTotal,
    PlatformPeriodResponse Previous,
    IReadOnlyList<PlatformReportDayResponse> Days,
    IReadOnlyList<PlatformWeekdayResponse> ByWeekday,
    IReadOnlyList<PlatformCancellationReasonResponse> Cancellations,
    IReadOnlyList<PlatformRestaurantRowResponse> Restaurants);


/// <summary>
/// One day of trading across the whole estate.
/// </summary>
/// <param name="OrdersPlaced">Orders opened during the day, whatever became of them.</param>
/// <param name="Completed">Orders paid for and closed.</param>
/// <param name="Cancelled">Orders called off.</param>
/// <param name="Takings">Everything taken in payments.</param>
/// <param name="AverageOrderValue">Takings over the number of payments, or zero.</param>
public sealed record PlatformDayResponse(
    int OrdersPlaced,
    int Completed,
    int Cancelled,
    decimal Takings,
    decimal AverageOrderValue);

/// <summary>
/// One restaurant, as a platform operator needs to see it during a service.
/// </summary>
/// <param name="LastOrderAtUtc">
/// When this restaurant last opened an order, or null if it never has.
///
/// The single most useful number on this screen, and the one nobody else can see. A
/// restaurant that has taken nothing for three days is either losing its custom or has
/// a broken install, and both are the platform problem rather than the manager - the
/// manager is not looking at a screen that would tell them.
/// </param>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What the restaurant is called.</param>
/// <param name="Slug">Its handle.</param>
/// <param name="IsActive">Whether it is switched on.</param>
/// <param name="HasManager">Whether anybody has been put in charge of it.</param>
/// <param name="OrdersToday">Orders it opened during the service day.</param>
/// <param name="TakingsToday">What it took during the service day.</param>
/// <param name="OpenOrders">Orders running right now, so a quiet day can be told from a closed one.</param>
/// <param name="PlatesAtPass">Dishes cooked and not yet carried, across the restaurant.</param>
public sealed record PlatformPulseRestaurantResponse(
    Guid Id,
    string Name,
    string Slug,
    bool IsActive,
    bool HasManager,
    int OrdersToday,
    decimal TakingsToday,
    int OpenOrders,
    int PlatesAtPass,
    DateTimeOffset? LastOrderAtUtc);

/// <summary>
/// One service day on the trend line.
/// </summary>
/// <param name="LocalDate">The day, in the one calendar this product has.</param>
/// <param name="OrdersPlaced">Orders opened that day, whatever became of them.</param>
/// <param name="Completed">Orders paid for and closed.</param>
/// <param name="Cancelled">Orders called off.</param>
/// <param name="Takings">Everything taken in payments that day.</param>
public sealed record PlatformTrendDayResponse(
    DateOnly LocalDate,
    int OrdersPlaced,
    int Completed,
    int Cancelled,
    decimal Takings);

/// <summary>
/// One hour of the service day now running.
///
/// Every hour is sent, including the ones still in the future, so a chart drawing this
/// has the shape of a whole day from the moment it opens rather than growing a new
/// column every sixty minutes.
/// </summary>
/// <param name="Hour">Local hour, 0 to 23.</param>
/// <param name="OrdersPlaced">Orders opened in that hour.</param>
/// <param name="Takings">Payments recorded in that hour.</param>
public sealed record PlatformHourResponse(
    int Hour,
    int OrdersPlaced,
    decimal Takings);

/// <summary>
/// What the estate is doing right now, and what it did today against yesterday.
///
/// Separate from the report, which answers a date range a person chose, and from the
/// overview, which answers how the estate is configured. This answers the question an
/// operator has every morning and cannot currently ask: is everything trading.
/// </summary>
/// <param name="LocalDate">The service day these figures cover.</param>
/// <param name="ServerUtcNow">
/// The server clock. Sent so a reader can tell a restaurant configured oddly from a
/// machine whose own clock has drifted.
/// </param>
/// <param name="Today">The service day so far.</param>
/// <param name="Yesterday">The same day before, whole, to read today against.</param>
/// <param name="OpenOrders">Orders running right now, across the estate.</param>
/// <param name="PlatesAtPass">Dishes cooked and not yet carried, across the estate.</param>
/// <param name="TradingToday">Restaurants that have opened at least one order today.</param>
/// <param name="Days">
/// The last week, oldest first, every day present even at zero. A gap in a chart
/// reads as missing data rather than as a day nobody ate out.
///
/// A week and not a month: anything longer is a question for the report, which takes
/// the range somebody actually wants and can compare it with the one before.
/// </param>
/// <param name="Hours">Today, hour by hour, all twenty-four.</param>
/// <param name="ByMethodToday">Today split by tender, every method listed even at zero.</param>
/// <param name="Restaurants">One row per restaurant, by name.</param>
public sealed record PlatformPulseResponse(
    DateOnly LocalDate,
    DateTimeOffset ServerUtcNow,
    PlatformDayResponse Today,
    PlatformDayResponse Yesterday,
    int OpenOrders,
    int PlatesAtPass,
    int TradingToday,
    IReadOnlyList<PlatformTrendDayResponse> Days,
    IReadOnlyList<PlatformHourResponse> Hours,
    IReadOnlyList<MethodTotalResponse> ByMethodToday,
    IReadOnlyList<PlatformPulseRestaurantResponse> Restaurants);

/// <summary>
/// Somebody who works at one restaurant, as the platform lists them.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="FullName">Their name.</param>
/// <param name="Email">How they sign in.</param>
/// <param name="Role">What they do on the floor.</param>
/// <param name="IsActive">Whether the account can still be used.</param>
public sealed record PlatformRestaurantPersonResponse(
    Guid Id,
    string FullName,
    string Email,
    StaffRole Role,
    bool IsActive);

/// <summary>
/// How far a restaurant has actually been set up.
///
/// The figures a platform operator needs when somebody says a restaurant "isn't
/// working": almost every such report turns out to be a room with no tables in
/// service, an empty menu, or no ordering enabled on any table. None of those are
/// visible from the estate list, and all of them are one count each.
/// </summary>
/// <param name="Tables">Tables that exist.</param>
/// <param name="TablesInService">Tables not switched off.</param>
/// <param name="TablesTakingOrders">Tables a guest could scan and order from right now.</param>
/// <param name="MenuCategories">Categories on the menu.</param>
/// <param name="MenuItems">Dishes that exist.</param>
/// <param name="MenuItemsActive">Dishes a guest can currently order.</param>
/// <param name="InventoryItems">Stock lines being tracked.</param>
/// <param name="Staff">Staff accounts attached to the restaurant.</param>
/// <param name="SitePublished">Whether its public page is live.</param>
public sealed record PlatformRestaurantSetupResponse(
    int Tables,
    int TablesInService,
    int TablesTakingOrders,
    int MenuCategories,
    int MenuItems,
    int MenuItemsActive,
    int InventoryItems,
    int Staff,
    bool SitePublished);

/// <summary>
/// One order on the restaurant detail page.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="OrderNumber">The number the restaurant knows it by.</param>
/// <param name="TableName">Where it is sitting.</param>
/// <param name="ItemCount">Lines on it.</param>
/// <param name="WaitingAtPass">Dishes cooked and not yet carried out.</param>
/// <param name="Status">Open, completed or cancelled.</param>
/// <param name="Total">What it comes to.</param>
/// <param name="CreatedAtUtc">When it was opened.</param>
/// <param name="ClosedAtUtc">When it was settled or called off, or null while open.</param>
public sealed record PlatformRestaurantOrderResponse(
    Guid Id,
    int OrderNumber,
    string TableName,
    OrderStatus Status,
    int ItemCount,
    int WaitingAtPass,
    decimal Total,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ClosedAtUtc);

/// <summary>
/// What guests have said, in the two figures that matter from outside.
/// </summary>
/// <param name="Count">Reviews ever left.</param>
/// <param name="AverageRating">Their mean, or null when there are none.</param>
/// <param name="RecentCount">How many arrived in the last thirty days.</param>
/// <param name="RecentAverage">The mean of those, or null when there are none.</param>
public sealed record PlatformRestaurantReviewsResponse(
    int Count,
    double? AverageRating,
    int RecentCount,
    double? RecentAverage);

/// <summary>
/// One restaurant, whole.
///
/// Deliberately one response rather than the eight a page would otherwise have to
/// stitch together. A platform operator opening a restaurant is answering a single
/// question - what is going on here - and the alternative was eight requests that can
/// each half-fail, leaving a screen that is right about the menu and wrong about the
/// money with nothing on it to say which.
///
/// It is also the only way this page can exist at all: every other module in the
/// product scopes its reads to the caller's own restaurant, which a platform
/// administrator does not have.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="Name">What the restaurant is called.</param>
/// <param name="Slug">Its handle, and what a guest sees in a URL.</param>
/// <param name="IsActive">False when suspended: no new order may be opened.</param>
/// <param name="ContactEmail">How to reach it, or null.</param>
/// <param name="ContactPhone">How to ring it, or null.</param>
/// <param name="AddressLine">Where it is, or null.</param>
/// <param name="City">Which town, or null.</param>
/// <param name="Country">Which country, or null.</param>
/// <param name="CreatedAtUtc">When it was added to the platform.</param>
/// <param name="UpdatedAtUtc">When its settings were last touched.</param>
/// <param name="ServerUtcNow">The server clock, so an odd figure can be told from a wrong machine.</param>
/// <param name="LocalDate">The service day these figures cover.</param>
/// <param name="Manager">Who runs it, or null while nobody does.</param>
/// <param name="Setup">How far it has been configured.</param>
/// <param name="Staff">Its roster, by name.</param>
/// <param name="Today">The service day so far.</param>
/// <param name="Yesterday">The day before, whole, to read today against.</param>
/// <param name="OpenOrders">Orders running right now.</param>
/// <param name="PlatesAtPass">Dishes cooked and not yet carried out.</param>
/// <param name="LastOrderAtUtc">When it last opened an order, or null if it never has.</param>
/// <param name="Days">The last fortnight, oldest first, every day present.</param>
/// <param name="ByMethod">The fortnight's takings by tender, every method listed.</param>
/// <param name="Running">The orders open at this moment, oldest first.</param>
/// <param name="Recent">The last few orders to close, newest first.</param>
/// <param name="Reviews">What guests have said.</param>
public sealed record PlatformRestaurantDetailResponse(
    Guid Id,
    string Name,
    string Slug,
    bool IsActive,
    string? ContactEmail,
    string? ContactPhone,
    string? AddressLine,
    string? City,
    string? Country,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset ServerUtcNow,
    DateOnly LocalDate,
    PlatformRestaurantPersonResponse? Manager,
    PlatformRestaurantSetupResponse Setup,
    IReadOnlyList<PlatformRestaurantPersonResponse> Staff,
    PlatformDayResponse Today,
    PlatformDayResponse Yesterday,
    int OpenOrders,
    int PlatesAtPass,
    DateTimeOffset? LastOrderAtUtc,
    IReadOnlyList<PlatformTrendDayResponse> Days,
    IReadOnlyList<MethodTotalResponse> ByMethod,
    IReadOnlyList<PlatformRestaurantOrderResponse> Running,
    IReadOnlyList<PlatformRestaurantOrderResponse> Recent,
    PlatformRestaurantReviewsResponse Reviews);

/// <summary>
/// Whether the thing this platform runs on is actually healthy.
///
/// The one screen in the product that answers a question about the deployment rather
/// than about a restaurant. It exists because the answer has already been needed and
/// was not available anywhere: a database a migration behind serves every request
/// perfectly until it reaches the one column that is missing, and nothing in the
/// product said a word about it.
/// </summary>
/// <param name="ServerUtcNow">The server clock.</param>
/// <param name="LocalDate">The service day it is now, in the one calendar there is.</param>
/// <param name="ServiceDayLabel">That calendar, spelled out.</param>
/// <param name="ServiceDayOffsetMinutes">And as a number, so a client can agree with it.</param>
/// <param name="Environment">Which configuration the API booted with.</param>
/// <param name="Version">The build that is running.</param>
/// <param name="DatabaseReachable">Whether the API can currently open a connection.</param>
/// <param name="AppliedMigrationCount">Migrations the database has.</param>
/// <param name="PendingMigrations">
/// Migrations the code has and the database does not, newest last.
///
/// Empty is the only healthy answer. Anything in here means the running build expects
/// a schema that is not there yet, and the request that finds out will be somebody
/// trying to take an order.
/// </param>
public sealed record PlatformSystemResponse(
    DateTimeOffset ServerUtcNow,
    DateOnly LocalDate,
    string ServiceDayLabel,
    int ServiceDayOffsetMinutes,
    string Environment,
    string Version,
    bool DatabaseReachable,
    int AppliedMigrationCount,
    IReadOnlyList<string> PendingMigrations);

/// <summary>
/// One thing a platform administrator did.
/// </summary>
/// <param name="Id">Identifier.</param>
/// <param name="ActorName">Who did it, as they were called at the time.</param>
/// <param name="Action">A stable verb such as "restaurant.suspended".</param>
/// <param name="Subject">What was acted on, by name.</param>
/// <param name="SubjectId">What was acted on, where it still exists to link to.</param>
/// <param name="Detail">Anything the verb does not carry.</param>
/// <param name="AtUtc">When it happened.</param>
public sealed record PlatformActivityResponse(
    Guid Id,
    string ActorName,
    string Action,
    string Subject,
    Guid? SubjectId,
    string? Detail,
    DateTimeOffset AtUtc);

/// <summary>
/// The handful of things that are true of the platform rather than of a restaurant.
/// </summary>
/// <param name="DefaultVatRate">
/// The VAT rate a newly created restaurant starts on, as a fraction. A default and not
/// a rule: existing restaurants keep their own, and every order snapshots the rate at
/// the moment it opens, so this can never reach backwards into a printed bill.
/// </param>
/// <param name="DefaultServiceChargeRate">The service charge a new restaurant starts on.</param>
/// <param name="UpdatedAtUtc">When these were last changed, or null while never.</param>
public sealed record PlatformSettingsResponse(
    decimal DefaultVatRate,
    decimal DefaultServiceChargeRate,
    DateTimeOffset? UpdatedAtUtc);

/// <summary>
/// A change to the platform-wide defaults.
/// </summary>
/// <param name="DefaultVatRate">The new VAT default, as a fraction between 0 and 1.</param>
/// <param name="DefaultServiceChargeRate">The new service charge default.</param>
public sealed record UpdatePlatformSettingsRequest(
    decimal DefaultVatRate,
    decimal DefaultServiceChargeRate);
