namespace RestaurantManagement.Shared.Results;

/// <summary>
/// Outcome of an operation that either succeeds or fails with an <see cref="Error"/>.
/// Lets the application layer report expected failures without throwing.
/// </summary>
public class Result
{
    /// <summary>Creates a result.</summary>
    protected Result(bool isSuccess, Error? error)
    {
        IsSuccess = isSuccess;
        Error = error;
    }

    /// <summary>True when the operation succeeded.</summary>
    public bool IsSuccess { get; }

    /// <summary>True when the operation failed.</summary>
    public bool IsFailure => !IsSuccess;

    /// <summary>The failure descriptor, or null on success.</summary>
    public Error? Error { get; }

    /// <summary>Creates a successful result.</summary>
    public static Result Success() => new(true, null);

    /// <summary>Creates a failed result.</summary>
    public static Result Failure(Error error) => new(false, error);

    /// <summary>Creates a successful result carrying a value.</summary>
    public static Result<TValue> Success<TValue>(TValue value) => Result<TValue>.Success(value);

    /// <summary>Creates a failed result for a value-carrying operation.</summary>
    public static Result<TValue> Failure<TValue>(Error error) => Result<TValue>.Failure(error);
}

/// <summary>A <see cref="Result"/> that carries a value when successful.</summary>
/// <typeparam name="TValue">Type of the produced value.</typeparam>
public sealed class Result<TValue> : Result
{
    private readonly TValue? _value;

    private Result(bool isSuccess, TValue? value, Error? error)
        : base(isSuccess, error)
    {
        _value = value;
    }

    /// <summary>The produced value. Only valid when <see cref="Result.IsSuccess"/> is true.</summary>
    /// <exception cref="InvalidOperationException">Thrown when the result is a failure.</exception>
    public TValue Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Cannot read the value of a failed result.");

    /// <summary>Creates a successful result.</summary>
    public static Result<TValue> Success(TValue value) => new(true, value, null);

    /// <summary>Creates a failed result.</summary>
    public static new Result<TValue> Failure(Error error) => new(false, default, error);
}
