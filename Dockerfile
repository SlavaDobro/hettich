FROM python:3.13-slim

# bsdtar собирает архив 7z, rar (раздел non-free Debian) — архив RAR. ZIP делает сам Python.
# ffmpeg — обложки и длительность видео; LibreOffice + poppler — слайды презентаций и обложки PDF;
# шрифты — чтобы кириллица на слайдах не превращалась в «квадратики».
RUN sed -i 's/^Components: main$/Components: main non-free/' /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends libarchive-tools \
      ffmpeg poppler-utils libreoffice-impress \
      fonts-dejavu-core fonts-liberation fonts-liberation-sans-narrow fonts-crosextra-carlito fonts-crosextra-caladea \
 && (apt-get install -y --no-install-recommends rar || echo "rar недоступен — архив RAR собираться не будет") \
 && fc-cache -f \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    HOST=0.0.0.0 \
    PORT=8765 \
    MAX_UPLOAD_GB=10

WORKDIR /app
COPY server.py ./
COPY web ./web

# Материалы, архивы, обложки и база подключаются томами (см. docker-compose.yml)
RUN mkdir -p files archives assets/covers data \
 && useradd --uid 10001 --no-create-home hettich \
 && chown -R hettich /app
USER hettich

EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/login', timeout=4)" || exit 1

CMD ["python", "server.py"]
