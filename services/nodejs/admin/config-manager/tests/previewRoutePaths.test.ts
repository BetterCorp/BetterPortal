import assert from "node:assert/strict";
import test from "node:test";
import { BetterPortalConfigSchema, uuidv7 } from "@betterportal/framework";
import { createPreviewGroup, provisionPreviewDeployment, reconcilePreviewService } from "../src/plugins/service-betterportal-config-manager/previewEnvironments.js";
import { apiRoutePath, pageRoutePath } from "../src/plugins/service-betterportal-config-manager/routeMounts.js";

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

function reportApiFixture() {
  const tenantId = uuidv7(), appId = uuidv7(), sourceId = uuidv7();
  const pluginId = "za.co.robertgroup.one.reports", viewId = "reports.owner.report";
  const servicePath = "/internal/reports/owner/reports/:reportId";
  const operations = ["GET", "PUT", "DELETE"].map(method => ({ operationId: `${viewId}.${method.toLowerCase()}`, method, title: method, renderable: false, renderModes: [], robots: [] }));
  const config = BetterPortalConfigSchema.parse({
    tenants: [{ id: tenantId, slug: "source", title: "Source", branding: {}, services: [{ id: sourceId, serviceId: pluginId, hostname: "https://reports.source.test", createdAt: new Date().toISOString(), enabled: true }] }],
    apps: [{ id: appId, tenantId, slug: "source", title: "Source", hostnames: ["source.test"], themeConfig: { mode: "system", bootstrap: {}, light: {}, dark: {} },
      routes: operations.map((operation, index) => ({ id: uuidv7(), kind: "api", path: apiRoutePath(sourceId, servicePath), targetPath: servicePath, serviceId: sourceId, viewId, operations: [operation.operationId], enabled: true,
        query: "format=json", fixedParams: { reportId: "featured" }, ...(index === 0 ? { icon: "file-text" } : {}) })) }]
  });
  const { group } = createPreviewGroup(config, { name: "Preview", sourceTenantId: tenantId, sourceAppId: appId, expiresInDays: 7 });
  const input = { key: "staging", hostname: "staging.test", services: [{ serviceId: pluginId, url: "https://reports.staging.test" }] };
  const { deployment } = provisionPreviewDeployment(config, group.id, input, "https://config.test");
  const app = config.apps.find(app => app.id === deployment.appId)!;
  const instance = deployment.services[0].instanceId;
  const manifest = { serviceId: pluginId, manifestVersion: "11", fetchedAt: new Date().toISOString(), viewIndex: {
    [viewId]: { viewId, path: servicePath, pathVariants: ["/alternate/reports/:reportId"], operations }
  } };
  return { config, group, deployment, input, app, instance, manifest, servicePath, operations };
}

test("report API migration consolidates operation mounts and remains stable across refreshes", () => {
  const { config, group, input, app, instance, manifest, servicePath, operations } = reportApiFixture();
  const survivingId = app.routes[0].id;
  assert.equal(reconcilePreviewService(config, instance, manifest as never), true);
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].id, survivingId);
  assert.equal(app.routes[0].path, apiRoutePath(manifest.serviceId, servicePath));
  assert.deepEqual(app.routes[0].operations, operations.map(operation => operation.operationId));
  assert.equal(app.routes[0].query, "format=json");
  assert.deepEqual(app.routes[0].fixedParams, { reportId: "featured" });
  assert.equal(app.routes[0].icon, "file-text");
  const routes = structuredClone(app.routes);
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
  config.manifestCache.push({ ...manifest, serviceId: instance } as never);
  provisionPreviewDeployment(config, group.id, input, "https://config.test");
  assert.deepEqual(app.routes, routes);
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});

test("valid API aliases retain their path, selected operations and request settings", () => {
  const { config, app, instance, manifest } = reportApiFixture();
  manifest.viewIndex["reports.owner.report"].operations.pop();
  app.routes = [{ ...app.routes[0], path: "/report-api/:reportId", fixedParams: undefined },
    { ...app.routes[1], path: `/_bp/service/${manifest.serviceId}/custom-reports/:reportId`, query: "mode=edit", fixedParams: undefined }];
  const ids = app.routes.map(route => route.id);
  const operations = app.routes.map(route => [...route.operations]);
  reconcilePreviewService(config, instance, manifest as never);
  assert.deepEqual(app.routes.map(route => route.id), ids);
  assert.deepEqual(app.routes.map(route => route.path), ["/report-api/:reportId", `/_bp/service/${manifest.serviceId}/custom-reports/:reportId`]);
  assert.deepEqual(app.routes.map(route => route.operations), operations);
  assert.deepEqual(app.routes.map(route => route.query), ["format=json", "mode=edit"]);
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});

test("already canonical API operation mounts also consolidate without inventing another route", () => {
  const { config, app, instance, manifest, servicePath } = reportApiFixture();
  for (const route of app.routes) route.path = apiRoutePath(manifest.serviceId, servicePath);
  reconcilePreviewService(config, instance, manifest as never);
  assert.equal(app.routes.length, 1);
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});

test("API migration keeps distinct service path variants", () => {
  const { config, app, instance, manifest, servicePath } = reportApiFixture();
  const variant = "/alternate/reports/:reportId";
  app.routes[1].path = apiRoutePath(manifest.serviceId, variant);
  app.routes[1].targetPath = variant;
  app.routes[1].servicePathVariant = variant;
  reconcilePreviewService(config, instance, manifest as never);
  assert.deepEqual(app.routes.map(route => route.path), [apiRoutePath(manifest.serviceId, servicePath), apiRoutePath(manifest.serviceId, variant)]);
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});

test("API migration still rejects unrelated mounts and incompatible request settings atomically", () => {
  for (const conflict of ["other-service", "other-view", "query", "fixedParams"] as const) {
    const { config, app, instance, manifest, servicePath } = reportApiFixture();
    if (conflict === "other-service" || conflict === "other-view") {
      app.routes.push({ ...app.routes[0], id: uuidv7(), path: apiRoutePath(manifest.serviceId, servicePath),
        ...(conflict === "other-service" ? { serviceId: uuidv7() } : { viewId: "unrelated", operations: ["unrelated.get"] }), enabled: false });
      if (conflict === "other-view") {
        app.routes.at(-1)!.targetPath = "/unrelated/:reportId";
        manifest.viewIndex.unrelated = { viewId: "unrelated", path: "/unrelated/:reportId", pathVariants: [],
          operations: [{ ...manifest.viewIndex["reports.owner.report"].operations[0], operationId: "unrelated.get" }] };
      }
    } else if (conflict === "query") app.routes[1].query = "format=pdf";
    else app.routes[1].fixedParams = { reportId: "different" };
    const before = structuredClone(app.routes);
    assert.throws(() => reconcilePreviewService(config, instance, manifest as never), /already mounted|incompatible/i);
    assert.deepEqual(app.routes, before, conflict);
  }
});

test("API aliases keep their selections while new operations receive a canonical mount", () => {
  const { config, app, instance, manifest, servicePath, operations } = reportApiFixture();
  app.routes = [{ ...app.routes[0], path: "/read-report/:reportId", fixedParams: undefined }];
  const aliasId = app.routes[0].id;
  reconcilePreviewService(config, instance, manifest as never);
  assert.equal(app.routes.length, 2);
  assert.equal(app.routes[0].id, aliasId);
  assert.equal(app.routes[0].path, "/read-report/:reportId");
  assert.deepEqual(app.routes[0].operations, [operations[0].operationId]);
  assert.equal(app.routes[1].path, apiRoutePath(manifest.serviceId, servicePath));
  assert.deepEqual(app.routes[1].operations, operations.map(operation => operation.operationId));
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});

test("equivalent operation mounts at an explicit API alias consolidate their selections", () => {
  const { config, app, instance, manifest } = reportApiFixture();
  manifest.viewIndex["reports.owner.report"].operations.pop();
  app.routes = app.routes.slice(0, 2).map(route => ({ ...route, path: "/report-api/:reportId", fixedParams: undefined }));
  const aliasId = app.routes[0].id;
  const selected = app.routes.flatMap(route => route.operations);
  reconcilePreviewService(config, instance, manifest as never);
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].id, aliasId);
  assert.equal(app.routes[0].path, "/report-api/:reportId");
  assert.deepEqual(app.routes[0].operations, selected);
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});


test("an existing generated API mount gains new operations without losing request settings", () => {
  const { config, app, instance, manifest, operations } = reportApiFixture();
  app.routes = app.routes.slice(0, 1);
  const id = app.routes[0].id;
  reconcilePreviewService(config, instance, manifest as never);
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].id, id);
  assert.equal(app.routes[0].query, "format=json");
  assert.deepEqual(app.routes[0].fixedParams, { reportId: "featured" });
  assert.deepEqual(app.routes[0].operations, operations.map(operation => operation.operationId));
  assert.equal(reconcilePreviewService(config, instance, manifest as never), false);
});
