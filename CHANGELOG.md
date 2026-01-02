# CHANGELOG


## v1.8.1 (2026-01-02)

### Bug Fixes

- Exclude allowed users from channel context query
  ([`602bf13`](https://github.com/wayne930242/weihung-pai/commit/602bf139b20619e0aa95eafb9d25d9109b25baf7))


## v1.8.0 (2026-01-02)

### Documentation

- Update site content to reflect current features
  ([`6daae1d`](https://github.com/wayne930242/weihung-pai/commit/6daae1d978545bdb2da74adc31061cf010236b11))

### Features

- Add Discord platform support with channel-based sessions
  ([`f55650e`](https://github.com/wayne930242/weihung-pai/commit/f55650e217a35853a92ab04ade85eaa0d90b3c39))


## v1.7.1 (2026-01-02)

### Bug Fixes

- Capture stderr in parallel to prevent data loss
  ([`08d527e`](https://github.com/wayne930242/weihung-pai/commit/08d527e620bdbeea2eb7383e06377ec4a63f0a0b))


## v1.7.0 (2026-01-02)

### Features

- Add voice transcription using Gemini
  ([`cb8fe11`](https://github.com/wayne930242/weihung-pai/commit/cb8fe113c30a9ccc51eac745073c330dc924ddff))


## v1.6.2 (2026-01-01)

### Bug Fixes

- Correct pai-setup command in README
  ([`2cb54f2`](https://github.com/wayne930242/weihung-pai/commit/2cb54f249d6205dc02b8f4aada1b6cc1bb6c5b2c))


## v1.6.1 (2026-01-01)

### Bug Fixes

- Use plain text for notify API messages
  ([`0fb8e84`](https://github.com/wayne930242/weihung-pai/commit/0fb8e842d17714bfddf3202c974414a05e462612))


## v1.6.0 (2026-01-01)

### Features

- Add task queue system with interrupt/queue options
  ([`e5403dd`](https://github.com/wayne930242/weihung-pai/commit/e5403dd8c047c6ffc200405eefe8cddaa9bbe447))


## v1.5.13 (2026-01-01)

### Bug Fixes

- Use @grammyjs/parse-mode for proper MarkdownV2 escaping
  ([`312f4cf`](https://github.com/wayne930242/weihung-pai/commit/312f4cfc8f5197963f6b7643e4fed25662858963))

### Refactoring

- Remove misclassified agents, merge into coding skill
  ([`55511e2`](https://github.com/wayne930242/weihung-pai/commit/55511e2136d15ea50858dad50177102263b50895))

- Rewrite commands and rules in English
  ([`567e032`](https://github.com/wayne930242/weihung-pai/commit/567e0324943789b5aaba9be68b5eaba63d0e9880))


## v1.5.12 (2026-01-01)

### Bug Fixes

- Read bot logs from file instead of journalctl
  ([`3dd8303`](https://github.com/wayne930242/weihung-pai/commit/3dd8303dbc0813aabe3c1bbff3a7dfbc570ea619))


## v1.5.11 (2026-01-01)

### Bug Fixes

- Show detailed error message in telegram replies
  ([`23a02b0`](https://github.com/wayne930242/weihung-pai/commit/23a02b0dbee4ff1ab986294e1d65b95aaf0f4966))


## v1.5.10 (2026-01-01)

### Bug Fixes

- Change notify success icon to arrow emoji
  ([`071e3b4`](https://github.com/wayne930242/weihung-pai/commit/071e3b4928e027df59150faebd31238f2740d793))

### Refactoring

- Rewrite Merlin CLAUDE.md in English and add notify skill
  ([`2116623`](https://github.com/wayne930242/weihung-pai/commit/21166237389e3e748ffb7fde214697c59a32ec90))

- Rewrite skills in English with improved structure
  ([`4fe718b`](https://github.com/wayne930242/weihung-pai/commit/4fe718bcb5e9b7c3461451ef64a7ada63216bbd3))


## v1.5.9 (2026-01-01)

### Bug Fixes

- Escape markdown in notify api to prevent parse errors
  ([`7423620`](https://github.com/wayne930242/weihung-pai/commit/74236204a4affb64f80d664d94f3c4871e24cbd6))


## v1.5.8 (2026-01-01)

### Bug Fixes

- Use PostToolUse for Task notifications with full details
  ([`8ea0b74`](https://github.com/wayne930242/weihung-pai/commit/8ea0b7435d7e8492ec47f7cbee03e7b617b501b2))


## v1.5.7 (2026-01-01)

### Bug Fixes

- Restore --verbose flag and fix duplicate notification icons
  ([`8d86fb9`](https://github.com/wayne930242/weihung-pai/commit/8d86fb9d3d5dedd5f208a263a94f4db374587ae8))


## v1.5.6 (2026-01-01)

### Bug Fixes

- Correct SSH key extraction in deploy workflow
  ([`3c2ab03`](https://github.com/wayne930242/weihung-pai/commit/3c2ab037a03d6585bdc83f05d51a40728206118f))


## v1.5.5 (2026-01-01)

### Bug Fixes

- Improve hook notifications with more details
  ([`0683ff8`](https://github.com/wayne930242/weihung-pai/commit/0683ff830aaf0fa01b39fbe0dff05c5d3c8370e7))

- Move settings.json to workspace/.claude and remove session notify
  ([`f115978`](https://github.com/wayne930242/weihung-pai/commit/f115978da174f24983aec25653ab33413da86a04))

### Refactoring

- Move CLAUDE.md and scripts to workspace, update projectDir
  ([`90dccc9`](https://github.com/wayne930242/weihung-pai/commit/90dccc99affc2d51945613ba5f404737d9dee180))


## v1.5.4 (2026-01-01)

### Bug Fixes

- Correct hooks config structure and remove verbose flags
  ([`f112b80`](https://github.com/wayne930242/weihung-pai/commit/f112b805583bc642fa5734325dfe3c08e99b7762))


## v1.5.3 (2026-01-01)

### Bug Fixes

- Correct semantic-release changelog config section
  ([`c8fb7ec`](https://github.com/wayne930242/weihung-pai/commit/c8fb7ecc318ebe1bfc67d60dec3c2edf9b58d670))


## v1.5.2 (2026-01-01)

### Bug Fixes

- Enable push in semantic-release to update CHANGELOG.md
  ([`ba6ba27`](https://github.com/wayne930242/weihung-pai/commit/ba6ba279c0080019a02b0ec2a33c2a046f31eaec))


## v1.5.1 (2026-01-01)

### Bug Fixes

- Update semantic-release config for uv.lock and changelog
  ([`2f99856`](https://github.com/wayne930242/weihung-pai/commit/2f99856c4962039060baa2788ebca2bde4133255))


## v1.5.0 (2026-01-01)

### Features

- Add configurable timezone support
  ([`09e15fc`](https://github.com/wayne930242/weihung-pai/commit/09e15fc7ac2ecb20911b432e5fd0e5a6751fd51d))


## v1.4.1 (2026-01-01)

### Bug Fixes

- Correct server IP extraction in deploy workflow
  ([`31ebab1`](https://github.com/wayne930242/weihung-pai/commit/31ebab1c59620d77ad6179bbfa0a5c9eaf612d1f))


## v1.4.0 (2026-01-01)

### Features

- Add Google Tasks API support
  ([`7e98c47`](https://github.com/wayne930242/weihung-pai/commit/7e98c47ebbc41a0df265c97f0e54d6e84e6a035e))


## v1.3.0 (2026-01-01)

### Features

- Add memory soft delete and MCP tools for agent
  ([`7b00e17`](https://github.com/wayne930242/weihung-pai/commit/7b00e1738aad1f103e535721853f7a98f5c7371a))


## v1.2.0 (2026-01-01)

### Bug Fixes

- Add sqlite-vec to dependencies
  ([`d5f09b0`](https://github.com/wayne930242/weihung-pai/commit/d5f09b0e3748cb0bb2171e1b95166aa187fdc95d))

- Correct SQL parameter count in findSimilar
  ([`e5406fe`](https://github.com/wayne930242/weihung-pai/commit/e5406fe6241a9e68f273d643c9a8a751cf74eb7c))

- Use L2 distance threshold for deduplication
  ([`895603b`](https://github.com/wayne930242/weihung-pai/commit/895603b04271fd9859891233e7a6aef5dfe13a06))

### Chores

- Add gemini api key and enable memory/fabric
  ([`892b6be`](https://github.com/wayne930242/weihung-pai/commit/892b6bee27929e7861a015ac2975b3389e25e737))

- Adjust dedup threshold to 8.0
  ([`2b840fb`](https://github.com/wayne930242/weihung-pai/commit/2b840fb58d1aad3dc36b29257de3b7018d18d2a1))

- Ignore session-env directory
  ([`4de4537`](https://github.com/wayne930242/weihung-pai/commit/4de4537bedc367229a3c69df043f571e8d911a43))

- Upgrade vultr plan to 2gb ram
  ([`feb56a2`](https://github.com/wayne930242/weihung-pai/commit/feb56a25e72768708c8335c45585a228df753d35))

- Use latest haiku model alias
  ([`d03d60f`](https://github.com/wayne930242/weihung-pai/commit/d03d60ffb16c4b5b8de6b99204d44a4228a16651))

### Features

- Add Gemini 2.5 Flash support for memory extraction
  ([`5205c49`](https://github.com/wayne930242/weihung-pai/commit/5205c497ad979e53864fbf33094f864545f4cb2f))

- Add long-term memory system with sqlite-vec
  ([`28c7b48`](https://github.com/wayne930242/weihung-pai/commit/28c7b4876c135c65f31f5133de57412caccd0598))

- Add mutagen sync toggle for deploy-claude
  ([`2952e4e`](https://github.com/wayne930242/weihung-pai/commit/2952e4e9c7bbe10828cf9515e846faf2f5221f5f))

- Add Ollama installation for local embedding
  ([`f27428a`](https://github.com/wayne930242/weihung-pai/commit/f27428a4622a1f8e596eb87c9556d692690cb3c4))

- Add vault config for memory and fabric enable/disable
  ([`390aa76`](https://github.com/wayne930242/weihung-pai/commit/390aa767c871357a302f2e6667dceb707d13b489))

### Refactoring

- Use Haiku for memory extraction, disable expiry
  ([`1354e30`](https://github.com/wayne930242/weihung-pai/commit/1354e307bc82bdb7d1e55a97728bc91236ff3730))

### Testing

- Add config module tests
  ([`5990f59`](https://github.com/wayne930242/weihung-pai/commit/5990f596961dcb3fd2daec18ab8d4bcdd37bdda3))

- Add memory system integration test
  ([`f3e2846`](https://github.com/wayne930242/weihung-pai/commit/f3e2846247332a3f73ca9b7735de32fa05918575))

- Add unit tests for setup module
  ([`df5b981`](https://github.com/wayne930242/weihung-pai/commit/df5b981dead007dac2aad63f945650e8422c1152))


## v1.1.2 (2026-01-01)

### Bug Fixes

- Correct semantic-release changelog config section
  ([`d2f9ca8`](https://github.com/wayne930242/weihung-pai/commit/d2f9ca8f47ebb7465e84e3097dccbf91a1498c96))

### Performance Improvements

- Optimize deploy-claude with pipelining and single mkdir
  ([`7d39f78`](https://github.com/wayne930242/weihung-pai/commit/7d39f78e298f5f4552d7645494d9dd2d51fba21a))


## v1.1.1 (2026-01-01)

### Performance Improvements

- Optimize deploy pipeline with uv cache and bun lockfile hash
  ([`93bb23d`](https://github.com/wayne930242/weihung-pai/commit/93bb23d15161c4a04cc941d9454e13c79338ddbe))


## v1.1.0 (2026-01-01)

### Bug Fixes

- Update semantic-release changelog config for v10 compatibility
  ([`76a2cd9`](https://github.com/wayne930242/weihung-pai/commit/76a2cd97fce20edd2c4bbd8ca018f798f93a1b3b))

### Features

- **scheduler**: Add execution logs, update tool, and error notifications
  ([`952776a`](https://github.com/wayne930242/weihung-pai/commit/952776a5e1ee1c60920f035d2d8784257f5bbcd9))

### Refactoring

- Move workspace gitignore rules to local file
  ([`83fd538`](https://github.com/wayne930242/weihung-pai/commit/83fd538702a851fdc35af05d40aea6be3f7a391e))


## v1.0.1 (2026-01-01)

### Bug Fixes

- Correct semantic-release workflow
  ([`c414b9b`](https://github.com/wayne930242/weihung-pai/commit/c414b9bdafb272426bbca3e25a94069a2e3ac2ad))


## v1.0.0 (2026-01-01)

- Initial Release
