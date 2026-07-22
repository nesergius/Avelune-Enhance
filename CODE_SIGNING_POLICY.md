# Code signing policy

## Code signing service

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

Signed release artifacts for Avelune Enhance are produced from the public
repository:

https://github.com/nesergius/Avelune-Enhance

Signing requests may only be submitted for release artifacts created by the
approved GitHub Actions workflow from a reviewed repository commit.

## Project repository

Repository:

https://github.com/nesergius/Avelune-Enhance

Releases:

https://github.com/nesergius/Avelune-Enhance/releases

Security policy:

https://github.com/nesergius/Avelune-Enhance/blob/main/SECURITY.md

Privacy policy:

https://github.com/nesergius/Avelune-Enhance/blob/main/PRIVACY.md

## Project roles

### Committers and reviewers

- NE Sergius — https://github.com/nesergius

Committers may modify source code, tests, documentation and build
configuration.

External contributions must be reviewed before they are merged into a release
branch or included in a signing request.

### Approvers

- NE Sergius — https://github.com/nesergius

Approvers verify the source commit, release version, automated test results,
artifact hashes, dependency and model provenance, licensing information and
security reports before approving a signing request.

All repository and signing accounts must use multi-factor authentication.

## Build and signing process

Official signed release artifacts are built using GitHub-hosted Windows
runners.

The release workflow:

1. Checks out the exact reviewed release commit.
2. Installs dependencies from `package-lock.json`.
3. Generates the resource manifest.
4. Verifies the resource manifest.
5. Runs the automated test suite.
6. Builds the Windows Setup and Portable artifacts.
7. Uploads the unsigned artifacts as GitHub Actions artifacts.
8. Submits approved artifacts to SignPath.
9. Downloads the signed artifacts returned by SignPath.
10. Verifies the signatures and final hashes.
11. Publishes only reviewed release files.

Locally built binaries are not submitted as official public signing requests.

## Signed artifacts

The project may request signatures for:

- Avelune Enhance Windows installer;
- Avelune Enhance Portable executable;
- Avelune-owned executable components built from source in this repository.

Third-party or upstream-derived executable components are not signed under the
Avelune Enhance project policy unless SignPath Foundation explicitly approves
them.

The native image-processing engine is derived from the open-source
`upscayl-ncnn` project. Its corresponding source, upstream commit, source-level
patch and modification records are published with the project.

See:

- [Native engine source information](NATIVE_ENGINE_SOURCE.md)
- [Native engine source status](NATIVE_ENGINE_SOURCE.json)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Artifact integrity

Before approving a signing request, the approver verifies:

- the exact repository commit;
- the release tag and version;
- successful automated tests;
- generated resource-manifest verification;
- Setup and Portable SHA-256 hashes;
- update metadata consistency;
- application Source Snapshot availability;
- native-engine Corresponding Source availability;
- dependency and model provenance;
- third-party licensing notices;
- security scan results.

Artifacts returned by the signing service must be checked again before
publication.

## Model provenance

Avelune Enhance does not claim ownership of third-party AI models.

Model sources, mappings, licensing notes and provenance information are
documented in:

[MODEL_PROVENANCE.md](MODEL_PROVENANCE.md)

A model must not be represented as an original Avelune development unless the
project owns the relevant source and weights.

## Privacy

Avelune Enhance processes user images locally.

The application does not upload user images to an external processing service.
Network access may be used for user-initiated update checks.

Full policy:

[PRIVACY.md](PRIVACY.md)

## Security

Security issues should be reported according to:

[SECURITY.md](SECURITY.md)

Signing credentials, API tokens, private keys and certificate material must
never be committed to the repository.

Secrets used by GitHub Actions must be stored using GitHub encrypted secrets
or another approved secret-management mechanism.

## Release approval

Every public release-signing request requires manual approval.

The approver confirms that:

- the source commit is reviewed;
- the build workflow completed successfully;
- all automated tests passed;
- the expected release version is present;
- artifact hashes were recorded;
- source archives are available;
- model and dependency provenance is documented;
- licensing requirements are satisfied;
- security scan results were reviewed;
- the files submitted to SignPath are the intended release artifacts.

Unsigned release candidates may be published only when they are clearly marked
as unsigned previews intended for evaluation or internal testing.
