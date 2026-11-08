FROM jenkins/jenkins:lts-jdk21

USER root

RUN apt-get update && \
    apt-get install -y docker.io curl ca-certificates && \
    curl -LO "https://dl.k8s.io/release/v1.37.0/bin/linux/arm64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm -f kubectl && \
    rm -rf /var/lib/apt/lists/*

USER jenkins