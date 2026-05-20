"use strict";

const https = require("https");

const API_URL = "https://self-notify.com/send";

// ─────────────────────────────────────────────────────────────────
// Helper: resolve a value – prefer msg field, fall back to config
// ─────────────────────────────────────────────────────────────────
function resolve(msgField, configValue) {
  return msgField !== undefined && msgField !== null && msgField !== ""
    ? msgField
    : configValue;
}

// ─────────────────────────────────────────────────────────────────
// Helper: send HTTPS POST with JSON payload, returns a Promise
// ─────────────────────────────────────────────────────────────────
function sendRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(API_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "node-red-contrib-selfnotify/1.0.0",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(
            Object.assign(new Error(`HTTP ${res.statusCode}: ${data}`), {
              statusCode: res.statusCode,
              body: data,
            })
          );
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("Request timed out after 10 s"));
    });

    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────
// Node-RED module export
// ─────────────────────────────────────────────────────────────────
module.exports = function (RED) {

  // ── Config node: stores the token so multiple nodes can share it
  function SelfNotifyConfigNode(n) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    // Token is stored as a credential
    // this.credentials.token is set automatically by Node-RED
  }

  RED.nodes.registerType("selfnotify-config", SelfNotifyConfigNode, {
    credentials: {
      token: { type: "password" },
    },
  });

  // ── Main node: selfnotify
  function SelfNotifyNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;

    // Node config properties (set in the editor)
    node.configNode = RED.nodes.getNode(n.configNode);
    node.name      = n.name;
    node.title     = n.title;
    node.subtitle  = n.subtitle;
    node.message   = n.message;
    node.alertLevel = n.alertLevel  || "active";
    node.sound     = n.sound;
    node.group     = n.group;

    node.on("input", async function (msg, send, done) {
      // ── Resolve token ──────────────────────────────────────
      const token =
        resolve(msg.token, null) ||
        (node.configNode && node.configNode.credentials
          ? node.configNode.credentials.token
          : null);

      if (!token) {
        node.error("SelfNotify: no token configured. Set it in the config node or pass msg.token.", msg);
        node.status({ fill: "red", shape: "dot", text: "no token" });
        done();
        return;
      }

      // ── Resolve message ────────────────────────────────────
      // Priority: msg.payload (string) > msg.message > node config
      let message;
      if (typeof msg.payload === "string" && msg.payload.trim() !== "") {
        message = msg.payload;
      } else if (msg.message !== undefined) {
        message = msg.message;
      } else {
        message = node.message;
      }

      if (!message || String(message).trim() === "") {
        node.error("SelfNotify: message is empty. Pass msg.payload or set a default in the node config.", msg);
        node.status({ fill: "red", shape: "dot", text: "empty message" });
        done();
        return;
      }

      // ── Build payload ──────────────────────────────────────
      const payload = { token, message: String(message) };

      const title = resolve(msg.title, node.title);
      if (title) payload.title = title;

      const subtitle = resolve(msg.subtitle, node.subtitle);
      if (subtitle) payload.subtitle = subtitle;

      const alertLevel = resolve(msg.alertLevel || msg.alert_level, node.alertLevel);
      if (alertLevel) payload.alert_level = alertLevel;

      const sound = resolve(msg.sound, node.sound);
      if (sound) payload.sound = sound;

      const group = resolve(msg.group, node.group);
      if (group) payload.group = group;

      // ── Custom attributes: msg.custom or top-level msg.custom_* keys ──
      // Accept either msg.custom = { key: value } object
      // or individual msg.custom_xxx properties
      if (msg.custom && typeof msg.custom === "object" && !Array.isArray(msg.custom)) {
        for (const [k, v] of Object.entries(msg.custom)) {
          payload[`custom_${k}`] = String(v);
        }
      }
      // Also pick up any top-level msg.custom_* keys
      for (const key of Object.keys(msg)) {
        if (key.startsWith("custom_")) {
          payload[key] = String(msg[key]);
        }
      }

      // ── Send ───────────────────────────────────────────────
      node.status({ fill: "blue", shape: "dot", text: "sending…" });

      try {
        const result = await sendRequest(payload);
        node.status({ fill: "green", shape: "dot", text: `sent (${result.statusCode})` });
        msg.selfnotify = { statusCode: result.statusCode, body: result.body };
        send(msg);
        done();
      } catch (err) {
        const code = err.statusCode;
        let hint = err.message;
        if (code === 401 || code === 403) hint = "invalid token";
        else if (code === 406) hint = "daily limit reached";
        else if (code === 429) hint = "rate limited";

        node.status({ fill: "red", shape: "ring", text: hint });
        node.error(`SelfNotify: ${err.message}`, msg);
        done(err);
      }
    });

    node.on("close", function () {
      node.status({});
    });
  }

  RED.nodes.registerType("selfnotify", SelfNotifyNode);
};
