# Discovery: VK Migration — Parallel Messenger Support

## Metadata
| Field | Value |
|-------|-------|
| Date | 2026-04-04 |
| Status | Discovery complete |

## Problem

Telegram is unreliable for ~70% of the team (Russia-based): push notifications don't arrive, auth via Telegram bot requires VPN, overall UX is degraded. The remaining ~30% (outside Russia) continue to use Telegram without issues.

The team already uses VK for daily communication.

## Summary

Add parallel VK support to the existing Telegram-based Task Manager. Telegram stays for the 30% abroad, VK becomes the primary channel for the 70% in Russia.

Two independent concerns:
1. **Portal authentication** — currently Telegram-only (Widget, WebApp, web-login via bot). Needs VK ID OAuth as alternative.
2. **Bot communication** — notifications, commands, task management. Needs VK bot (vkbottle) alongside Telegram bot (aiogram).

## Current Telegram Integration Depth

| Layer | Details |
|-------|---------|
| Bot (6 routers) | Tasks, updates, voice, summary, settings, meetings |
| Auth (3 methods) | Telegram Widget, WebApp initData, Web-login via bot |
| Notifications | NotificationService sends to Telegram chats |
| Voice tasks | Voice message → Whisper → AI parse |
| Broadcasts | TelegramBroadcast + TelegramNotificationTarget |
| Content module | Pyrofork userbot for channel downloads |
| DB | telegram_id / telegram_username in TeamMember — key identifier |

## VK API Capabilities

| Feature | VK Bot API | Notes |
|---------|-----------|-------|
| Messages, inline keyboards, callbacks | ✅ | vkbottle 4.8 |
| FSM / states | ✅ | Built-in |
| Voice messages | ✅ | Speech uploader |
| Files, media | ✅ | Photo, doc, audio, video |
| Webhooks + Long Polling | ✅ | Callback API |
| Async Python | ✅ | vkbottle |
| OAuth for web portal | ✅ | VK ID SDK (@vkid/sdk), OAuth 2.1 |

## Implementation Plan

### Phase 1 (urgent): VK ID OAuth — Portal Authentication
- VK ID SDK (@vkid/sdk v2.6) on frontend
- OAuth 2.1 callback endpoint on backend
- Login page: user chooses Telegram or VK login
- DB: add `vk_id` field to TeamMember
- JWT issued same way regardless of auth method

### Phase 2: VK Bot — Notifications
- VK community bot via vkbottle 4.8
- Notifications about tasks and meetings to VK groups/chats
- Per-user setting: receive notifications in Telegram, VK, or both
- New DB model: VKNotificationTarget (analogous to TelegramNotificationTarget)

### Phase 3 (future): Full VK Bot Feature Parity
- All bot commands (tasks, voice, summary, settings)
- Abstract messenger layer (MessengerAdapter) to share business logic:
  ```
  TaskService / NotificationService
          ↓
  MessengerAdapter (abstract)
      ├── TelegramAdapter (aiogram)
      └── VKAdapter (vkbottle)
  ```
- Gradual migration of all Telegram bot features

## Key Decisions
- Chosen approach: Telegram + VK parallel support (not replacement)
- Auth: VK ID OAuth 2.1 for portal login
- Bot: vkbottle 4.8 (async, typed, FSM built-in)
- Architecture: abstract messenger layer for Phase 3

## Out of Scope
- MAX messenger support (not needed — team uses VK)
- Telegram removal (stays for international team members)
- VK broadcasts (deferred to after Phase 3)
- Content module VK integration (Pyrofork stays Telegram-only)

## Open Questions
- VK community/group setup — who creates it, what permissions?
- VK ID app registration — client_id, redirect URIs
- Per-user messenger preference storage — new field or separate table?
- Phase 3 timeline — when to start abstracting messenger layer?

## Tech Stack Additions
- **Python:** vkbottle >= 4.8.0
- **Frontend:** @vkid/sdk >= 2.6.0
- **DB migration:** add vk_id to team_members, new VK notification tables
