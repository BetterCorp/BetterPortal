import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import type { BetterPortalApp, BetterPortalMenuItem, BetterPortalRouteMount } from "@betterportal/framework";
import { appRoutePatternKey } from "../routeMounts.js";

type Row = Record<string, any>;
type App = BetterPortalApp;

/** The versioned app document contains settings, not operational collections. */
export function appSettings(app: App): Row {
  const { routes: _routes, menu: _menu, ...settings } = structuredClone(app);
  if (settings.auth) {
    const { roles: _roles, ...auth } = settings.auth;
    settings.auth = auth as App["auth"];
  }
  return settings;
}

/** Real columns for identity and relationships; route options remain typed configuration. */
export class AppData {
  readonly roles: string;
  readonly grants: string;
  readonly routes: string;
  readonly menus: string;
  constructor(private readonly prefix: string, private readonly scope: string) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(prefix)) throw new Error("Invalid table prefix");
    this.roles = `"${prefix}_roles"`;
    this.grants = `"${prefix}_role_grants"`;
    this.routes = `"${prefix}_routes"`;
    this.menus = `"${prefix}_menu_items"`;
  }

  async create(client: PoolClient): Promise<void> {
    const parent = `app_kind text not null default 'apps' check (app_kind = 'apps'),
      foreign key (scope_id, app_kind, app_id) references "${this.prefix}_entities"
      (scope_id, kind, entity_id) on delete cascade deferrable initially deferred`;
    await client.query(`create table if not exists ${this.roles} (
      scope_id text not null, app_id text not null, id text not null, title text not null,
      description text, position integer not null, primary key (scope_id, app_id, id), ${parent})`);
    await client.query(`create table if not exists ${this.grants} (
      scope_id text not null, app_id text not null, role_id text not null,
      service_id text not null, view_id text not null, action text not null
      check (action in ('read', 'create', 'update', 'delete')),
      grant_position integer not null, action_position integer not null,
      primary key (scope_id, app_id, role_id, service_id, view_id, action),
      foreign key (scope_id, app_id, role_id) references ${this.roles} (scope_id, app_id, id)
      on delete cascade deferrable initially deferred)`);
    await client.query(`create table if not exists ${this.routes} (
      scope_id text not null, app_id text not null, id text not null,
      kind text not null check (kind in ('page','api')), path text not null, path_key text not null,
      service_id text not null, view_id text not null, title text, icon text,
      enabled boolean not null, operations text[] not null check (cardinality(operations) > 0),
      position integer not null, options jsonb not null,
      primary key (scope_id, app_id, id),
      unique (scope_id, app_id, path_key) deferrable initially deferred, ${parent})`);
    await client.query(`create table if not exists ${this.menus} (
      scope_id text not null, app_id text not null, id text not null, parent_id text,
      position integer not null, type text not null check (type in ('link','group','section','divider','external')),
      title text, icon text, route_id text, href text, enabled boolean not null,
      service_status text not null, auth_status text not null, roles_any_of text[], default_expanded boolean,
      primary key (scope_id, app_id, id),
      foreign key (scope_id, app_id, parent_id) references ${this.menus} (scope_id, app_id, id) deferrable initially deferred,
      foreign key (scope_id, app_id, route_id) references ${this.routes} (scope_id, app_id, id) deferrable initially deferred,
      ${parent})`);
  }

  private rows(app?: App): Map<string, Map<string, Row>> {
    const roles = new Map<string, Row>(), grants = new Map<string, Row>();
    const routes = new Map<string, Row>(), menus = new Map<string, Row>();
    const add = (rows: Map<string, Row>, key: string, row: Row) => {
      if (rows.has(key)) throw new Error("Duplicate app data identity");
      rows.set(key, row);
    };
    app?.auth?.roles.forEach((role, position) => {
      add(roles, role.id, { id: role.id, title: role.title, description: role.description ?? null, position });
      role.permissions.forEach((grant, grant_position) => grant.permissions.forEach((action, action_position) => {
        const row = { role_id: role.id, service_id: grant.serviceId, view_id: grant.viewId, action, grant_position, action_position };
        add(grants, JSON.stringify([role.id, grant.serviceId, grant.viewId, action]), row);
      }));
    });
    app?.routes.forEach((route, position) => {
      const { id, kind, path, serviceId, viewId, title, icon, enabled, operations, ...options } = route;
      add(routes, id, { id, kind, path, path_key: appRoutePatternKey(path), service_id: serviceId, view_id: viewId,
        title: title ?? null, icon: icon ?? null, enabled, operations, position, options });
    });
    const visit = (items: BetterPortalMenuItem[], parent_id: string | null) => items.forEach((item, position) => {
      add(menus, item.id, { id: item.id, parent_id, position, type: item.type, title: item.title ?? null, icon: item.icon ?? null,
        route_id: item.routeId ?? null, href: item.href ?? null, enabled: item.enabled, service_status: item.serviceStatus,
        auth_status: item.authStatus, roles_any_of: item.rolesAnyOf ?? null, default_expanded: item.defaultExpanded ?? null });
      visit(item.children, item.id);
    });
    visit(app?.menu ?? [], null);
    return new Map([[this.roles, roles], [this.grants, grants], [this.routes, routes], [this.menus, menus]]);
  }

  changed(before?: App, after?: App): boolean {
    return !isDeepStrictEqual(this.rows(before), this.rows(after));
  }

  /** Apply only changed rows; unrelated collections never get replaced. Caller holds the app lock. */
  async save(client: PoolClient, appId: string, before: App | undefined, after: App | undefined, current = before): Promise<void> {
    const previous = this.rows(before), next = this.rows(after), latest = this.rows(current);
    for (const [table, rows] of next) {
      const old = previous.get(table)!;
      for (const key of new Set([...old.keys(), ...rows.keys()])) {
        const a = old.get(key), b = rows.get(key);
        if (isDeepStrictEqual(a, b)) continue;
        // Legacy snapshot writers must never erase a concurrent edit to the same record.
        if (!isDeepStrictEqual(a, latest.get(table)!.get(key))) {
          const error = new Error("App data changed concurrently; reload before replacing the same record");
          Object.assign(error, { status: 409, statusCode: 409 });
          throw error;
        }
        const identity = table === this.grants ? ["role_id", "service_id", "view_id", "action"] : ["id"];
        if (!b) {
          await client.query(`delete from ${table} where scope_id=$1 and app_id=$2 and ${identity.map((column, i) => `${column}=$${i + 3}`).join(" and ")}`,
            [this.scope, appId, ...identity.map(column => a![column])]);
        } else {
          const columns = Object.keys(b);
          await client.query(`insert into ${table} (scope_id, app_id, ${columns.join(",")})
            values ($1,$2,${columns.map((_, i) => `$${i + 3}`).join(",")})
            on conflict (scope_id, app_id, ${identity.join(",")}) do update set
            ${columns.filter(column => !identity.includes(column)).map(column => `${column}=excluded.${column}`).join(",")}`,
          [this.scope, appId, ...columns.map(column => column === "options" ? JSON.stringify(b[column]) : b[column])]);
        }
      }
    }
  }

  async hydrate(client: PoolClient, apps: Row[]): Promise<void> {
    const byId = new Map(apps.map(app => [app.id, app]));
    for (const app of apps) { app.routes = []; app.menu = []; if (app.auth) app.auth.roles = []; }
    const roles = new Map<string, Row>();
    for (const row of (await client.query(`select * from ${this.roles} where scope_id=$1 order by position,id`, [this.scope])).rows) {
      const app = byId.get(row.app_id);
      if (!app?.auth) throw new Error("Role references an app without auth");
      const role = { id: row.id, title: row.title, ...(row.description !== null ? { description: row.description } : {}), permissions: [] as Row[] };
      app.auth.roles.push(role); roles.set(JSON.stringify([row.app_id, row.id]), role);
    }
    for (const row of (await client.query(`select * from ${this.grants} where scope_id=$1 order by grant_position,action_position`, [this.scope])).rows) {
      const role = roles.get(JSON.stringify([row.app_id, row.role_id]))!;
      let grant = role.permissions.find((g: Row) => g.serviceId === row.service_id && g.viewId === row.view_id);
      if (!grant) { grant = { serviceId: row.service_id, viewId: row.view_id, permissions: [] }; role.permissions.push(grant); }
      grant.permissions.push(row.action);
    }
    for (const row of (await client.query(`select * from ${this.routes} where scope_id=$1 order by position,id`, [this.scope])).rows) {
      const route: BetterPortalRouteMount = { ...row.options, id: row.id, kind: row.kind, path: row.path,
        serviceId: row.service_id, viewId: row.view_id, enabled: row.enabled, operations: row.operations };
      if (row.title !== null) route.title = row.title;
      if (row.icon !== null) route.icon = row.icon;
      byId.get(row.app_id)!.routes.push(route);
    }
    const menus = new Map<string, BetterPortalMenuItem>();
    const rows = (await client.query(`select * from ${this.menus} where scope_id=$1 order by position,id`, [this.scope])).rows;
    for (const row of rows) {
      const item: BetterPortalMenuItem = { id: row.id, type: row.type, enabled: row.enabled,
        serviceStatus: row.service_status, authStatus: row.auth_status, children: [] };
      for (const [column, field] of Object.entries({ title: "title", icon: "icon", route_id: "routeId", href: "href",
        roles_any_of: "rolesAnyOf", default_expanded: "defaultExpanded" })) {
        if (row[column] !== null) (item as unknown as Row)[field] = row[column];
      }
      menus.set(JSON.stringify([row.app_id, row.id]), item);
    }
    for (const row of rows) {
      const item = menus.get(JSON.stringify([row.app_id, row.id]))!;
      const parent = row.parent_id ? menus.get(JSON.stringify([row.app_id, row.parent_id]))!.children : byId.get(row.app_id)!.menu;
      parent.push(item);
    }
  }
}
