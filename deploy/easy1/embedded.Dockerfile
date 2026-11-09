FROM code.bettercorp.dev/bettercorp/service-base:node-latest
WORKDIR /home/bsb
ENV BSB_PLUGIN_DIRS=""
ADD https://raw.githubusercontent.com/BetterCorp/BetterPortal/deploy/easy1/package.json /tmp/betterportal-release.json
RUN BP_VERSION="$(node -e 'const v=require("/tmp/betterportal-release.json").version;if(!/^\d+\.\d+\.\d+$/.test(v))throw Error("Invalid release version");process.stdout.write(v)')" && npm install --omit=dev --save-exact @bsb/base@9.7.5 @bsb/config-vault@9.7.5 @bsb/observable-axiom@9.7.5 @betterportal/theme-embedded@${BP_VERSION} anyvali@1.1.7 
RUN sed -i -e '/^chown -R node:node \/home\/bsb$/d' -e '/^find \/home\/bsb -type d /d' -e '/^find \/home\/bsb -type f /d' /home/bsb/entrypoint.sh
RUN node -e 'const fs=require("node:fs"),assert=require("node:assert/strict");const BP_VERSION=JSON.parse(fs.readFileSync("/tmp/betterportal-release.json","utf8")).version;const expected={"@bsb/base":"9.7.5","@bsb/config-vault":"9.7.5","@bsb/observable-axiom":"9.7.5","anyvali":"1.1.7","@betterportal/theme-embedded":BP_VERSION,"@betterportal/framework":BP_VERSION,"@betterportal/plugin-bsb":BP_VERSION};for(const [pkg,version] of Object.entries(expected)){assert.equal(JSON.parse(fs.readFileSync("node_modules/"+pkg+"/package.json","utf8")).version,version)}'
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 CMD node -e "fetch('http://127.0.0.1:80/.well-known/bp/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
