import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalConfigSchema, uuidv7 } from "@betterportal/framework";
import { createPreviewGroup, provisionPreviewDeployment, reconcilePreviewService } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { pageRoutePath } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";

function fixture() {
  const tenantId = uuidv7(), appId = uuidv7(), serviceId = uuidv7();
  const config = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "source", title: "Source", branding: {}, services: [{ id: serviceId, serviceId: "org.example.invops", hostname: "https://source.test", createdAt: new Date().toISOString(), enabled: true }] }],
    apps: [{ id: appId, tenantId, slug: "source", title: "Source", hostnames: ["source.test"], themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      routes: [{ id: uuidv7(), kind: "page", path: "/batches/detail", targetPath: "/batches/detail", serviceId, viewId: "batches.detail", operations: ["batches.detail.get"], enabled: true }] }]
  });
  const { group } = createPreviewGroup(config, { name: "Preview", sourceTenantId: tenantId, sourceAppId: appId, expiresInDays: 7 });
  const input = { key: "paths", hostname: "preview.test", services: [{ serviceId: "org.example.invops", url: "https://invops.preview.test" }] };
  const { deployment } = provisionPreviewDeployment(config, group.id, input, "https://config.test");
  const app = config.apps.find(app => app.id === deployment.appId)!;
  const instance = deployment.services[0].instanceId;
  const manifest = { serviceId: "org.example.invops", manifestVersion: "1", fetchedAt: new Date().toISOString(), viewIndex: {
    "batches.detail": { viewId: "batches.detail", path: "/batches/:batchId", pathVariants: [], operations: [{ operationId: "batches.detail.get", method: "GET", title: "Batch", renderable: true, renderModes: ["page"], robots: [], menu: false }] }
  } };
  return { config, group, deployment, input, app, instance, manifest };
}

test("preview sync repairs missing path parameters once and preserves mount identity", () => {
  const { config, app, instance, manifest } = fixture();
  const id = app.routes[0].id;
  assert.equal(reconcilePreviewService(config, instance, manifest as never), true);
  assert.equal(app.routes[0].id, id);
  assert.equal(app.routes[0].path, pageRoutePath(manifest.serviceId, "/batches/:batchId"));
  assert.equal(app.routes[0].targetPath, "/batches/:batchId");
  assert.equal(app.menu.length, 0, "contextual routes stay out of the menu");
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});

test("valid custom aliases and fixed-parameter mounts survive reconciliation", () => {
  const { config, app, instance, manifest } = fixture();
  app.routes[0].path = "/history/:batchId";
  app.routes.push({ ...app.routes[0], id: uuidv7(), path: "/featured-batch", fixedParams: { batchId: "1" } });
  reconcilePreviewService(config, instance, manifest as never);
  assert.deepEqual(app.routes.map(route => route.path), ["/history/:batchId", "/featured-batch"]);
});

test("same-key redeployment repairs paths using the accepted manifest cache", () => {
  const { config, group, input, app, instance, manifest } = fixture();
  config.manifestCache.push({ ...manifest, serviceId: instance } as never);
  provisionPreviewDeployment(config, group.id, input, "https://config.test");
  assert.equal(app.routes[0].path, pageRoutePath(manifest.serviceId, "/batches/:batchId"));
});

test("repair rejects a conflicting frontend path rather than creating duplicate mounts", () => {
  const { config, app, instance, manifest } = fixture();
  app.routes.push({ ...app.routes[0], id: uuidv7(), serviceId: uuidv7(), viewId: "other", path: pageRoutePath(manifest.serviceId, "/batches/:id"), enabled: true });
  assert.throws(() => reconcilePreviewService(config, instance, manifest as never), /already mounted/);
});


test("repair rejects paths held by disabled pages", () => {
  const { config, app, instance, manifest } = fixture();
  app.routes.push({ ...app.routes[0], id: uuidv7(), serviceId: uuidv7(), viewId: "other", path: pageRoutePath(manifest.serviceId, "/batches/:id"), enabled: false });
  assert.throws(() => reconcilePreviewService(config, instance, manifest as never), /already mounted/);
});

test("two stale aliases cannot repair to the same generated frontend pattern", () => {
  const { config, app, instance, manifest } = fixture();
  app.routes.push({ ...app.routes[0], id: uuidv7(), path: "/alternate/detail" });
  assert.throws(() => reconcilePreviewService(config, instance, manifest as never), /already mounted/);
});


test("retired service mounts do not block a surviving stale mount repair", () => {
  const { config, app, instance, manifest } = fixture();
  const survivingId = app.routes[0].id;
  app.routes.push({ ...app.routes[0], id: uuidv7(), viewId: "retired", path: pageRoutePath(manifest.serviceId, "/batches/:id") });
  reconcilePreviewService(config, instance, manifest as never);
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].id, survivingId);
  assert.equal(app.routes[0].path, pageRoutePath(manifest.serviceId, "/batches/:batchId"));
});
