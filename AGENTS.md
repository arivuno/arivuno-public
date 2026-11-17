# Repository guidance

- Run dependency-vulnerability audits automatically only as pull-request checks.
- Scheduled or periodic audits, and automatic audits on push or merge, require
  the owner's explicit request.
- Keep manual audits opt-in. Preserve required release audits when the owner
  explicitly starts a release.
- Reduce routine notification noise by limiting audit triggers, not by hiding
  findings, bypassing audit failures, or changing account notification settings.
- Preserve other build and test CI triggers unless the owner requests a change.
