using System.Text.RegularExpressions;

namespace BetterPortal;

public sealed class NotAcceptableException(string message) : Exception(message)
{
    public int Status => 406;
}
public sealed record Representation(string Kind, string? Mode = null);

public static class Media
{
    private static readonly Dictionary<string, string> Mime = new()
    {
        ["json"] = "application/json", ["html"] = "text/html",
        ["metadata"] = "application/vnd.betterportal.metadata+json", ["ndjson"] = "application/x-ndjson"
    };
    public static Representation Negotiate(string? accept, IEnumerable<string>? available = null)
    {
        var supported = (available ?? Mime.Keys).ToHashSet(StringComparer.Ordinal);
        if (!supported.IsSubsetOf(Mime.Keys)) throw new ArgumentException("Unknown representation");
        var raw = string.IsNullOrWhiteSpace(accept) ? "*/*" : accept;
        if (raw.Length > 8192 || raw.Any(character => character < 32 && character != '\t' || character == 127))
            throw new NotAcceptableException("Invalid Accept header");
        // HttpHeaders tolerates whitespace around '/', which is not media-type grammar.
        if (Regex.Matches(raw, "\"(?:[^\"\\\\]|\\\\.)*\"|(?<bad>[ \\t]/|/[ \\t])").Any(match => match.Groups["bad"].Success))
            throw new NotAcceptableException("Invalid media range");
        using var request = new HttpRequestMessage();
        try { request.Headers.Accept.ParseAdd(raw); }
        catch (FormatException) { throw new NotAcceptableException("Invalid media range"); }
        var entries = request.Headers.Accept.Select((entry, index) =>
        {
            if (entry.MediaType!.StartsWith("*/", StringComparison.Ordinal) && entry.MediaType != "*/*")
                throw new NotAcceptableException("Invalid media wildcard");
            var parameters = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var parameter in entry.Parameters)
                if (parameter.Value is null || !parameters.TryAdd(parameter.Name, parameter.Value)) throw new NotAcceptableException("Invalid media parameters");
            var quality = parameters.GetValueOrDefault("q", "1");
            if (!Regex.IsMatch(quality, @"\A(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)\z")) throw new NotAcceptableException("Invalid media quality");
            var mode = parameters.GetValueOrDefault("mode");
            if (mode is { Length: >= 2 } && mode[0] == '"' && mode[^1] == '"') mode = Regex.Replace(mode[1..^1], @"\\(.)", "$1");
            if (mode is not null && !Contracts.Get("RenderModeSchema").SafeParse(mode).Success) mode = "invalid";
            return (Media: entry.MediaType!.ToLowerInvariant(), Quality: double.Parse(quality, System.Globalization.CultureInfo.InvariantCulture), Mode: mode, Index: index);
        }).ToArray();
        var candidates = new List<(double Quality, int Order, Representation Value)>();
        foreach (var (kind, mime) in Mime)
        {
            if (!supported.Contains(kind)) continue;
            foreach (var mode in kind == "html" ? new[] { "page", "fragment", "embed" } : new string?[] { null })
            {
                var matches = entries.Where(entry => kind != "html" || (entry.Mode ?? "page") == mode)
                    .Select(entry => (entry, specificity: entry.Media == mime ? 2 : entry.Media == mime.Split('/')[0] + "/*" ? 1 : entry.Media == "*/*" ? 0 : -1))
                    .Where(match => match.specificity >= 0)
                    .OrderByDescending(match => match.specificity + (kind == "html" && match.entry.Mode is not null ? 1 : 0))
                    .ThenByDescending(match => match.entry.Quality).ThenBy(match => match.entry.Index).ToArray();
                if (matches.Length > 0 && matches[0].entry.Quality > 0)
                    candidates.Add((matches[0].entry.Quality, matches[0].entry.Index, new(kind, mode)));
            }
        }
        return candidates.OrderByDescending(candidate => candidate.Quality).ThenBy(candidate => candidate.Order).FirstOrDefault().Value
            ?? throw new NotAcceptableException("No acceptable representation");
    }
}
