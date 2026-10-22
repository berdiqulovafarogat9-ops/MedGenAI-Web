FROM nginx:1.27-alpine
COPY legal.html app.js ux.js opportunities.js styles.css phase1-academy.js phase1-shell.js phase1-controller.js security-2fa.js visuals.js /usr/share/nginx/html/
COPY index-1.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
