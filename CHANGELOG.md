# CHANGELOG


## v1.57.0 (2026-01-11)

### Bug Fixes

- Add obfuscatePassphrase to livesync-bridge config
  ([`a095565`](https://github.com/wayne930242/Merlin-My-Pai/commit/a095565a213adaedbb6269de5db0c47b2f00ddad))

### Documentation

- Add Obsidian LiveSync setup guide
  ([`3f6f6db`](https://github.com/wayne930242/Merlin-My-Pai/commit/3f6f6dbcc4ec948503b240668ca887bee2f980c9))

### Features

- **intel-feed**: Use flash model for outline generation
  ([`ce2088b`](https://github.com/wayne930242/Merlin-My-Pai/commit/ce2088b7f78949a4eab6f8ecfcb33e5b00c9b759))


## v1.56.3 (2026-01-11)

### Bug Fixes

- Add conf.d import to Caddyfile setup
  ([`dbad153`](https://github.com/wayne930242/Merlin-My-Pai/commit/dbad153c2b34c544446df20d616aca098daa7671))


## v1.56.2 (2026-01-11)

### Bug Fixes

- Remove CORS from Caddy, let CouchDB handle it; fix vault path
  ([`5de8f33`](https://github.com/wayne930242/Merlin-My-Pai/commit/5de8f335eb351f2137c692477b16eb7df6bb22bc))


## v1.56.1 (2026-01-11)

### Bug Fixes

- Add CORS headers for Obsidian LiveSync
  ([`5e81fb4`](https://github.com/wayne930242/Merlin-My-Pai/commit/5e81fb4bc336e5cc71c7345827891496d61a28da))


## v1.56.0 (2026-01-10)

### Bug Fixes

- Threshold back to 6, add interesting/original criteria
  ([`925d34b`](https://github.com/wayne930242/Merlin-My-Pai/commit/925d34be8644996f64cb91ddfb46d521043b018f))

### Features

- Add /mode command to toggle queue/interrupt mode
  ([`ea79ff5`](https://github.com/wayne930242/Merlin-My-Pai/commit/ea79ff5529e233e909930d20875291118c9dc991))


## v1.55.1 (2026-01-10)

### Bug Fixes

- Lite prompts in English, lower threshold to 5, enforce Traditional Chinese in flash
  ([`4c9abbe`](https://github.com/wayne930242/Merlin-My-Pai/commit/4c9abbe8e1a6a2dbde15097997c8ce769a70910f))


## v1.55.0 (2026-01-10)

### Bug Fixes

- Increase summary length to 150-250 chars
  ([`a69f125`](https://github.com/wayne930242/Merlin-My-Pai/commit/a69f1255dd45ed9a567de51b1ae44831b4f56f46))

### Features

- Intel-feed overview with links + save to memory
  ([`3b8716b`](https://github.com/wayne930242/Merlin-My-Pai/commit/3b8716b8ee24134f124d5dd0acbc94f7e2298c10))


## v1.54.0 (2026-01-10)

### Features

- Intel-feed two-stage AI (lite→flash) + individual notifications
  ([`bc04cd2`](https://github.com/wayne930242/Merlin-My-Pai/commit/bc04cd29a64d02e25121989c1efcc098c65625da))


## v1.53.0 (2026-01-10)

### Bug Fixes

- Remove unused ActivityType import
  ([`2eb3162`](https://github.com/wayne930242/Merlin-My-Pai/commit/2eb3162111cea9685a2ae3d4d7c7757610c34842))

### Features

- Add /api/intel/trigger endpoint for manual digest
  ([`f16f2ac`](https://github.com/wayne930242/Merlin-My-Pai/commit/f16f2acdb8634db6ccff0bbc29a3720f3b8de79e))


## v1.52.0 (2026-01-10)

### Bug Fixes

- Bun types
  ([`a21f071`](https://github.com/wayne930242/Merlin-My-Pai/commit/a21f0719e476483c1791667c1c402c795f92e3fb))

### Features

- Add intel-feed service for daily news digest
  ([`7978e64`](https://github.com/wayne930242/Merlin-My-Pai/commit/7978e641e6d043877d183232af14c07a707bad56))

### Refactoring

- Reorganize obsidian playbooks into subfolder
  ([`04a4243`](https://github.com/wayne930242/Merlin-My-Pai/commit/04a42436dd7e10b9e0d654ca18e6c32142c0b38a))


## v1.51.0 (2026-01-10)

### Chores

- Remove workspace symlink
  ([`ee8788b`](https://github.com/wayne930242/Merlin-My-Pai/commit/ee8788ba9b51f89d1c5e4435b8ab4c7d1978adb3))

### Features

- Add Obsidian LiveSync with CouchDB for bidirectional sync
  ([`ba590da`](https://github.com/wayne930242/Merlin-My-Pai/commit/ba590dac393d6142617af4cf40409658593b3b26))


## v1.50.0 (2026-01-09)

### Features

- **knowledge-base**: Add skill for obsidian vault management
  ([`1304eb4`](https://github.com/wayne930242/Merlin-My-Pai/commit/1304eb4e56082b592b25595f984eb11fe2423c53))


## v1.49.8 (2026-01-09)

### Bug Fixes

- **api**: Broadcast notify events to websocket for webui
  ([`189e5d7`](https://github.com/wayne930242/Merlin-My-Pai/commit/189e5d7229a508d950d9bb3c2952b7e2b45545a5))

- **rag**: Redirect debug prints to stderr for clean JSON output
  ([`6ea182c`](https://github.com/wayne930242/Merlin-My-Pai/commit/6ea182c19034414b47bdb503f59f8391d2e2c07d))


## v1.49.7 (2026-01-09)

### Bug Fixes

- **rag**: Fix LangGraph grade node to return dict
  ([`034b3dc`](https://github.com/wayne930242/Merlin-My-Pai/commit/034b3dc553d32b1277e85eb884f213da24492e86))


## v1.49.6 (2026-01-09)

### Bug Fixes

- **rag**: Use Bun.spawn instead of shell template for Python calls
  ([`618a4db`](https://github.com/wayne930242/Merlin-My-Pai/commit/618a4dbb098870e2ffd4e3f844c3a811692bdb7f))

### Refactoring

- Unify GEMINI_API_KEY to GOOGLE_API_KEY
  ([`3a3f430`](https://github.com/wayne930242/Merlin-My-Pai/commit/3a3f43080a9525c881faf7dd53af4233a2cdeae0))


## v1.49.5 (2026-01-09)

### Bug Fixes

- **db**: Sync memories schema with manager.ts
  ([`d766039`](https://github.com/wayne930242/Merlin-My-Pai/commit/d7660396e1ebb35f99105e6ec146c74855332193))


## v1.49.4 (2026-01-09)

### Bug Fixes

- Add EnvironmentFile to pai-bot service for API keys
  ([`064beab`](https://github.com/wayne930242/Merlin-My-Pai/commit/064beab03da5fbddb99e3ca18cdbfbb457106d87))


## v1.49.3 (2026-01-09)

### Bug Fixes

- **rag**: Allow stats without API key (readonly mode)
  ([`a68d1b5`](https://github.com/wayne930242/Merlin-My-Pai/commit/a68d1b5b296831595981901e6ab2d35cac7d31c2))


## v1.49.2 (2026-01-09)

### Bug Fixes

- **rag**: Use timezone.utc for Python 3.10 compatibility
  ([`67f27a0`](https://github.com/wayne930242/Merlin-My-Pai/commit/67f27a0c1a647bb72c30b2d64caa801ee041b054))

### Refactoring

- **rag**: Switch to hybrid Gemini model routing
  ([`c3d6fdb`](https://github.com/wayne930242/Merlin-My-Pai/commit/c3d6fdbbfb21b803e90ef9fc433fd57a370044b7))


## v1.49.1 (2026-01-09)

### Bug Fixes

- **web**: Add missing tabs component
  ([`9a66d9f`](https://github.com/wayne930242/Merlin-My-Pai/commit/9a66d9fbe5ac7b5c74f77fab51a923849de1ae47))


## v1.49.0 (2026-01-09)

### Features

- **web**: Add RAG panel for vector DB status and testing
  ([`7b23c49`](https://github.com/wayne930242/Merlin-My-Pai/commit/7b23c49c862dd7f797139a535b6967fd5fbe7cc4))


## v1.48.0 (2026-01-09)

### Chores

- Disable spotify connect functionality
  ([`f27c03a`](https://github.com/wayne930242/Merlin-My-Pai/commit/f27c03ae4cd0964f3321453a1c52856ca72be0b5))

### Features

- **rag**: Implement agentic RAG with LangGraph
  ([`0075c47`](https://github.com/wayne930242/Merlin-My-Pai/commit/0075c476eaca1072456675c81812f56f0ede528f))


## v1.47.0 (2026-01-06)

### Chores

- Extract web/api endpoints to vault config
  ([`ade8f8e`](https://github.com/wayne930242/Merlin-My-Pai/commit/ade8f8eff40a0d77a027f7e92be94c91bafd0aff))

### Features

- **web**: Display tool calls in logs view
  ([`56eb38c`](https://github.com/wayne930242/Merlin-My-Pai/commit/56eb38cadd8f9fdd3f604b1397b50c0a13338a1d))


## v1.46.0 (2026-01-05)

### Features

- **api**: Add chat history endpoint
  ([`d6e885d`](https://github.com/wayne930242/Merlin-My-Pai/commit/d6e885d636ddfa8daf882bef21cb7ec077038f9e))

- **pai-web**: Load chat history on mount
  ([`adf2fb5`](https://github.com/wayne930242/Merlin-My-Pai/commit/adf2fb5b7cfe9da22a9a1b55310e6ac1d27593d8))


## v1.45.0 (2026-01-05)

### Bug Fixes

- Internal broadcast add to notification buffer
  ([`bda121c`](https://github.com/wayne930242/Merlin-My-Pai/commit/bda121c9a48c3a70cecb2e4a5037c2a8ed836788))

### Continuous Integration

- Add Bun dependency cache for faster deploys
  ([`fa376e3`](https://github.com/wayne930242/Merlin-My-Pai/commit/fa376e3512f82a6e0fb63301695eed4fcbe1b0ea))

### Features

- **pai-web**: Add browser notification support
  ([`1ac108c`](https://github.com/wayne930242/Merlin-My-Pai/commit/1ac108c3919390edc0ec9f2a10c4564407678f68))


## v1.44.0 (2026-01-05)

### Bug Fixes

- MCP notify broadcast to web via internal API
  ([`884027a`](https://github.com/wayne930242/Merlin-My-Pai/commit/884027a8589b7cdb0bcfe3f29d255b001ed7c370))

### Features

- **pai-web**: Add TOON format support for chat export
  ([`db1a4f3`](https://github.com/wayne930242/Merlin-My-Pai/commit/db1a4f3395fd5be9c2bc6c131a3b5ebbac9f93ed))


## v1.43.4 (2026-01-05)

### Bug Fixes

- **chat**: Properly handle local commands with response messages
  ([`8264ebe`](https://github.com/wayne930242/Merlin-My-Pai/commit/8264ebe9b1fe1b6a99fadbde0e1f330b44db70f3))


## v1.43.3 (2026-01-05)

### Bug Fixes

- **ws**: Improve reconnection with visibility change and exponential backoff
  ([`af9aeff`](https://github.com/wayne930242/Merlin-My-Pai/commit/af9aeff5704870dd18aabb3c9a7e9c2bf02fec2e))


## v1.43.2 (2026-01-05)

### Bug Fixes

- Add missing logs and settings components
  ([`fe333a7`](https://github.com/wayne930242/Merlin-My-Pai/commit/fe333a7681a20f371d4e36079d40239c4e823630))

- **gitignore**: Allow src/components/logs directory
  ([`97e1079`](https://github.com/wayne930242/Merlin-My-Pai/commit/97e107916d47fb2920ddbfc1eb7f893fbb85dd4e))


## v1.43.1 (2026-01-05)

### Bug Fixes

- **ansible**: Update web deploy config with vault variables
  ([`19c57f6`](https://github.com/wayne930242/Merlin-My-Pai/commit/19c57f69ede73e3d7bd1de963c356f1fb1560526))


## v1.43.0 (2026-01-05)

### Features

- **web**: Add markdown, commands, and file upload
  ([`8d2815c`](https://github.com/wayne930242/Merlin-My-Pai/commit/8d2815c214738fe666b3b31b1cb74b011d71a434))


## v1.42.0 (2026-01-05)

### Features

- **web**: Add router, logs streaming, and fix resizable panels
  ([`3a9af21`](https://github.com/wayne930242/Merlin-My-Pai/commit/3a9af217508b925f7c8a0ddd9a9f14f5e548bbae))


## v1.41.0 (2026-01-05)

### Features

- Add pai-web to CI/CD pipeline
  ([`e9af7ff`](https://github.com/wayne930242/Merlin-My-Pai/commit/e9af7ff71df463573bbcad2eacc315d4a6c16666))


## v1.40.0 (2026-01-05)

### Features

- VS Code-style file browser, Caddy deploy, CodeMirror viewer
  ([`f5f057d`](https://github.com/wayne930242/Merlin-My-Pai/commit/f5f057dd64fd4d3f1b53abe86638ba50533a42c6))


## v1.39.0 (2026-01-05)

### Features

- Add workspace file browser
  ([`47a27f8`](https://github.com/wayne930242/Merlin-My-Pai/commit/47a27f8fee93a27f6d639656260d8f144e908883))


## v1.38.1 (2026-01-05)

### Bug Fixes

- Add CORS headers to Memory API endpoints
  ([`7bbed90`](https://github.com/wayne930242/Merlin-My-Pai/commit/7bbed901f6a2c55816aa49053fe31ec229b70ccd))


## v1.38.0 (2026-01-05)

### Features

- **pai-web**: Add Memory and History views with React Query
  ([`66ccd30`](https://github.com/wayne930242/Merlin-My-Pai/commit/66ccd30e874700d588a6897cc6533503fc8b5085))


## v1.37.0 (2026-01-05)

### Features

- Add API auth, mobile-first UI, and stable WebSocket
  ([`258547f`](https://github.com/wayne930242/Merlin-My-Pai/commit/258547f5f84a0ddcd50f391e0f084351b131244d))


## v1.36.0 (2026-01-05)

### Features

- Add WebSocket + pai-web frontend for AI Agent UI
  ([`94e5fe8`](https://github.com/wayne930242/Merlin-My-Pai/commit/94e5fe89065e1ec4074cf45b66f5d3b21d070c85))


## v1.35.0 (2026-01-05)

### Features

- **mcp**: Add history tools for listing, searching, reading history
  ([`fa25bec`](https://github.com/wayne930242/Merlin-My-Pai/commit/fa25becdaa20940df41d34744df7e1a6ea554063))


## v1.34.0 (2026-01-05)

### Features

- **hooks**: Check memory config in session start hook
  ([`8e54a89`](https://github.com/wayne930242/Merlin-My-Pai/commit/8e54a8974f3561c1f99bc84de32b250ae250147a))


## v1.33.0 (2026-01-05)

### Features

- **hooks**: Check memory config before LLM classification
  ([`2e0b88d`](https://github.com/wayne930242/Merlin-My-Pai/commit/2e0b88decb65bc67531f2fa38ff7e0808c09b7c0))


## v1.32.0 (2026-01-05)

### Features

- **hooks**: Add Gemini Flash 2.5 classification for Stop hook
  ([`3292df4`](https://github.com/wayne930242/Merlin-My-Pai/commit/3292df4b962783ca3dbb67d5d427d71f935d2c3e))


## v1.31.0 (2026-01-05)

### Features

- **deploy**: Add history directories for Stop hook
  ([`d5319ea`](https://github.com/wayne930242/Merlin-My-Pai/commit/d5319ea83bd26fcee076cd501f3c203384f31c1f))


## v1.30.0 (2026-01-05)

### Features

- Add 1GB swap configuration to VPS setup
  ([`38b53f7`](https://github.com/wayne930242/Merlin-My-Pai/commit/38b53f7a8634db1294f1b0da6dcc7819600975b5))

- **hooks**: Enhance SessionStart and Stop hooks with PAI-style context
  ([`38ac6e8`](https://github.com/wayne930242/Merlin-My-Pai/commit/38ac6e8aa27df1ccb23d5b2d321947352c827c70))


## v1.29.0 (2026-01-04)

### Features

- Migrate to Hostinger VPS and improve Spotify auth
  ([`81f21bd`](https://github.com/wayne930242/Merlin-My-Pai/commit/81f21bd849446dc422c1d6c460101cccd604c70c))


## v1.28.6 (2026-01-04)

### Performance Improvements

- **spotify**: Reduce bitrate to 160 for lower resource usage
  ([`0aa207d`](https://github.com/wayne930242/Merlin-My-Pai/commit/0aa207d4f286b58afb612b5285d9bc11cf74cd57))


## v1.28.5 (2026-01-04)

### Bug Fixes

- **spotify**: Only clear audio cache, preserve credentials
  ([`1c4200e`](https://github.com/wayne930242/Merlin-My-Pai/commit/1c4200ec674a18a9016c731e4c311e0da0920b36))


## v1.28.4 (2026-01-04)

### Bug Fixes

- **spotify**: Kill stale librespot before starting new one
  ([`e71283f`](https://github.com/wayne930242/Merlin-My-Pai/commit/e71283f707105e07eb8e4530e6d0491a7fd732d2))


## v1.28.3 (2026-01-04)

### Bug Fixes

- **spotify**: Auto-clear cache on auth errors
  ([`f3dc982`](https://github.com/wayne930242/Merlin-My-Pai/commit/f3dc9823d29360129505a0e53ec9d719e8216f5c))


## v1.28.2 (2026-01-04)

### Bug Fixes

- **voice**: Cancel stale reconnect when new join happens
  ([`255927b`](https://github.com/wayne930242/Merlin-My-Pai/commit/255927b2af9662a2487d9b4c8f1d7c949b7de036))


## v1.28.1 (2026-01-04)

### Bug Fixes

- **spotify**: Add auto-reconnect and reduce pregain to +1dB
  ([`08bb68b`](https://github.com/wayne930242/Merlin-My-Pai/commit/08bb68bf2153e60d3f866f044984c55d6ec22788))


## v1.28.0 (2026-01-04)

### Bug Fixes

- **spotify**: Increase default volume to 100%
  ([`2a51bcf`](https://github.com/wayne930242/Merlin-My-Pai/commit/2a51bcf2def7e7578be609771fa978048ce2b2d6))

### Features

- **discord**: Add volume control panel for Spotify
  ([`fa7978f`](https://github.com/wayne930242/Merlin-My-Pai/commit/fa7978f3103972793c789dcfa7feb8aaa7e0daa6))


## v1.27.1 (2026-01-04)

### Bug Fixes

- **spotify**: Add pipe backend to auth, increase default volume to 75%
  ([`b6c9577`](https://github.com/wayne930242/Merlin-My-Pai/commit/b6c9577ae3459dd836ab707edd668f0d4b891d8f))


## v1.27.0 (2026-01-04)

### Features

- Remove Ollama, simplify memory to SQLite, add Obsidian RAG
  ([`fbdba3a`](https://github.com/wayne930242/Merlin-My-Pai/commit/fbdba3a4fedbc9cb98d46fffa93148edd731be43))

- **obsidian**: Add vault sync and TOON index generation
  ([`41ad6f2`](https://github.com/wayne930242/Merlin-My-Pai/commit/41ad6f2275b2b572f781f8e77057780f0e32733a))

- **scripts**: Add git skip-worktree management tool
  ([`552daaf`](https://github.com/wayne930242/Merlin-My-Pai/commit/552daafe0ccdc27b76eb33b7f15d3d44db8cdb17))


## v1.26.0 (2026-01-04)

### Bug Fixes

- **discord**: Use MessageFlags.Ephemeral instead of deprecated ephemeral option
  ([`6c8aa5a`](https://github.com/wayne930242/Merlin-My-Pai/commit/6c8aa5a7613facfc33c8b89e2b4623c2f2fdafd3))

### Features

- **garmin**: Add date range query support for all MCP tools
  ([`0ee714d`](https://github.com/wayne930242/Merlin-My-Pai/commit/0ee714d5278e2d1bff693f5d15cfb7f9bded0fe2))

- **logging**: Split stdout/stderr streams and add global error handlers
  ([`cb75dfa`](https://github.com/wayne930242/Merlin-My-Pai/commit/cb75dfa0e7fb97f32956397fa1374b3a2f181195))

- **mcp**: Add memory_delete and memory_update tools
  ([`9f8aff2`](https://github.com/wayne930242/Merlin-My-Pai/commit/9f8aff2a6da17d321d5b28036671c305c9629033))

- **telegram**: Add message splitting for long responses
  ([`ac0cb4a`](https://github.com/wayne930242/Merlin-My-Pai/commit/ac0cb4a32e71d5357e795c19053579699f379135))

### Refactoring

- **discord**: Remove YouTube playback remnants from voice module
  ([`b82224a`](https://github.com/wayne930242/Merlin-My-Pai/commit/b82224adb1260cca8e99ade46e511f050ce3fc95))


## v1.25.0 (2026-01-03)

### Bug Fixes

- **discord**: Add handleDiceSelectMenu for game system selection
  ([`54cb5d3`](https://github.com/wayne930242/Merlin-My-Pai/commit/54cb5d3030daa04a91ae001d70ad091467e5afc0))

### Features

- **discord**: Replace YouTube with Spotify Connect
  ([`a55a601`](https://github.com/wayne930242/Merlin-My-Pai/commit/a55a601e2d9f92153b6d25e96dc9c81b5ecfebb2))


## v1.24.1 (2026-01-03)

### Bug Fixes

- Remove player panel and queue references
  ([`a810583`](https://github.com/wayne930242/Merlin-My-Pai/commit/a810583cbd1c5e145957e1a63ef605b443dd201d))

### Chores

- Remove YouTube config from setup wizard
  ([`a9ad065`](https://github.com/wayne930242/Merlin-My-Pai/commit/a9ad065e832244ba5dbaefe9cb75b4c792992c4b))

- Remove YouTube/VNC dependencies from setup
  ([`9c6b241`](https://github.com/wayne930242/Merlin-My-Pai/commit/9c6b241a9f35451b6be0a3321c3eda2e60910815))

### Documentation

- Update music feature to Spotify Connect
  ([`1dabd6f`](https://github.com/wayne930242/Merlin-My-Pai/commit/1dabd6f7d0e6e428404002358cba9e1fc1d45b66))

### Refactoring

- Replace YouTube with Spotify Connect
  ([`0aba644`](https://github.com/wayne930242/Merlin-My-Pai/commit/0aba6448bef28a3649e21ab16da50ddc51b5d345))


## v1.24.0 (2026-01-03)

### Chores

- **discord**: Simplify bot permissions
  ([`46f8fdf`](https://github.com/wayne930242/Merlin-My-Pai/commit/46f8fdf18954b9d3f20685ce0ab4177c3706d1ea))

### Documentation

- Add README for subprojects and simplify root README
  ([`e174a05`](https://github.com/wayne930242/Merlin-My-Pai/commit/e174a05c776b1eab529fc235de1d7a0e407d2452))

### Features

- **youtube**: Add vnc commands for cookie refresh
  ([`a7d8287`](https://github.com/wayne930242/Merlin-My-Pai/commit/a7d82872db3c36d50a0b474b25e4fecddcb4573c))


## v1.23.0 (2026-01-03)

### Features

- **discord**: Enhance dice panel with game systems and compound expressions
  ([`ffb972d`](https://github.com/wayne930242/Merlin-My-Pai/commit/ffb972de362dd283618c74ad40db01d331722739))


## v1.22.0 (2026-01-03)

### Features

- **discord**: Add quick roll and custom dice modal
  ([`f2bc28a`](https://github.com/wayne930242/Merlin-My-Pai/commit/f2bc28aff59de5fa7493fbb101aa5cf5827b63e0))


## v1.21.1 (2026-01-03)

### Bug Fixes

- **discord**: Show roll result in ephemeral message
  ([`2f746fd`](https://github.com/wayne930242/Merlin-My-Pai/commit/2f746fd10316ccc99de5aaa97f8f7031ac409085))


## v1.21.0 (2026-01-03)

### Features

- **discord**: Dice panel with history message
  ([`f53151f`](https://github.com/wayne930242/Merlin-My-Pai/commit/f53151f321757870cce9ba94c992adb84e1c944a))


## v1.20.0 (2026-01-03)

### Features

- **discord**: Add dice accumulation with per-user panels
  ([`9b000ed`](https://github.com/wayne930242/Merlin-My-Pai/commit/9b000edfc5748f0dcad666cd7036b123e840f1ae))

### Refactoring

- **discord**: Simplify /panel command syntax
  ([`20e510a`](https://github.com/wayne930242/Merlin-My-Pai/commit/20e510a74002e549d1ee9e5f5c5299ffb1cadd36))


## v1.19.0 (2026-01-03)

### Features

- **discord**: Add /panel slash command for control panel
  ([`21f2fb6`](https://github.com/wayne930242/Merlin-My-Pai/commit/21f2fb6bf0060bf24ad09df39f3b554dd867b690))


## v1.18.0 (2026-01-03)

### Features

- **discord**: Add sound effects for soundboard panel
  ([`af4d7d5`](https://github.com/wayne930242/Merlin-My-Pai/commit/af4d7d5e5d73cbced455b0003a3d1c606b4e99c9))


## v1.17.1 (2026-01-03)

### Bug Fixes

- **discord**: Improve voice connection state tracking
  ([`fdae86d`](https://github.com/wayne930242/Merlin-My-Pai/commit/fdae86d1e3eeeb1ac6305601163358b199bdaf9d))

### Refactoring

- **discord**: Remove emojis from music panel UI
  ([`607ee09`](https://github.com/wayne930242/Merlin-My-Pai/commit/607ee094631ec1bf9dd5964832dca2b769f3d09b))


## v1.17.0 (2026-01-03)

### Features

- **discord**: Improve music panel with queue display and track selection
  ([`16268f5`](https://github.com/wayne930242/Merlin-My-Pai/commit/16268f56c4f5bf241ab0c337027b4422602d0694))

### Refactoring

- **discord**: Split handlers.ts into modular structure
  ([`ed3643f`](https://github.com/wayne930242/Merlin-My-Pai/commit/ed3643ffe549c8c6f03f3e9d04d8a0830eb5df5b))


## v1.16.0 (2026-01-03)

### Chores

- Add YouTube API key to vault
  ([`e75841b`](https://github.com/wayne930242/Merlin-My-Pai/commit/e75841bb2be747ed1d088a78d04b52909918b9f8))

### Features

- **discord**: Add music control panel and MCP tools
  ([`bd032f1`](https://github.com/wayne930242/Merlin-My-Pai/commit/bd032f1a484cf65758af477aa338183a9fe7b6b9))


## v1.15.0 (2026-01-03)

### Features

- **bot**: Add voice channel context to session
  ([`903d47e`](https://github.com/wayne930242/Merlin-My-Pai/commit/903d47e66d4f3f5bec49e1507c38bce863cd92b2))

- **discord**: Add YouTube music playback
  ([`3f1589a`](https://github.com/wayne930242/Merlin-My-Pai/commit/3f1589a6c625ea4059ad4e783f7f7b3e008f3e5e))

- **scripts**: Add discord invite command
  ([`727b439`](https://github.com/wayne930242/Merlin-My-Pai/commit/727b4397334bf692c2c8ab2feaef62fd89e6ec4b))


## v1.14.0 (2026-01-03)

### Features

- **bot**: Add time context to session prompt
  ([`f2db31f`](https://github.com/wayne930242/Merlin-My-Pai/commit/f2db31ffdf60b716524fa176a43d8f82ee663c2d))


## v1.13.0 (2026-01-03)

### Features

- **ansible**: Add Python and uv to VPS setup
  ([`84d6831`](https://github.com/wayne930242/Merlin-My-Pai/commit/84d683151dc288a01f25a66c9a00d91394b8fee5))

- **bot**: Add Garmin Connect integration
  ([`25bf8b4`](https://github.com/wayne930242/Merlin-My-Pai/commit/25bf8b48ed88400d72addc52e278fda78d4e1172))

- **skills**: Refactor daily skill to life management system
  ([`3963664`](https://github.com/wayne930242/Merlin-My-Pai/commit/39636647a95651a5a5a2bf846842d6d999d743f7))


## v1.12.0 (2026-01-03)

### Features

- **bot**: Inject session context into Claude prompts
  ([`8698f9b`](https://github.com/wayne930242/Merlin-My-Pai/commit/8698f9b8d5a4219c6c014abc374e4b5f20cb2530))


## v1.11.0 (2026-01-03)

### Features

- **bot**: Add session tracking and HQ notification system
  ([`60470a7`](https://github.com/wayne930242/Merlin-My-Pai/commit/60470a7232a87ec84c988544927ffea5ab4e3b63))


## v1.10.0 (2026-01-02)

### Features

- **merlin**: Add proactive agent capabilities
  ([`2e3c7e6`](https://github.com/wayne930242/Merlin-My-Pai/commit/2e3c7e64e431faea060f7abc1092521b330f5e72))

### Refactoring

- **pai-claude**: Simplify config structure
  ([`7125daf`](https://github.com/wayne930242/Merlin-My-Pai/commit/7125dafecdb039f7fe81faa26e1315ea219913b0))

- **workspace**: Use whitelist pattern for gitignore
  ([`f3222ac`](https://github.com/wayne930242/Merlin-My-Pai/commit/f3222ac93b34ae9a190f9c6f922017d3f0d725fa))


## v1.9.4 (2026-01-02)

### Bug Fixes

- **db**: Add migration support for schema changes
  ([`0ba1cc0`](https://github.com/wayne930242/Merlin-My-Pai/commit/0ba1cc0391f5a6494462ef325678b96d400bb0e0))

- **discord**: Use displayName for channel context author
  ([`3a57fc0`](https://github.com/wayne930242/Merlin-My-Pai/commit/3a57fc0fce93a28a506bd1eca4cdbc4995d6e832))


## v1.9.3 (2026-01-02)

### Bug Fixes

- **discord**: Improve channel context handling and prevent duplicate messages
  ([`c7e5217`](https://github.com/wayne930242/Merlin-My-Pai/commit/c7e5217c6e3ad71c25b18a4dff5c27a37ae8eed6))


## v1.9.2 (2026-01-02)

### Bug Fixes

- Trigger release workflow for v1.9.1
  ([`0f247a6`](https://github.com/wayne930242/Merlin-My-Pai/commit/0f247a64fa6edc0d9666132e1ee023062d48cfd3))


## v1.9.1 (2026-01-02)

### Refactoring

- Fetch channel context from Discord API directly
  ([`71a6f42`](https://github.com/wayne930242/Merlin-My-Pai/commit/71a6f420339ee0e51ab085ade5a37170845ee80c))


## v1.9.0 (2026-01-02)

### Features

- Add calendar event update support to Google MCP tools
  ([`5cc5392`](https://github.com/wayne930242/Merlin-My-Pai/commit/5cc539233f5c7f9910dabf285eb4b215e0391e52))


## v1.8.3 (2026-01-02)

### Bug Fixes

- Include all users in Discord channel context
  ([`0f58a6e`](https://github.com/wayne930242/Merlin-My-Pai/commit/0f58a6e6664fc0aa88e944f3c7b5e9c984164ad1))


## v1.8.2 (2026-01-02)

### Bug Fixes

- Improve error logging and handling
  ([`db72ce6`](https://github.com/wayne930242/Merlin-My-Pai/commit/db72ce6d39c5b6d617853df82620c819473ac4b0))


## v1.8.1 (2026-01-02)

### Bug Fixes

- Exclude allowed users from channel context query
  ([`602bf13`](https://github.com/wayne930242/Merlin-My-Pai/commit/602bf139b20619e0aa95eafb9d25d9109b25baf7))


## v1.8.0 (2026-01-02)

### Documentation

- Update site content to reflect current features
  ([`6daae1d`](https://github.com/wayne930242/Merlin-My-Pai/commit/6daae1d978545bdb2da74adc31061cf010236b11))

### Features

- Add Discord platform support with channel-based sessions
  ([`f55650e`](https://github.com/wayne930242/Merlin-My-Pai/commit/f55650e217a35853a92ab04ade85eaa0d90b3c39))


## v1.7.1 (2026-01-02)

### Bug Fixes

- Capture stderr in parallel to prevent data loss
  ([`08d527e`](https://github.com/wayne930242/Merlin-My-Pai/commit/08d527e620bdbeea2eb7383e06377ec4a63f0a0b))


## v1.7.0 (2026-01-02)

### Features

- Add voice transcription using Gemini
  ([`cb8fe11`](https://github.com/wayne930242/Merlin-My-Pai/commit/cb8fe113c30a9ccc51eac745073c330dc924ddff))


## v1.6.2 (2026-01-01)

### Bug Fixes

- Correct pai-setup command in README
  ([`2cb54f2`](https://github.com/wayne930242/Merlin-My-Pai/commit/2cb54f249d6205dc02b8f4aada1b6cc1bb6c5b2c))


## v1.6.1 (2026-01-01)

### Bug Fixes

- Use plain text for notify API messages
  ([`0fb8e84`](https://github.com/wayne930242/Merlin-My-Pai/commit/0fb8e842d17714bfddf3202c974414a05e462612))


## v1.6.0 (2026-01-01)

### Features

- Add task queue system with interrupt/queue options
  ([`e5403dd`](https://github.com/wayne930242/Merlin-My-Pai/commit/e5403dd8c047c6ffc200405eefe8cddaa9bbe447))


## v1.5.13 (2026-01-01)

### Bug Fixes

- Use @grammyjs/parse-mode for proper MarkdownV2 escaping
  ([`312f4cf`](https://github.com/wayne930242/Merlin-My-Pai/commit/312f4cfc8f5197963f6b7643e4fed25662858963))

### Refactoring

- Remove misclassified agents, merge into coding skill
  ([`55511e2`](https://github.com/wayne930242/Merlin-My-Pai/commit/55511e2136d15ea50858dad50177102263b50895))

- Rewrite commands and rules in English
  ([`567e032`](https://github.com/wayne930242/Merlin-My-Pai/commit/567e0324943789b5aaba9be68b5eaba63d0e9880))


## v1.5.12 (2026-01-01)

### Bug Fixes

- Read bot logs from file instead of journalctl
  ([`3dd8303`](https://github.com/wayne930242/Merlin-My-Pai/commit/3dd8303dbc0813aabe3c1bbff3a7dfbc570ea619))


## v1.5.11 (2026-01-01)

### Bug Fixes

- Show detailed error message in telegram replies
  ([`23a02b0`](https://github.com/wayne930242/Merlin-My-Pai/commit/23a02b0dbee4ff1ab986294e1d65b95aaf0f4966))


## v1.5.10 (2026-01-01)

### Bug Fixes

- Change notify success icon to arrow emoji
  ([`071e3b4`](https://github.com/wayne930242/Merlin-My-Pai/commit/071e3b4928e027df59150faebd31238f2740d793))

### Refactoring

- Rewrite Merlin CLAUDE.md in English and add notify skill
  ([`2116623`](https://github.com/wayne930242/Merlin-My-Pai/commit/21166237389e3e748ffb7fde214697c59a32ec90))

- Rewrite skills in English with improved structure
  ([`4fe718b`](https://github.com/wayne930242/Merlin-My-Pai/commit/4fe718bcb5e9b7c3461451ef64a7ada63216bbd3))


## v1.5.9 (2026-01-01)

### Bug Fixes

- Escape markdown in notify api to prevent parse errors
  ([`7423620`](https://github.com/wayne930242/Merlin-My-Pai/commit/74236204a4affb64f80d664d94f3c4871e24cbd6))


## v1.5.8 (2026-01-01)

### Bug Fixes

- Use PostToolUse for Task notifications with full details
  ([`8ea0b74`](https://github.com/wayne930242/Merlin-My-Pai/commit/8ea0b7435d7e8492ec47f7cbee03e7b617b501b2))


## v1.5.7 (2026-01-01)

### Bug Fixes

- Restore --verbose flag and fix duplicate notification icons
  ([`8d86fb9`](https://github.com/wayne930242/Merlin-My-Pai/commit/8d86fb9d3d5dedd5f208a263a94f4db374587ae8))


## v1.5.6 (2026-01-01)

### Bug Fixes

- Correct SSH key extraction in deploy workflow
  ([`3c2ab03`](https://github.com/wayne930242/Merlin-My-Pai/commit/3c2ab037a03d6585bdc83f05d51a40728206118f))


## v1.5.5 (2026-01-01)

### Bug Fixes

- Improve hook notifications with more details
  ([`0683ff8`](https://github.com/wayne930242/Merlin-My-Pai/commit/0683ff830aaf0fa01b39fbe0dff05c5d3c8370e7))

- Move settings.json to workspace/.claude and remove session notify
  ([`f115978`](https://github.com/wayne930242/Merlin-My-Pai/commit/f115978da174f24983aec25653ab33413da86a04))

### Refactoring

- Move CLAUDE.md and scripts to workspace, update projectDir
  ([`90dccc9`](https://github.com/wayne930242/Merlin-My-Pai/commit/90dccc99affc2d51945613ba5f404737d9dee180))


## v1.5.4 (2026-01-01)

### Bug Fixes

- Correct hooks config structure and remove verbose flags
  ([`f112b80`](https://github.com/wayne930242/Merlin-My-Pai/commit/f112b805583bc642fa5734325dfe3c08e99b7762))


## v1.5.3 (2026-01-01)

### Bug Fixes

- Correct semantic-release changelog config section
  ([`c8fb7ec`](https://github.com/wayne930242/Merlin-My-Pai/commit/c8fb7ecc318ebe1bfc67d60dec3c2edf9b58d670))


## v1.5.2 (2026-01-01)

### Bug Fixes

- Enable push in semantic-release to update CHANGELOG.md
  ([`ba6ba27`](https://github.com/wayne930242/Merlin-My-Pai/commit/ba6ba279c0080019a02b0ec2a33c2a046f31eaec))


## v1.5.1 (2026-01-01)

### Bug Fixes

- Update semantic-release config for uv.lock and changelog
  ([`2f99856`](https://github.com/wayne930242/Merlin-My-Pai/commit/2f99856c4962039060baa2788ebca2bde4133255))


## v1.5.0 (2026-01-01)

### Features

- Add configurable timezone support
  ([`09e15fc`](https://github.com/wayne930242/Merlin-My-Pai/commit/09e15fc7ac2ecb20911b432e5fd0e5a6751fd51d))


## v1.4.1 (2026-01-01)

### Bug Fixes

- Correct server IP extraction in deploy workflow
  ([`31ebab1`](https://github.com/wayne930242/Merlin-My-Pai/commit/31ebab1c59620d77ad6179bbfa0a5c9eaf612d1f))


## v1.4.0 (2026-01-01)

### Features

- Add Google Tasks API support
  ([`7e98c47`](https://github.com/wayne930242/Merlin-My-Pai/commit/7e98c47ebbc41a0df265c97f0e54d6e84e6a035e))


## v1.3.0 (2026-01-01)

### Features

- Add memory soft delete and MCP tools for agent
  ([`7b00e17`](https://github.com/wayne930242/Merlin-My-Pai/commit/7b00e1738aad1f103e535721853f7a98f5c7371a))


## v1.2.0 (2026-01-01)

### Bug Fixes

- Add sqlite-vec to dependencies
  ([`d5f09b0`](https://github.com/wayne930242/Merlin-My-Pai/commit/d5f09b0e3748cb0bb2171e1b95166aa187fdc95d))

- Correct SQL parameter count in findSimilar
  ([`e5406fe`](https://github.com/wayne930242/Merlin-My-Pai/commit/e5406fe6241a9e68f273d643c9a8a751cf74eb7c))

- Use L2 distance threshold for deduplication
  ([`895603b`](https://github.com/wayne930242/Merlin-My-Pai/commit/895603b04271fd9859891233e7a6aef5dfe13a06))

### Chores

- Add gemini api key and enable memory/fabric
  ([`892b6be`](https://github.com/wayne930242/Merlin-My-Pai/commit/892b6bee27929e7861a015ac2975b3389e25e737))

- Adjust dedup threshold to 8.0
  ([`2b840fb`](https://github.com/wayne930242/Merlin-My-Pai/commit/2b840fb58d1aad3dc36b29257de3b7018d18d2a1))

- Ignore session-env directory
  ([`4de4537`](https://github.com/wayne930242/Merlin-My-Pai/commit/4de4537bedc367229a3c69df043f571e8d911a43))

- Upgrade vultr plan to 2gb ram
  ([`feb56a2`](https://github.com/wayne930242/Merlin-My-Pai/commit/feb56a25e72768708c8335c45585a228df753d35))

- Use latest haiku model alias
  ([`d03d60f`](https://github.com/wayne930242/Merlin-My-Pai/commit/d03d60ffb16c4b5b8de6b99204d44a4228a16651))

### Features

- Add Gemini 2.5 Flash support for memory extraction
  ([`5205c49`](https://github.com/wayne930242/Merlin-My-Pai/commit/5205c497ad979e53864fbf33094f864545f4cb2f))

- Add long-term memory system with sqlite-vec
  ([`28c7b48`](https://github.com/wayne930242/Merlin-My-Pai/commit/28c7b4876c135c65f31f5133de57412caccd0598))

- Add mutagen sync toggle for deploy-claude
  ([`2952e4e`](https://github.com/wayne930242/Merlin-My-Pai/commit/2952e4e9c7bbe10828cf9515e846faf2f5221f5f))

- Add Ollama installation for local embedding
  ([`f27428a`](https://github.com/wayne930242/Merlin-My-Pai/commit/f27428a4622a1f8e596eb87c9556d692690cb3c4))

- Add vault config for memory and fabric enable/disable
  ([`390aa76`](https://github.com/wayne930242/Merlin-My-Pai/commit/390aa767c871357a302f2e6667dceb707d13b489))

### Refactoring

- Use Haiku for memory extraction, disable expiry
  ([`1354e30`](https://github.com/wayne930242/Merlin-My-Pai/commit/1354e307bc82bdb7d1e55a97728bc91236ff3730))

### Testing

- Add config module tests
  ([`5990f59`](https://github.com/wayne930242/Merlin-My-Pai/commit/5990f596961dcb3fd2daec18ab8d4bcdd37bdda3))

- Add memory system integration test
  ([`f3e2846`](https://github.com/wayne930242/Merlin-My-Pai/commit/f3e2846247332a3f73ca9b7735de32fa05918575))

- Add unit tests for setup module
  ([`df5b981`](https://github.com/wayne930242/Merlin-My-Pai/commit/df5b981dead007dac2aad63f945650e8422c1152))


## v1.1.2 (2026-01-01)

### Bug Fixes

- Correct semantic-release changelog config section
  ([`d2f9ca8`](https://github.com/wayne930242/Merlin-My-Pai/commit/d2f9ca8f47ebb7465e84e3097dccbf91a1498c96))

### Performance Improvements

- Optimize deploy-claude with pipelining and single mkdir
  ([`7d39f78`](https://github.com/wayne930242/Merlin-My-Pai/commit/7d39f78e298f5f4552d7645494d9dd2d51fba21a))


## v1.1.1 (2026-01-01)

### Performance Improvements

- Optimize deploy pipeline with uv cache and bun lockfile hash
  ([`93bb23d`](https://github.com/wayne930242/Merlin-My-Pai/commit/93bb23d15161c4a04cc941d9454e13c79338ddbe))


## v1.1.0 (2026-01-01)

### Bug Fixes

- Update semantic-release changelog config for v10 compatibility
  ([`76a2cd9`](https://github.com/wayne930242/Merlin-My-Pai/commit/76a2cd97fce20edd2c4bbd8ca018f798f93a1b3b))

### Features

- **scheduler**: Add execution logs, update tool, and error notifications
  ([`952776a`](https://github.com/wayne930242/Merlin-My-Pai/commit/952776a5e1ee1c60920f035d2d8784257f5bbcd9))

### Refactoring

- Move workspace gitignore rules to local file
  ([`83fd538`](https://github.com/wayne930242/Merlin-My-Pai/commit/83fd538702a851fdc35af05d40aea6be3f7a391e))


## v1.0.1 (2026-01-01)

### Bug Fixes

- Correct semantic-release workflow
  ([`c414b9b`](https://github.com/wayne930242/Merlin-My-Pai/commit/c414b9bdafb272426bbca3e25a94069a2e3ac2ad))


## v1.0.0 (2026-01-01)

- Initial Release
