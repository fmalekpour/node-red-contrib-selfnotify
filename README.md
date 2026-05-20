# node-red-contrib-selfnotify

A Node-RED node that sends push notifications to your iOS or Android devices via [SelfNotify](https://self-notify.com).

## Installation

### From the Node-RED palette manager

Search for **selfnotify** in the Node-RED palette manager (hamburger menu → Manage palette → Install).

### Manually

```bash
cd ~/.node-red
npm install node-red-contrib-selfnotify
```

Then restart Node-RED.

---

## Usage

1. **Install the SelfNotify app** on your iPhone or Android device.
2. **Copy your token** from the app's main screen.
3. **Drop a `selfnotify` node** onto your flow.
4. **Open the node** and create a new *SelfNotify account* config — paste your token.
5. Wire any inject/function/trigger node into it. The node sends a push notification whenever it receives a message.

---

## Quick example

### Simple text notification

Wire an **inject** node (with a string payload) directly into the `selfnotify` node:

```
[Inject: "Hello from Node-RED"] → [selfnotify]
```

The inject's `msg.payload` becomes the notification body.

### Dynamic notification from a function node

```javascript
msg.title      = "Server Alert";
msg.payload    = "/var is 94% full";
msg.alertLevel = "time-sensitive";
msg.sound      = "snd08";
msg.group      = "infrastructure";
msg.custom     = { server: "web-01", partition: "/var", usage: "94%" };
return msg;
```

---

## Input properties

All properties except `msg.payload` are optional and override the defaults
configured in the node's editor panel.

| Property | Type | Description |
|---|---|---|
| `msg.payload` | string | **Notification body** (required if *Message* field is blank). |
| `msg.token` | string | Overrides the account token for this message only. |
| `msg.title` | string | Bold heading displayed above the body. |
| `msg.subtitle` | string | Secondary line below the title. |
| `msg.alertLevel` | string | `active` (default), `passive`, `time-sensitive`, or `critical`. |
| `msg.sound` | string | Sound name without extension: `snd01`–`snd16` or `cs1`, `cs2` … |
| `msg.group` | string | Category label for filtering in the app. |
| `msg.custom` | object | Key/value pairs attached as custom attributes and shown in the notification detail view. |
| `msg.custom_*` | string | Alternatively set individual `msg.custom_xxx` keys directly. |

## Output properties

The original `msg` is passed through with one extra property added:

| Property | Type | Description |
|---|---|---|
| `msg.selfnotify` | object | `{ statusCode, body }` — raw response from the SelfNotify API. |

---

## Alert levels

| Value | Behavior |
|---|---|
| `active` | Plays sound and shows a heads-up banner (default). |
| `passive` | Silent delivery — appears in notification center / shade only. |
| `time-sensitive` | Breaks through Focus / Do Not Disturb if the app is allowed. |
| `critical` | Highest priority, may bypass DND entirely. Use sparingly. |

---

## Example flows

### Import this JSON into Node-RED (File → Import)

```json
[
  {
    "id": "sn-inject",
    "type": "inject",
    "name": "Test",
    "props": [{ "p": "payload" }],
    "payload": "Hello from Node-RED!",
    "payloadType": "str",
    "wires": [["sn-node"]]
  },
  {
    "id": "sn-node",
    "type": "selfnotify",
    "name": "Push notification",
    "configNode": "sn-config",
    "title": "Node-RED",
    "alertLevel": "active",
    "wires": [["sn-debug"]]
  },
  {
    "id": "sn-debug",
    "type": "debug",
    "name": "Response",
    "active": true,
    "tosidebar": true,
    "complete": "selfnotify"
  },
  {
    "id": "sn-config",
    "type": "selfnotify-config",
    "name": "My SelfNotify account"
  }
]
```

> Set your token in the `selfnotify-config` node before deploying.

---

## Troubleshooting

| Status shown on node | Likely cause |
|---|---|
| `no token` | Token not set in config node and `msg.token` not provided. |
| `empty message` | `msg.payload` is not a string and no default message is configured. |
| `invalid token` | Token does not match the app. Verify it and re-paste if needed. |
| `daily limit reached` | Free tier allows 20 notifications per day. |
| `rate limited` | Too many requests in a short window — add a delay node. |

---

## Links

- [SelfNotify API documentation](https://self-notify.com/docs.html)
- [SelfNotify on the App Store](https://itunes.bejbej.ca/selfnotify)
- [SelfNotify on Google Play](https://play.google.com/store/apps/details?id=com.dayananetworks.selfnotify)
