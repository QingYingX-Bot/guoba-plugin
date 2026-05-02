# Codex Instructions - Guoba-Plugin

## Project Overview

Guoba-Plugin is a Yunzai-Bot management panel plugin. The plugin body is plain JavaScript using ES Modules. The web panel source is a nested independent repository in `guoba-plugin-web/`; generated frontend assets live in `server/static/`.

## Project Structure

- `index.js`: Yunzai plugin entry.
- `main.js`: AlemonJS entry.
- `apps/`: chat-side commands, including help, login, update, and V2 adapter commands.
- `adapter/`: Yunzai, TRSS, and Miao compatibility layer.
- `framework/`: internal lightweight controller/service framework.
- `server/`: management panel backend.
- `models/`: aggregated exports for `#guoba.*` import aliases.
- `utils/`: shared plugin utilities.
- `lib/`: independent helper libraries still used at runtime.
- `defSet/`: default configuration templates.
- `config/`: local runtime configuration, ignored by git.
- `resources/images/`: image assets still used by README/help/icon flows.
- `docs/`: maintenance docs and issue progress.
- `scripts/maintenance/`: maintenance scripts.
- `guoba-plugin-web/`: separate frontend source repository.

Keep this file aligned with `docs/PROJECT_STRUCTURE.md` when directories move.

## Import Aliases

Aliases are defined in `package.json` `imports`:

- `#guoba.platform` -> `./models/platform.js`
- `#guoba.utils` -> `./models/utils.js`
- `#guoba.libs` -> `./models/libs.js`
- `#guoba.adapter` -> `./adapter/index.js`
- `#guoba.framework` -> `./framework/index.js`
- `#guoba.framework.utils` -> `./framework/src/utils/common.js`

Prefer established aliases for cross-module imports. Use relative imports for nearby implementation details.

## Backend Guidelines

- Controllers extend `ApiController` and register routes in `registerRouters()`.
- Services are injected with `autowired('lowerCamelServiceName')`.
- Use `Result.ok()`, `Result.error()`, `Result.noLogin()`, and `Result.noAuth()` for API responses.
- Throw `GuobaError` for business errors that should be returned to the user.
- Global runtime objects such as `redis`, `logger`, `Bot`, `plugin`, and `segment` are provided by Yunzai.

## Frontend Guidelines

- Edit frontend source in `guoba-plugin-web/`, not `server/static/`.
- `server/static/` is generated output. Rebuild/sync from `guoba-plugin-web` when frontend changes need to ship.
- `guoba-plugin-web/` has its own git state; check status in both repositories.
- For frontend API/type changes, run `pnpm -F @vben/web-antd run typecheck` from `guoba-plugin-web/`.

## Configuration Guidelines

- Default config lives in `defSet/application.yaml`.
- Local runtime config lives in `config/application.yaml` and is ignored by git.
- Visual config schema lives in `guoba.support.js`.
- When adding or removing a config key, update `defSet/application.yaml`, `guoba.support.js`, and local `config/application.yaml` if local runtime cleanup is needed.
- Do not re-add removed legacy keys such as `base.city` or `base.checkUpdate`.

## Active Feature Boundaries

Keep these active routes and flows:

- `/helper/transit`: plugin index README image/link proxying; intentionally public in `TokenInterceptor`.
- `/helper/release_port`: localhost-only port release used by `server/helper/listen.js`.
- `/plugin/miao/**`: Miao help/theme/backup configuration pages.
- `/home/dashboard`: current home dashboard API.
- `#锅巴版本`, `#锅巴更新`, and `#锅巴强制更新`: manual update commands.

Do not restore removed legacy features:

- Weather lookup and `resources/json/city.json`.
- Old `/home/data` dashboard summary API and frontend `getHomeDataApi` / `GuobaHomeData`.
- Old `/home/random-image` Miao random character image endpoint and `resources/images/no-miao.png`.
- Guoba's own disabled automatic update check flow: `base.checkUpdate`, `doCheckUpdate`, `doAutoUpdate`, `doUpdateTask`, and `lib/compareVersions.js`.
- Old `components/Changelog.js` / chat changelog parsing component.

Yunzai itself provides broad automatic update support through `plugins/other/update.js` and `bot.update_time` / `bot.update_cron`; Guoba only keeps manual update commands.

## Verification

For backend-only changes, prefer targeted syntax checks:

```bash
node --check apps/update.js
node --check server/controller/HelperController.js
node --check server/controller/system/HomeController.js
node --check server/service/both/HelperService.js
git diff --check
```

For frontend API/type changes:

```bash
cd guoba-plugin-web
pnpm -F @vben/web-antd run typecheck
git diff --check
```

When cleaning routes, search both backend and frontend source. Exclude `server/static/` unless intentionally checking generated output.
