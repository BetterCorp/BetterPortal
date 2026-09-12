using BetterPortal;
using Node = System.Collections.Generic.Dictionary<string, object?>;
public static class ElevationChecks
{
    public static void Run(string path) {
        var cases = ((IEnumerable<object?>)Json.Read(File.ReadAllText(path))!).Cast<Node>().ToArray();
        foreach (var item in cases) {
            var allowed = false;
            try { Elevation.Require((Node)item["user"]!, (Node)item["requirement"]!, Convert.ToInt64(item["now"])); allowed = true; }
            catch (TokenException) { }
            if (allowed != (bool)item["allowed"]!) throw new Exception((string)item["name"]!);
        }
        Console.WriteLine($".NET: {cases.Length} shared elevation cases passed");
    }
}
