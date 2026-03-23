# ADR 0001: Category-First Repository Structure

Status: accepted

Decision:

- organize BetterPortal by plugin category first, then language
- keep `framework` separate from `auth`, `themes`, and `services`
- keep `spec` language-agnostic and authoritative

Reason:

- prevents Node.js implementation details from becoming the platform definition
- keeps plugin categories explicit
- scales to additional languages cleanly
