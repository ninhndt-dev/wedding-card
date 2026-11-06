FROM maven:3.9-eclipse-temurin-25 AS api-build
WORKDIR /workspace
COPY shared ./shared
COPY apps/api ./apps/api
RUN mvn -q -f apps/api/pom.xml package

FROM eclipse-temurin:25-jre AS api
WORKDIR /app
RUN mkdir -p /app/uploads && chown -R 10001:10001 /app
COPY --from=api-build /workspace/apps/api/target/wedding-api-1.0.0-SNAPSHOT.jar /app/api.jar
ENV UPLOAD_DIR=/app/uploads API_PORT=8086
USER 10001:10001
EXPOSE 8086
ENTRYPOINT ["java","-jar","/app/api.jar"]

FROM node:22-slim AS web-build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY apps/web ./apps/web
COPY shared ./shared
RUN npm run build -w @wedding/web

FROM nginx:stable-alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
