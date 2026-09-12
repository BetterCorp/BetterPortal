import type { ConfigSchemaDescriptor } from "@betterportal/framework";

export const AuthConfigSchemas: ConfigSchemaDescriptor[] = [
  {
    id: "default-auth.tenant", title: "Account isolation", scope: "tenant",
    description: "Account directory boundaries. Locked permanently when the first user is created.",
    jsonSchema: { userIsolation: "string", directoryAdminAppId: "string" },
    fields: [
      { key: "userIsolation", title: "User isolation", description: "Account directory boundary; cannot change after user creation.", scope: "tenant", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", required: false, defaultValue: "app", ui: { control: "select", options: [{ value: "app", label: "Separate accounts per app" }, { value: "tenant", label: "Shared accounts in this tenant" }] } },
      { key: "directoryAdminAppId", title: "Directory administration app", description: "For shared tenant accounts, the app whose authorized administrators may disable accounts, revoke all sessions and change shared groups. Must be an app in this tenant.", scope: "tenant", visibility: "protected", ownership: "bp", sourceOfTruth: "bp", required: false }
    ]
  },
  {
    id: "default-auth.app", title: "Default authentication", scope: "app",
    description: "Registration, first-login roles, MFA, email delivery and social connections for this app.",
    jsonSchema: { registration: "string", defaultRoleIds: "string", requireMfa: "boolean", mailTransport: "string", mailUrl: "string", mailFrom: "string", mailApiKey: "string", mailHeaders: "string", socialConnections: "string" },
    fields: [
      { key: "registration", title: "Registration", defaultValue: "invite-only", ui: { control: "select", options: [{ value: "invite-only", label: "Invitations only" }, { value: "public", label: "Public registration" }, { value: "closed", label: "Closed" }] } },
      { key: "defaultRoleIds", title: "Default role IDs", description: "JSON array of existing app role IDs. Applied once at first completed login. Empty by default.", defaultValue: "[]" },
      { key: "requireMfa", title: "Require multi-factor authentication", defaultValue: false },
      { key: "mailTransport", title: "Email delivery", ui: { control: "select", options: [{ value: "postal", label: "Postal HTTP API" }, { value: "http", label: "Custom HTTP API" }] } },
      { key: "mailUrl", title: "Email API URL" },
      { key: "mailFrom", title: "Sender email" },
      { key: "mailApiKey", title: "Postal API key", visibility: "secret" },
      { key: "mailHeaders", title: "Custom HTTP headers", description: "JSON object of server-side headers.", visibility: "secret" },
      { key: "socialConnections", title: "Social connections", description: "JSON array of Google, Microsoft or GitHub connections. Each app requires its own registered redirect URL.", visibility: "secret" }
    ].map(field => ({ description: field.title, scope: "app" as const, visibility: "protected" as const, ownership: "bp" as const, sourceOfTruth: "bp" as const, required: false, ...field })) as ConfigSchemaDescriptor["fields"]
  }
];
