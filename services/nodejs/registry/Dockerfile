ARG BSB_IMAGE_TAG=node-latest

FROM betterweb/service-base:${BSB_IMAGE_TAG} AS builder
WORKDIR /workspace
ENV PATH="/home/bsb/lib/scripts:${PATH}"
COPY framework/nodejs ./framework/nodejs
COPY services/nodejs/registry ./services/nodejs/registry
RUN mkdir -p /workspace/packages && cd framework/nodejs && npm install --include=dev && npm run build && npm pack --pack-destination /workspace/packages
RUN cd services/nodejs/registry && npm install --include=dev && npm install --no-save /workspace/packages/*.tgz && npm run build && npm prune --omit=dev
RUN set -eux; \
  cd services/nodejs/registry; \
  VERSION="$(node -p "require('./package.json').version")"; \
  MAJOR="$(echo "${VERSION}" | cut -d. -f1)"; \
  MINOR="$(echo "${VERSION}" | cut -d. -f2)"; \
  MICRO="$(echo "${VERSION}" | cut -d. -f3)"; \
  TARGET="/out/@betterportal/registry/${MAJOR}/${MINOR}/${MICRO}"; \
  mkdir -p "${TARGET}"; \
  cp -a package.json bsb-plugin.json lib node_modules README.md "${TARGET}/"

FROM betterweb/service-base:${BSB_IMAGE_TAG}
COPY --chown=node:node --from=builder /out/ /mnt/plugins/
COPY --chown=node:node services/nodejs/registry/sec-config.yaml /home/bsb/sec-config.yaml
ENV BSB_PLUGIN_DIRS=/mnt/plugins
ENV BSB_PLUGINS=@bsb/registry@9.6
EXPOSE 3210 3211
