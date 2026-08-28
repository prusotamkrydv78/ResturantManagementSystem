using System.Security.Cryptography;

namespace RestaurantManagement.Domain.Restaurants;

/// <summary>
/// Makes the opaque token that a table ordering link carries.
///
/// Random, never derived. A token computed from the table name, the restaurant slug or a
/// sequence would let anybody who holds one link work out the others, which is exactly
/// what a public link must not allow. Drawn from the cryptographic generator rather than
/// <c>Random</c>, because guessability is the whole threat here.
///
/// The alphabet leaves out characters that are misread off a printed card and mistyped
/// from one: no i, l, o, u, or 0 and 1. A guest who has to type the link by hand because
/// their camera will not focus should not land on somebody else table.
/// </summary>
public static class PublicOrderingToken
{
    /// <summary>
    /// Characters a token is built from. Thirty of them over thirty-two positions is
    /// roughly 158 bits, which is not worth attacking.
    /// </summary>
    private const string Alphabet = "abcdefghjkmnpqrstvwxyz23456789";

    /// <summary>Creates a fresh token.</summary>
    public static string Create()
    {
        var characters = new char[RestaurantTable.TokenLength];

        for (var index = 0; index < characters.Length; index++)
        {
            // Drawn one character at a time through the unbiased range helper rather than
            // by taking a byte modulo the alphabet, which would quietly favour the first
            // few letters.
            characters[index] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new string(characters);
    }

    /// <summary>
    /// Whether a string could be one of our tokens.
    ///
    /// Checked before the database is asked, so a malformed link fails on its own shape
    /// instead of turning into a query. Says nothing about whether the token exists.
    /// </summary>
    public static bool CouldBeValid(string? candidate) =>
        candidate is not null &&
        candidate.Length == RestaurantTable.TokenLength &&
        candidate.All(character => Alphabet.Contains(character));
}
