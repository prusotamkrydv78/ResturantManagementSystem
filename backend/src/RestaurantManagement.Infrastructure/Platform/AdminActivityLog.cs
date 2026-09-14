using Microsoft.Extensions.Logging;
using RestaurantManagement.Application.Authentication;
using RestaurantManagement.Application.Platform;
using RestaurantManagement.Domain.Platform;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.Infrastructure.Platform;

/// <summary>
/// Writes what an administrator did into a table somebody can read.
///
/// Saves immediately rather than joining the caller's unit of work. That is the less
/// tidy choice and the right one: the action being recorded has already been committed
/// by the time this is called, and enlisting in a transaction that might still roll back
/// would produce a log claiming things that never happened.
///
/// Nothing here throws. A log that can take down the operation it describes is worse
/// than a gap in the log, so a failed write is reported to the application log and
/// swallowed.
/// </summary>
public sealed class AdminActivityLog : IAdminActivityLog
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<AdminActivityLog> _logger;

    /// <summary>Creates the log.</summary>
    public AdminActivityLog(
        ApplicationDbContext dbContext,
        ICurrentUser currentUser,
        ILogger<AdminActivityLog> logger)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task RecordAsync(
        string action,
        string subject,
        Guid? subjectId = null,
        string? detail = null,
        CancellationToken cancellationToken = default)
    {
        if (_currentUser.UserId is not { } actorId)
        {
            return;
        }

        try
        {
            _dbContext.AdminActivities.Add(new AdminActivity
            {
                // Time-ordered, so rows written in the same tick still read back in the
                // order they happened rather than in whatever order the index likes.
                Id = Guid.CreateVersion7(),
                ActorId = actorId,
                ActorName = _currentUser.FullName ?? "Unknown",
                Action = action,
                Subject = subject,
                SubjectId = subjectId,
                Detail = detail,
                AtUtc = DateTimeOffset.UtcNow,
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception caught)
        {
            _logger.LogError(
                caught,
                "Could not record admin activity {Action} on {Subject}.",
                action,
                subject);
        }
    }
}
