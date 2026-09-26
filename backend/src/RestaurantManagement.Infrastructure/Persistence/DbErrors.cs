using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace RestaurantManagement.Infrastructure.Persistence;

/// <summary>
/// Telling one database refusal from another.
///
/// Several saves in this product retry when a unique index turns a race into a failed
/// insert. They used to retry on any <see cref="DbUpdateException"/> at all, which
/// meant a truncated string or a missing foreign key was retried five times and then
/// reported as "the number was taken" - a message that sends whoever reads it looking
/// in exactly the wrong place. Asking which index refused keeps the retry for the one
/// failure it can actually fix.
/// </summary>
internal static class DbErrors
{
    /// <summary>SQL Server's two unique-violation numbers: index, and constraint.</summary>
    private const int DuplicateKeyInIndex = 2601;
    private const int DuplicateKeyInConstraint = 2627;

    /// <summary>
    /// Whether the save failed because the named unique index already held the value.
    /// </summary>
    /// <param name="exception">What the save threw.</param>
    /// <param name="indexName">The index to look for, as the migration named it.</param>
    public static bool IsUniqueViolation(DbUpdateException exception, string indexName) =>
        exception.InnerException is SqlException
        {
            Number: DuplicateKeyInIndex or DuplicateKeyInConstraint,
        } sql &&
        sql.Message.Contains(indexName, StringComparison.OrdinalIgnoreCase);
}
