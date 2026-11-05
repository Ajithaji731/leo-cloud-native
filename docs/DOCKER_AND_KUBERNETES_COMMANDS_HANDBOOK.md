# 🛠️ SRE & DevOps Handbook: Docker, Docker Compose & Kubernetes (`kubectl`)
> **Created For**: Ajith | SRE & Cloud Systems Engineering  
> **Architecture**: Apple Silicon (`arm64`), Docker Desktop, Kind Kubernetes, Node.js Microservices  
> **Core Principle**: Every command includes **Exact Syntax**, **What It Does**, **Why / What Is The Use**, and **Real-World Output**.

---

## 📑 Table of Contents
1. [Docker CLI Essentials](#1-docker-cli-essentials)
2. [Docker Compose Microservices Management](#2-docker-compose-microservices-management)
3. [Kubernetes (`kubectl`) Cluster Operations](#3-kubernetes-kubectl-cluster-operations)
4. [Kubernetes Deployments & Pod Management](#4-kubernetes-deployments--pod-management)
5. [Kubernetes Services & Networking](#5-kubernetes-services--networking)
6. [Scaling & SRE Resilience (Self-Healing & Rollouts)](#6-scaling--sre-resilience-self-healing--rollouts)
7. [Debugging & Troubleshooting Pods](#7-debugging--troubleshooting-pods)
8. [Mental Model Reference Card](#8-mental-model-reference-card)

---

## 1. Docker CLI Essentials

### `docker ps`
- **What it does**: Lists all currently **running** Docker containers.
- **Why / What is the use**: As an SRE, this is your first diagnostic check to verify which microservices are alive, their container IDs, port bindings, and health statuses (`healthy` vs `unhealthy`).
- **Syntax**:
  ```bash
  docker ps
  ```
- **Example Output**:
  ```text
  CONTAINER ID   IMAGE                        STATUS                   PORTS                    NAMES
  7af96ed24edf   ai-agent-ai-agent-service    Up 10 minutes (healthy)  0.0.0.0:8080->8080/tcp   ai-agent-service
  317db2a9b7eb   ai-agent-wealthflow-service  Up 2 minutes (healthy)   0.0.0.0:8082->8082/tcp   wealthflow-service
  6cfd03b0feeb   ai-agent-habit-service       Up 6 hours (healthy)     0.0.0.0:8081->8081/tcp   habit-service
  ```

---

### `docker ps -a`
- **What it does**: Lists **all** containers, including stopped, exited, or crashed containers.
- **Why / What is the use**: If a service failed to start or crashed, `docker ps` will hide it. `docker ps -a` reveals crashed containers with their exit code (e.g., `Exited (137)` for out-of-memory or `Exited (0)` for clean shutdown).
- **Syntax**:
  ```bash
  docker ps -a
  ```

---

### `docker images`
- **What it does**: Lists all locally built or pulled Docker container images on your machine.
- **Why / What is the use**: Verifies the image name, tag (e.g., `:latest`), image ID, and size. Ensures that multi-stage builds kept the image lightweight (~50MB instead of 1GB).
- **Syntax**:
  ```bash
  docker images | grep -E "ai-agent|habit|wealth"
  ```
- **Example Output**:
  ```text
  ai-agent-ai-agent-service    latest    b7057fb79e02    49.8MB
  ai-agent-habit-service       latest    32a565f883f4    49.8MB
  ai-agent-wealthflow-service  latest    057ea7dec2aa    49.8MB
  ```

---

### `docker logs <container-name> --tail <N>`
- **What it does**: Displays the console standard output (`stdout` / `stderr`) from inside a container.
- **Why / What is the use**: When a microservice misbehaves or returns an HTTP 500 error, you use logs to inspect stack traces, incoming HTTP queries, and background sync confirmations.
- **Syntax**:
  ```bash
  docker logs ai-agent-service --tail 50
  docker logs -f habit-service  # -f streams live logs continuously
  ```

---

### `docker exec -it <container-name> <command>`
- **What it does**: Executes a command directly inside an isolated, running container.
- **Why / What is the use**: Used for internal troubleshooting, such as running a shell (`sh`), testing local file contents, or running ad-hoc node scripts inside the container's isolated network.
- **Syntax**:
  ```bash
  docker exec -it ai-agent-service sh
  ```

---

## 2. Docker Compose Microservices Management

### `docker compose up -d --build`
- **What it does**: Builds the Docker images from their Dockerfiles and starts all services in the background (detached mode `-d`).
- **Why / What is the use**: One single command that compiles your entire multi-container architecture, creates the internal network bridge (`app-net`), and mounts health checks.
- **Syntax**:
  ```bash
  docker compose up -d --build
  ```

---

### `docker compose up -d --build <service-name>`
- **What it does**: Rebuilds and restarts only **one specific microservice** without touching the other running services.
- **Why / What is the use**: Prevents unnecessary downtime. When you modify `portfolioEngine.js` in `wealthflow-service`, you rebuild only that service; `habit-service` and `ai-agent-service` remain online without interruption.
- **Syntax**:
  ```bash
  docker compose up -d --build wealthflow-service
  ```

---

### `docker compose stop` & `docker compose start`
- **What it does**:
  - `stop`: Sends `SIGTERM` to gracefully pause all 3 containers without deleting them.
  - `start`: Wakes up all paused containers in ~1 second.
- **Why / What is the use**: Used at the end of the workday to free up Mac CPU and battery without destroying cached data.
- **Syntax**:
  ```bash
  docker compose stop   # Cleanly pauses all 3 containers
  docker compose start  # Resumes all 3 containers instantly
  ```

---

### `docker compose down`
- **What it does**: Stops and completely removes the containers and user-defined networks.
- **Why / What is the use**: Full cleanup when you want a completely fresh start or when transitioning to Kubernetes.
- **Syntax**:
  ```bash
  docker compose down
  ```

---

## 3. Kubernetes (`kubectl`) Cluster Operations

### `kubectl get nodes`
- **What it does**: Lists all physical or virtual servers (nodes) participating in the Kubernetes cluster.
- **Why / What is the use**: SRE step zero. Verifies that the Kubernetes Control Plane is online, healthy (`STATUS: Ready`), and reports the Kubernetes version.
- **Syntax**:
  ```bash
  kubectl get nodes
  ```
- **Example Output**:
  ```text
  NAME                    STATUS   ROLES           AGE   VERSION
  desktop-control-plane   Ready    control-plane   61s   v1.36.1
  ```

---

### `kubectl cluster-info`
- **What it does**: Displays the endpoint URLs for the Kubernetes master API server and internal CoreDNS service.
- **Why / What is the use**: Confirms where `kubectl` is sending commands and validates network connectivity to the cluster API.
- **Syntax**:
  ```bash
  kubectl cluster-info
  ```

---

## 4. Kubernetes Deployments & Pod Management

### `kubectl apply -f <path>`
- **What it does**: Declaratively creates or updates Kubernetes resources defined in YAML files.
- **Why / What is the use**: Core SRE Infrastructure-as-Code (IaC) command. Instead of manually clicking buttons or typing imperative commands, you define the desired state in YAML, and Kubernetes reconciles reality to match your file.
- **Syntax**:
  ```bash
  # Apply all YAML files in the k8s folder
  kubectl apply -f k8s/

  # Apply a single service manifest
  kubectl apply -f k8s/habit-service.yaml
  ```

---

### `kubectl get deployments`
- **What it does**: Shows the status of your microservice Deployments.
- **Why / What is the use**: Tells you how many replicas you configured (`DESIRED`) vs how many are currently alive and passing health checks (`READY` and `AVAILABLE`).
- **Syntax**:
  ```bash
  kubectl get deployments
  ```
- **Example Output**:
  ```text
  NAME                 READY   UP-TO-DATE   AVAILABLE   AGE
  ai-agent-service     1/1     1            1           10m
  habit-service        2/2     2            2           10m
  wealthflow-service   2/2     2            2           10m
  ```

---

### `kubectl get pods` & `kubectl get pods -o wide`
- **What it does**: Lists all individual running Pods in the current namespace.
- **Why / What is the use**: Inspects individual pod health, restart counts, and status (`Running`, `ContainerCreating`, `CrashLoopBackOff`). The `-o wide` flag displays internal cluster IP addresses and which node is hosting each pod.
- **Syntax**:
  ```bash
  kubectl get pods
  kubectl get pods -o wide
  ```
- **Example Output**:
  ```text
  NAME                                  READY   STATUS    RESTARTS   AGE
  ai-agent-service-58b7555657-xqpd9     1/1     Running   0          10m
  habit-service-6898df9f64-dq9jg        1/1     Running   0          10m
  habit-service-6898df9f64-jdkck        1/1     Running   0          10m
  wealthflow-service-64cdb876c9-ddn8g   1/1     Running   0          10m
  wealthflow-service-64cdb876c9-xj5sf   1/1     Running   0          10m
  ```

---

## 5. Kubernetes Services & Networking

### `kubectl get services` (or `kubectl get svc`)
- **What it does**: Lists all active Kubernetes Services, their virtual IP addresses (`CLUSTER-IP`), and port mappings.
- **Why / What is the use**: Pods are ephemeral (their IP addresses change when recreated). A **Service** provides a permanent static IP and DNS name (e.g. `http://habit-service:8081`) that internal microservices use to communicate with each other.
- **Syntax**:
  ```bash
  kubectl get svc
  ```
- **Example Output**:
  ```text
  NAME                 TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
  ai-agent-service     LoadBalancer   10.96.234.149   localhost     8080:31375/TCP   10m
  habit-service        ClusterIP      10.96.118.223   <none>        8081/TCP         10m
  wealthflow-service   ClusterIP      10.96.44.3      <none>        8082/TCP         10m
  ```

> [!NOTE]
> - **`ClusterIP`**: Accessible **only inside** the Kubernetes cluster (used for internal backends: `habit-service` and `wealthflow-service`).
> - **`LoadBalancer`**: Exposes the port outside the cluster (routes port `8080` to your Mac's browser for `ai-agent-service`).

---

## 6. Scaling & SRE Resilience (Self-Healing & Rollouts)

### `kubectl scale deployment <name> --replicas=<N>`
- **What it does**: Dynamically increases or decreases the number of running Pods for a microservice without restarting the cluster.
- **Why / What is the use**: In production, if traffic surges on salary day or during market open, an SRE scales the portfolio service from 2 pods to 10 pods in seconds.
- **Syntax**:
  ```bash
  # Scale habit-service to 4 pods
  kubectl scale deployment habit-service --replicas=4

  # Scale back down to 2 pods
  kubectl scale deployment habit-service --replicas=2
  ```

---

### `kubectl delete pod <pod-name>` (The Self-Healing Test)
- **What it does**: Forcefully terminates a specific pod.
- **Why / What is the use**: Demonstrates Kubernetes resilience. When you kill a pod, the Deployment Controller notices that `actual replicas (1)` does not match `desired replicas (2)` and immediately spawns a brand-new replacement pod in under 1 second.
- **Syntax**:
  ```bash
  kubectl delete pod habit-service-6898df9f64-dq9jg
  ```

---

### `kubectl rollout restart deployment <name>`
- **What it does**: Triggers a **zero-downtime rolling update** of all pods in a deployment.
- **Why / What is the use**: Used when deploying updated code or refreshing in-memory caches. Kubernetes starts a new pod with the latest code, waits for its `/healthz` readiness probe to succeed, and only then shuts down the old pod. Users never see a dropped request.
- **Syntax**:
  ```bash
  kubectl rollout restart deployment ai-agent-service
  kubectl rollout status deployment ai-agent-service
  ```

---

## 7. Debugging & Troubleshooting Pods

### `kubectl describe pod <pod-name>`
- **What it does**: Displays detailed metadata, resource limits, health probe status, and a chronological history of Kubernetes **Events** for that pod.
- **Why / What is the use**: The #1 debugging tool in Kubernetes. If a pod is stuck in `Pending` or `CrashLoopBackOff`, the `Events` section at the bottom tells you exactly why (e.g. `OOMKilled`, `FailedToPullImage`, or `Liveness probe failed`).
- **Syntax**:
  ```bash
  kubectl describe pod ai-agent-service-58b7555657-xqpd9
  ```

---

### `kubectl logs <pod-name>`
- **What it does**: Prints the application console logs from inside a Kubernetes pod.
- **Why / What is the use**: Allows you to read Node.js application output, verify fast-path latency (`"Logged in 20ms"`), or inspect API errors without needing SSH access to the server.
- **Syntax**:
  ```bash
  kubectl logs -l app=habit-service --tail 50
  ```

---

### `kubectl port-forward <pod-or-service> <local-port>:<container-port>`
- **What it does**: Opens a direct tunnel from your Mac terminal into an internal cluster resource.
- **Why / What is the use**: Allows an engineer to query an internal `ClusterIP` service (like `habit-service` on port 8081) directly from their Mac terminal without exposing it to the public internet.
- **Syntax**:
  ```bash
  kubectl port-forward svc/habit-service 8081:8081
  ```

---

## 8. Mental Model Reference Card

| Concept | Docker / Docker Compose | Kubernetes (`kubectl`) |
| :--- | :--- | :--- |
| **Unit of Execution** | Container (`docker run`) | Pod (`kind: Pod` inside `kind: Deployment`) |
| **Orchestration File** | `docker-compose.yml` | Declarative YAMLs (`k8s/*.yaml`) |
| **Networking** | User-defined bridge (`app-net`) | Internal Cluster DNS (`CoreDNS`) + `ClusterIP` / `LoadBalancer` |
| **High Availability** | 1 container on 1 machine | Multiple Pod Replicas distributed across cluster nodes |
| **Crash Handling** | Container restart policy (`restart: always`) | Controller Self-Healing (re-creates pod in < 1 second) |
| **Updates** | `docker compose up -d --build` (brief drop) | Zero-Downtime Rolling Update (`kubectl rollout`) |
