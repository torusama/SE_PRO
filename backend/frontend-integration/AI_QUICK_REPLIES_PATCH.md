# Frontend patch for AI quick replies

Backend v17 returns a new `data.quickReplies` field for relevant assistant turns.

Example:

```json
{
  "assistantMessage": "Chào bạn!...",
  "quickReplies": [
    {
      "id": "help-plots",
      "label": "Gợi ý lô phù hợp",
      "message": "Gợi ý cho mình vài lô phù hợp nhé.",
      "emphasis": "strong"
    }
  ]
}
```

## Integration

1. Add `quickReplies?: AiQuickReply[]` to the frontend AI message/response type.
2. When storing an assistant response, preserve `response.data.quickReplies ?? []`.
3. Render `QuickReplies` immediately under that assistant bubble.
4. Pass the same function currently used when the user presses Send:

```tsx
<QuickReplies
  items={message.quickReplies}
  disabled={isSending}
  onSend={(text) => sendChatMessage(text)}
/>
```

The button uses underlined text. Items with `emphasis: "strong"` are also bold. Clicking does **not** call a privileged backend action directly; it submits the natural-language `message` through the normal AI chat endpoint, so normal authorization and confirmation rules remain enforced.

Conversation history also returns `response.quickReplies`, so the suggestions survive a reload.
