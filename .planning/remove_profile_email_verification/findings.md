# Findings

- Registration already requires OTP and inserts `users.email_verified_at = NOW()`.
- `ProfilePage.tsx` duplicates account-email OTP state, handlers, UI, reminder text, and status.
- Emergency-contact email has a separate OTP flow; it was not verified at registration and should remain distinct.
- Login/profile completeness currently combines profile fields with both account-email and emergency-email verification.
- Removing account-email re-verification should also keep the registered account email read-only in profile rather than silently allowing an unverified replacement.
- The profile email-change modal is only a stub and never updates the backend; removing its trigger avoids a misleading workflow.
- Decision: remove all profile email OTP controls (account and emergency contact) and make feature access depend on required profile fields only. Registration OTP remains unchanged.
- User reports a remaining “email verified” label and that saving a completed profile still redirects/prompts for completion; this indicates either another UI surface or stale/auth-store state plus a field-mapping mismatch.
- Global text search shows account-email “verified” copy only in registration (expected); remaining ProfilePage “Đã xác thực” strings appear to belong to phone verification and need contextual confirmation.
- First sanitized DB lookup missed because the email inferred from the screenshot was transcribed without the extra `a`; rerun against the exact address shown.
- Profile contact UI still contains a redundant `Email tài khoản` status chip; the visible “Đã xác thực” labels in that area are phone-only.
- The email used on the earlier registration screenshot has no `users` row yet, indicating that OTP was sent but account creation was not completed under that exact address.
- Sanitized recent-user inspection shows the newest `gi***@gmail.com` account has every required profile field and backend-computed completeness is true.
- Root cause of the repeated prompt: `showRequireProfileAlert` is initialized from router state `requireProfile`, but successful profile save never clears that router state or closes the alert. The persisted prompt is stale UI, not missing database data.
- `ProfilePage` already has `useNavigate` and the original destination in `location.state.from`, so successful completion can close the alert, clear state, and return the user to the originally requested page.
