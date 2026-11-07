# Requirements Document

## Introduction

YesTV currently supports GitHub and QQ OAuth login through NextAuth v4 with JWT sessions and Upstash Redis for user records. This feature adds email magic link login: a visitor enters an email address, receives a one-time login link by email, and opens the link to sign in. The site is deployed on Vercel (Node.js runtime).

## Glossary

- **System**: The YesTV web application
- **Magic Link**: A one-time URL containing a random token that signs the visitor in when opened
- **Login Token**: A random 32-byte value embedded in the Magic Link, stored only as a SHA-256 hash in Redis
- **Mail Service**: The HTTP email API used to deliver Magic Links (Resend)
- **Email User**: A user whose identity is an email address
- **Rate Limit Window**: A 10-minute period used to count Magic Link requests

## Requirements

### Requirement 1

**User Story:** AS a visitor, I want to request a login link by entering my email, so that I can sign in without a GitHub or QQ account

#### Acceptance Criteria

1. WHEN a visitor submits a syntactically valid email address, the System SHALL send a Magic Link to that address through the Mail Service
2. WHEN a visitor submits an email address, the System SHALL display the same confirmation message regardless of whether the address is registered
3. IF the submitted email address is syntactically invalid, the System SHALL display a validation message and send no email
4. WHILE the Mail Service is not configured, the System SHALL hide the email login option

### Requirement 2

**User Story:** AS a visitor, I want the login link to sign me in once, so that a leaked or reused link cannot give access to others

#### Acceptance Criteria

1. WHEN a visitor opens a valid Magic Link, the System SHALL create a signed-in session for the matching Email User
2. WHEN a Magic Link has been used once, the System SHALL reject any later use of that link
3. IF a Magic Link is older than 10 minutes, the System SHALL reject the link and display an expiry message
4. THE System SHALL store only the SHA-256 hash of each Login Token

### Requirement 3

**User Story:** AS an operator, I want request throttling, so that the email login cannot be used to flood mailboxes

#### Acceptance Criteria

1. IF one email address requests more than 3 Magic Links within one Rate Limit Window, the System SHALL reject further requests for that address until the window ends
2. IF one client IP address requests more than 10 Magic Links within one Rate Limit Window, the System SHALL reject further requests from that address until the window ends
3. WHEN a request is rejected by throttling, the System SHALL return HTTP status 429

### Requirement 4

**User Story:** AS an operator, I want email users to follow the same account rules as OAuth users, so that bans and admin settings work uniformly

#### Acceptance Criteria

1. WHEN an Email User signs in, the System SHALL create or update the managed user record with the lowercase email as the user name fallback
2. IF the managed user record is banned, the System SHALL reject the sign-in
3. WHEN an Email User signs in, the System SHALL assign a stable user id derived from the lowercase email
4. WHERE the user id appears in ADMIN_USER_IDS, the System SHALL grant administrator rights to the Email User

### Requirement 5

**User Story:** AS an operator, I want the login option to appear only when configured, so that deployments without the Mail Service keep working

#### Acceptance Criteria

1. WHILE RESEND_API_KEY and EMAIL_FROM are both set, the System SHALL list the email provider in the available login options
2. WHILE RESEND_API_KEY or EMAIL_FROM is missing, the System SHALL keep GitHub and QQ login unchanged
3. IF the Mail Service returns an error, the System SHALL display a retry message and write the error to the server log
