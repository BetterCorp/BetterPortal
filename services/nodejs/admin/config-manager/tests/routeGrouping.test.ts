import assert from "node:assert/strict";
import { test } from "node:test";
import { groupVisualRoutes, render } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/_renderer.bootstrap5/GET.js";
import type { ResponseData } from "../src/plugins/service-betterportal-config-manager/bp-routes/routes/GET.js";

test("visual routes regroup current mount paths with root routes before all headings", () => {
  const route = (id: string, path: string): ResponseData["routes"][number] => ({
    id, path, kind: "page", serviceId: "service-auth", viewId: id,
    operations: [`${id}.read`], methods: ["GET"], title: id, renderable: true, enabled: true,
    targetPath: "/login"
  });
  const login = route("login", "/org.auth/login");
  const routes = [
    route("admin", "/dev/admin"), login, route("status", "/z-status"),
    route("home", "/"), route("dev", "/dev"), route("tunnels", "/betterportal/tunnels")
  ];
  const data: ResponseData = {
    title: "Routes", apps: [], selectedAppId: "app", routes,
    availableServices: [], dependencyIssues: [], adminApiBase: "/admin", serviceBaseUrl: "https://config.example"
  };
  const rows = () => Array.from(String(render(data)).matchAll(/<tr\b[^>]*data-bp-(route-id|path-group)="([^"]+)"/g),
    ([, kind, value]) => `${kind}:${value}`);

  assert.deepEqual(rows(), [
    "route-id:home", "route-id:dev", "route-id:status",
    "path-group:/betterportal", "route-id:tunnels", "path-group:/dev", "route-id:admin",
    "path-group:/org.auth", "route-id:login"
  ]);

  login.path = "/login";
  assert.deepEqual(rows(), [
    "route-id:home", "route-id:dev", "route-id:login", "route-id:status",
    "path-group:/betterportal", "route-id:tunnels", "path-group:/dev", "route-id:admin"
  ]);
  assert.equal(groupVisualRoutes(routes).find((group) => group.routes.includes(login))?.synthetic, false);

  login.path = "/account/login";
  assert.deepEqual(rows(), [
    "route-id:home", "route-id:dev", "route-id:status",
    "path-group:/account", "route-id:login", "path-group:/betterportal", "route-id:tunnels",
    "path-group:/dev", "route-id:admin"
  ]);
  assert.deepEqual(routes.map((item) => item.id), ["admin", "login", "status", "home", "dev", "tunnels"]);
});
