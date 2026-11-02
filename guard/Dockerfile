FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git curl libcurl4-openssl-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /src \
 && cmake -B /src/build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON \
 && cmake --build /src/build -j"$(nproc)" --target llama-server \
 && cp /src/build/bin/llama-server /usr/local/bin/llama-server \
 && rm -rf /src

WORKDIR /app
EXPOSE 8322
ENTRYPOINT ["/usr/local/bin/llama-server"]
