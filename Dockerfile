FROM node:26-bookworm-slim AS ui
WORKDIR /ui
COPY web-ui/package*.json ./
RUN npm ci
COPY web-ui/ ./
RUN npm run build

FROM python:3.14-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORTAL_STATIC_DIR=/app/static
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unixodbc && \
    curl -fsSLo /tmp/microsoft.deb https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb && \
    dpkg -i /tmp/microsoft.deb && rm /tmp/microsoft.deb && apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 && \
    rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home portal
COPY pricing-microservice/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY pricing-microservice/app ./app
COPY --from=ui /ui/dist ./static
USER 10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
