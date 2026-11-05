FROM nginx:1.27-alpine
# Download the verified GLB into the same-origin static asset directory at image build time.
RUN apk add --no-cache curl \
 && mkdir -p /usr/share/nginx/html/models \
 && curl -fL --retry 3 --retry-delay 2 "https://dbkxgbeisgyjilflkneq.supabase.co/storage/v1/object/public/models/full_skeleton.glb" -o /usr/share/nginx/html/models/full_skeleton.glb \
 && echo "fa91ad49eef6463ff3df2b38219aa70b40e58dfc227421ae2b41329ac137c304  /usr/share/nginx/html/models/full_skeleton.glb" | sha256sum -c - \
 && apk del curl
COPY legal.html app.js ux.js opportunities.js styles.css phase1-academy.js phase1-shell.js phase1-controller.js security-2fa.js visuals.js billing.js reports-pdf.js screening.js notice.js academy-plus.js vitals-core.js vitals-sim.js anatomy-quiz.js anatomy-3d.js /usr/share/nginx/html/
COPY index-final.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
