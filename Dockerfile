FROM nginx:1.27-alpine
COPY index.html legal.html app.js styles.css phase1-academy.js phase1-shell.js phase1-controller.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
