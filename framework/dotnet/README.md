# BetterPortal .NET port

Status: initial AnyVali contract adapter only; **not a usable framework runtime**.
The .NET 10 Conformance project hosts loopback probes against the published
AnyVali 1.1.0 package. ASP.NET Core operation hosting, auth, configuration, tools,
and examples remain pending the failed [interchange gate](../conformance/README.md).

```sh
dotnet build framework/dotnet/Conformance
```

The BetterPortal project embeds canonical AnyVali documents and uses native
import/parse/export. JSON conversion preserves missing dictionary keys versus
null; it does not implement a second validator. The dependency lock pins 1.1.0.
See the [capability ledger](../conformance/CAPABILITIES.md) before treating a
successful compilation as evidence of framework completeness.
