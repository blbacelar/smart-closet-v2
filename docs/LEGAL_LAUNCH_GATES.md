# Fitly legal and privacy launch gates

This file is an engineering release checklist, not legal advice. A qualified
lawyer should approve the final policies, notices, and geographic launch scope.

## Enforced in code

- Account entry asks for date of birth before any authentication request. Fitly
  blocks people under 18 and stores only the confirmation timestamp.
- New private image uploads require a profile with `adult_confirmed_at`.
- The app uses platform fonts and contains no remote Google Fonts request.
- No session-replay SDK is installed. Telemetry adapters receive nothing unless
  the app is explicitly constructed with granted analytics consent.
- The shared marketing-email builder refuses messages without recorded consent,
  sender identity, a mailing address, and an HTTPS unsubscribe URL.
- The beta Pro screen cannot purchase anything and states that price, duration,
  automatic renewal, and cancellation instructions must appear beside a future
  purchase button.
- The Profile screen contains a copyright-report workflow. Its action remains
  disabled until a valid reporting address is configured.

## Required before public marketplace listings or paid launch

- [ ] Identify the operating legal entity and have counsel approve Terms of Use
  and the Privacy Policy for every launch region.
- [ ] Configure `EXPO_PUBLIC_COPYRIGHT_EMAIL` with a monitored reporting address.
- [ ] If seeking U.S. DMCA safe-harbor protection, register and maintain a
  designated agent with the U.S. Copyright Office and publish the same current
  contact information. Registration is an external legal action and cannot be
  completed in source code.
- [ ] Implement an auditable notice-and-takedown procedure, including repeat
  infringer handling and counter-notice review, before users can publish items.
- [ ] Keep public user-generated listings disabled until the preceding copyright
  steps are complete.
- [ ] Obtain and record the required marketing consent. Configure the legal
  sender name, a current mailing address, and a working one-step unsubscribe
  endpoint before any commercial email or SMS is sent.
- [ ] Replace preview subscription prices with live app-store product data.
  Render the generated renewal disclosure directly beside the purchase action,
  and link final Terms and Privacy Policy before enabling checkout.
- [ ] Add a user-facing analytics consent control before attaching any analytics
  adapter. Session replay needs a separate legal/privacy review and must remain
  disabled by default; sensitive inputs and images must never be captured.

## Primary references reviewed

- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- CRTC CASL FAQ: https://crtc.gc.ca/eng/com500/faq500.htm
- FTC CAN-SPAM guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Apple auto-renewable subscriptions: https://developer.apple.com/app-store/subscriptions/
- U.S. Copyright Office DMCA agent directory: https://copyright.gov/dmca-directory/
