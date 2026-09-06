namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// Orders table names the way somebody reading a room would.
///
/// Table names almost always end in a number, and sorting them as text puts "Table 10"
/// second - between 1 and 2 - because '1' sorts before '2' one character at a time. Every
/// list of tables in this product had that: the customer picking where they are sitting,
/// the waiter starting an order, the floor plan, and the settings screen. On ten tables it
/// looks like a glitch; on forty it makes the list unusable, because the one thing a
/// person does with a list of tables is look for a number in it.
///
/// So runs of digits are compared as numbers and everything else a character at a time,
/// which puts "Table 2" before "Table 10" and leaves "Bar 1", "Terrace 3" and "Window 12"
/// grouped by their words and then ordered within each group.
///
/// Case is ignored, because a manager typing "table 4" among "Table 3" and "Table 5" meant
/// it to sit between them rather than after the lot.
///
/// Applied in memory rather than in SQL. Expressing this in a query would mean either a
/// stored sort key on the row, which then has to be kept true on every rename, or database
/// specific collation tricks that would not survive a provider change - and a restaurant
/// has tens of tables, not thousands.
/// </summary>
public sealed class TableNameComparer : IComparer<string>
{
    /// <summary>The one instance. It holds nothing.</summary>
    public static readonly TableNameComparer Instance = new();

    private TableNameComparer()
    {
    }

    /// <inheritdoc />
    public int Compare(string? left, string? right)
    {
        if (ReferenceEquals(left, right))
        {
            return 0;
        }

        // Nulls first. Not expected - a name is required - but a comparer that throws
        // would take down a whole floor screen over one bad row.
        if (left is null)
        {
            return -1;
        }

        if (right is null)
        {
            return 1;
        }

        var l = 0;
        var r = 0;

        while (l < left.Length && r < right.Length)
        {
            if (char.IsAsciiDigit(left[l]) && char.IsAsciiDigit(right[r]))
            {
                var compared = CompareNumbers(left, ref l, right, ref r);

                if (compared != 0)
                {
                    return compared;
                }

                continue;
            }

            var letters = char.ToUpperInvariant(left[l]).CompareTo(char.ToUpperInvariant(right[r]));

            if (letters != 0)
            {
                return letters;
            }

            l++;
            r++;
        }

        // Everything matched as far as the shorter one goes, so whatever is left over
        // decides it: "Table 4" comes before "Table 4a".
        return (left.Length - l).CompareTo(right.Length - r);
    }

    /// <summary>
    /// Compares the run of digits starting at each cursor, and moves both cursors past it.
    /// </summary>
    private static int CompareNumbers(string left, ref int l, string right, ref int r)
    {
        var leftStart = l;
        var rightStart = r;

        while (l < left.Length && char.IsAsciiDigit(left[l]))
        {
            l++;
        }

        while (r < right.Length && char.IsAsciiDigit(right[r]))
        {
            r++;
        }

        // Leading zeros are padding rather than value, so "Table 007" and "Table 7" are
        // the same number and fall through to whatever follows them.
        var leftDigits = left.AsSpan(leftStart, l - leftStart).TrimStart('0');
        var rightDigits = right.AsSpan(rightStart, r - rightStart).TrimStart('0');

        // More digits is a bigger number, once the padding is off. This is what actually
        // fixes the reported case, without parsing anything that could overflow.
        if (leftDigits.Length != rightDigits.Length)
        {
            return leftDigits.Length < rightDigits.Length ? -1 : 1;
        }

        // Same length, so comparing the digits as characters is comparing the numbers.
        return leftDigits.SequenceCompareTo(rightDigits);
    }
}
