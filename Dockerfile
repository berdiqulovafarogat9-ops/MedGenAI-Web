FROM nginx:1.27-alpine
# Build-time downloads are pinned to Three.js r128; browser runtime uses same-origin files only.
RUN apk add --no-cache curl \
 && mkdir -p /usr/share/nginx/html/models /usr/share/nginx/html/vendor \
 && curl -fLsS --retry 3 --retry-delay 2 "https://dbkxgbeisgyjilflkneq.supabase.co/storage/v1/object/public/models/full_skeleton.glb" -o /usr/share/nginx/html/models/full_skeleton.glb \
 && echo "fa91ad49eef6463ff3df2b38219aa70b40e58dfc227421ae2b41329ac137c304  /usr/share/nginx/html/models/full_skeleton.glb" | sha256sum -c - \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js" -o /usr/share/nginx/html/vendor/three.min.js \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" -o /usr/share/nginx/html/vendor/OrbitControls.js \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js" -o /usr/share/nginx/html/vendor/GLTFLoader.js \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js" -o /usr/share/nginx/html/vendor/DRACOLoader.js \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/draco_decoder.wasm" -o /usr/share/nginx/html/vendor/draco_decoder.wasm \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/draco_wasm_wrapper.js" -o /usr/share/nginx/html/vendor/draco_wasm_wrapper.js \
 && curl -fLsS --retry 3 --retry-delay 2 "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/draco_decoder.js" -o /usr/share/nginx/html/vendor/draco_decoder.js \
 && test -s /usr/share/nginx/html/vendor/three.min.js \
 && test -s /usr/share/nginx/html/vendor/OrbitControls.js \
 && test -s /usr/share/nginx/html/vendor/GLTFLoader.js \
 && test -s /usr/share/nginx/html/vendor/DRACOLoader.js \
 && test -s /usr/share/nginx/html/vendor/draco_decoder.wasm \
 && test -s /usr/share/nginx/html/vendor/draco_wasm_wrapper.js \
 && test -s /usr/share/nginx/html/vendor/draco_decoder.js \
 && apk del curl
COPY legal.html app.js ux.js opportunities.js styles.css phase1-academy.js phase1-shell.js phase1-controller.js security-2fa.js visuals.js billing.js reports-pdf.js screening.js notice.js academy-plus.js vitals-core.js vitals-sim.js anatomy-quiz.js anatomy-3d.js /usr/share/nginx/html/
COPY index-final.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
