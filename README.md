# Evolution

Русскоязычный MVP для небольших привычек питания, домашнего движения и восстановления. Next.js App Router + strict TypeScript, CSS Modules, Supabase Auth/Postgres/Storage/RLS, TanStack Query, Zustand, React Hook Form и Zod. Все основные операции доступны через `/api/v1/*`.

## Быстрый запуск

Нужен Node.js 24 LTS (24.15+) и npm 12.2+ (локальные проверки также прошли на 25.1).

```sh
npx --yes npm@12.2.0 ci
cp .env.example .env.local
npm run dev
```

Откройте http://localhost:3000. При пустых Supabase-переменных включается **явно обозначенное демо**. Это фиксированный каталог и изменения в памяти вкладки: задачи, check-in, избранное и сессии исчезают после перезагрузки. Серверный API в этом режиме возвращает `503 SUPABASE_NOT_CONFIGURED`, а не имитирует запись в БД. Демо-прогресс начинается с нуля и вычисляется по действиям в этой вкладке. Админ и реальная авторизация требуют Supabase.

## Что предоставить для Supabase

Создайте проект в своём Supabase аккаунте. В Project Settings → API/API Keys найдите:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=...
```

В `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` также допускается legacy `anon` key. Последняя переменная — **серверный** legacy `service_role` (или новый secret key); нужна только для удаления Auth-аккаунта. Без неё удаление возвращает `503 ACCOUNT_DELETION_NOT_CONFIGURED`. Не присылайте секреты в чат, не коммитьте `.env.local`, не добавляйте `NEXT_PUBLIC_` к elevated key. Обычные API используют публичный ключ и проверенную пользовательскую сессию; elevated key не участвует в чтении профиля и генерации планов. [Типы ключей Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Для применения миграций нужен доступ к SQL Editor проекта либо Supabase CLI и право изменять схему. Пароль базы не нужен приложению.

### Миграции из проекта

Добавьте `SUPABASE_DB_URL` в `.env.local`: PostgreSQL URI из Connect → Session pooler (с паролем БД, username `postgres.PROJECT_REF`). Этот секрет нужен только локальному применению миграций, не Vercel.

```sh
npm run db:prepare
npm run db:migrate
npm run supabase:status
npm run test:cloud:rls
```

Мигратор отслеживает шесть версий и checksums, применяет изменения транзакционно и добавляет seed. Повторный запуск пропускает применённые версии. Не редактируйте применённые миграции: добавляйте новую. `supabase/bootstrap.sql` — подготовленный пакет для SQL Editor. Cloud RLS-тест использует случайные временные UUID и откатывает все записи. `/api/v1/health` проверяет Auth, схему, каталоги и RLS без выдачи личных данных.

### Схема и seed через Dashboard

На **новом проекте**, в SQL Editor выполните последовательно файлы:

1. `supabase/migrations/202610140001_initial.sql`
2. `supabase/migrations/202610140002_admin_templates.sql`
3. `supabase/migrations/202610140003_preferences.sql`
4. `supabase/migrations/202610140004_assigned_templates.sql`
5. `supabase/migrations/202610140005_deployment_readiness.sql`
6. `supabase/migrations/202610140006_web_push.sql`
7. `supabase/seed.sql`

Миграции применяются один раз. Seed можно повторять: стабильные UUID и `ON CONFLICT DO NOTHING` сохраняют ссылки и ручные изменения контента. Содержимое `tests/postgres-bootstrap.sql` **никогда не применяйте к Supabase**: это тестовые заглушки схем `auth`/`storage` для отдельного локального PostgreSQL.

Альтернатива через установленный Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Затем выполните `supabase/seed.sql` в SQL Editor. Перед изменениями существующего проекта сделайте резервную копию. Для локального Supabase с Docker:

```sh
supabase start
supabase db reset
```

Скопируйте локальные URL/ключи из `supabase status` в `.env.local`, перезапустите Next.js.

### Авторизация

В Authentication → URL Configuration задайте Site URL: `http://localhost:3000` для разработки и production URL для запуска. Разрешите Redirect URLs:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=/reset-password`
- соответствующие два HTTPS-адреса production-домена.

Email/password включён; подтверждение email рекомендуется оставить включённым. Для PKCE-ссылок используйте оригинальный браузер, в котором начали регистрацию/сброс пароля. Настройте SMTP и проверьте реальные письма перед запуском: встроенная доставка имеет ограничения. Авторизация использует `@supabase/ssr`, cookie-сессию и проверку `auth.getUser()` на каждом API-запросе; Proxy обновляет сессию. [Документация Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).

После применения схемы зарегистрируйтесь, подтвердите email, войдите и пройдите onboarding. Он атомарно сохраняет профиль/предпочтения/время напоминаний и запускает программу. Существующие до миграции Auth-пользователи получают профиль при backfill.

### Администратор

Роль назначается владельцем проекта в SQL Editor, **никогда из браузера**:

```sql
update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
```

`/admin` предоставляет создание, обновление и деактивацию рецептов, упражнений и 30-дневных шаблонов через проверяемый JSON-редактор. Пример структуры берётся из seed; JSON проверяется Zod. При создании шаблона нужны `tasks` для всех 30 дней (минимум 3 задачи на день). Обновление шаблона/задач атомарное; старые планы сохраняют текстовые снимки задач. Запись защищена и API, и RLS. Bucket `catalog-images` предназначен только для публичных изображений каталога до 2 МБ; записывать в него может администратор. Загрузка медиа через отдельный интерфейс не входит в MVP: допустим безопасный HTTPS URL изображения/видео.

## Реализованные сценарии

- Landing, регистрация, вход, выход, восстановление/смена пароля и redirect callback.
- Onboarding в три шага: профиль/часовой пояс, цели/время, питание/аллергии, опыт/оборудование/исключения, безопасность и необязательная образовательная тема прохладной воды.
- Три 30-дневных шаблона, по 14 уникальных привычек питания; 24 рецепта, 30 упражнений, 8 комплексов с оригинальным русским текстом.
- Сегодня: 3–5 задач, подробности, выполнение/пропуск/возврат, check-in, объяснение адаптации. Повторная генерация атомарная, без дублей. Исторические планы доступны только для чтения; будущие не генерируются заранее.
- Питание: поиск/фильтр трека, аллергии, детали, избранное, агрегированный список покупок. При аллергиях текст привычки нейтрален; проверяйте состав реального продукта и перекрёстное загрязнение. Это справочник, не персональная медицинская диета.
- Движение: комплексы/упражнения, фильтры, техника/ошибки/альтернативы/предупреждения, таймер работы и отдыха с паузой/продолжением, журнал сессий. Упражнения, исключённые пользователем, не запускаются в плеере.
- Прогресс: недельное выполнение, активные дни, минуты, календарь задач, энергия/сложность, поддерживающие достижения. Показатели вычисляются из записей; минуты сессии — фактически прошедшее время таймера, округлённое вниз, и самоподтверждённые выполненные задачи. Одновременный учёт задачи и той же сессии не удваивается.
- Советы без внешнего AI, FAQ, редактирование настроек, экспорт JSON и полное удаление Auth-аккаунта с каскадным удалением личных таблиц.
- PWA, адаптивная навигация, доступные формы/диалоги, состояния загрузки/ошибки/отсутствия сети.

## Планировщик и ограничения

`src/domain/plan.ts` — независимая от Next/Supabase функция. Nutrition-задачи интегрированы в обычное питание и занимают 0 **дополнительных** минут; время рецепта показано отдельно. Сумма времени остальных задач не превышает бюджет (допуск 0 минут). Подбираются только опубликованные безопасные по предпочтениям записи. Малый бюджет получает короткое движение вместо длинного комплекса.

Последний check-in с низкой энергией/высокой сложностью снижает бюджет; боль/болезнь среди последних трёх check-in за 7 дней исключает физическую нагрузку и растяжку. Свободно указанные ограничения дают консервативный отдых; конкретные исключения убирают упражнения. Три лёгких check-in и ≥80% завершения позволяют небольшой следующий шаг (до +1 минуты движения от базового уровня) в пределах бюджета. Каждый седьмой день — восстановление. Через 30 локальных дней цикл завершается; новый цикл запускается вручную в «Программе», без бесконечного повторения дня 30. Пропущенные задачи не копятся. Настройки и check-in влияют на **следующий ещё не созданный** план; уже сгенерированный день не заменяется. `adaptation_reason` хранится машинным кодом. Аллергии сопоставляются с ингредиентами/тегами; пользователь должен использовать узнаваемые названия и проверять фактический состав.

Данные ограничений необязательны; только необходимый профиль, никаких рекламных SDK/телеметрии и логирования health payload. Cold-модуль только образовательный, после отдельного согласия; отключается в настройках. Нет назначения калорий, добавок, ледяных ванн или задержек дыхания. Прогресс по пропущенным дням не обнуляется.

## API

Ответ: `{data: ...}` или `{error:{code,message}}`. Ошибки: `401 UNAUTHORIZED`, `403 INVALID_ORIGIN/ADMIN_REQUIRED`, `404 NOT_FOUND`, `409 ONBOARDING_REQUIRED/HISTORY_READ_ONLY/PROGRAM_COMPLETED`, `422 VALIDATION_ERROR/INVALID_RANGE`, `503 SUPABASE_NOT_CONFIGURED/ACCOUNT_DELETION_NOT_CONFIGURED`. Тела проверяются Zod, пользователь определяется проверенной сессией; во всех приватных запросах проверяется ownership и RLS.

| Метод                       | Путь                                                              |
| --------------------------- | ----------------------------------------------------------------- |
| GET / PATCH                 | `/api/v1/me`                                                      |
| GET / PUT                   | `/api/v1/preferences`                                             |
| POST                        | `/api/v1/onboarding/complete`                                     |
| GET / POST                  | `/api/v1/program`, `/api/v1/program/start`                        |
| GET                         | `/api/v1/daily-plan?date=YYYY-MM-DD`                              |
| PATCH                       | `/api/v1/daily-tasks/:id` (`status`)                              |
| GET / PUT                   | `/api/v1/checkins?from=&to=`, `/api/v1/checkins/:date`            |
| GET                         | `/api/v1/recipes`, `/api/v1/recipes/:slug`                        |
| GET                         | `/api/v1/exercises`, `/api/v1/routines`, `/api/v1/routines/:slug` |
| GET                         | `/api/v1/progress?from=&to=`                                      |
| GET                         | `/api/v1/shopping-list?recipe_ids=UUID,UUID`                      |
| GET / PUT / DELETE          | `/api/v1/favorites`, `/api/v1/favorites/:recipe_id`               |
| POST                        | `/api/v1/sessions` (`routine_id`, `minutes`)                      |
| GET / POST                  | `/api/v1/data/export`, `/api/v1/data/delete`                      |
| GET / POST / PATCH / DELETE | `/api/v1/admin/{recipes,exercises,program_templates}[/:id]`       |

Каталоги поддерживают `limit` (1–100), `offset`, `search`, `track` для рецептов, `category` для движений. Даты и интервалы ограничены 366 днями; default 30 дней. User API использует `Cache-Control: private, no-store`. Для cookie-записей обязателен Origin того же сайта. Native bearer-запросы проходят реальную проверку `auth.getUser(token)` и тот же RLS: неверные токены не допускаются. CORS для сторонних WebView пока не включён.

## Проверки

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:demo
```

Vitest: план/бюджет/безопасность/даты/контент/прогресс, компоненты, API авторизация и права администратора. Playwright: критический демо-путь и onboarding на desktop и ширине 375px, серверный API без credentials. Облачные сценарии включаются отдельно (см. `tests/e2e/connected.spec.ts`): выделите два тестовых аккаунта в тестовом проекте и передайте `EVOLUTION_E2E_CONNECTED=1`, `EVOLUTION_TEST_EMAIL`, `EVOLUTION_TEST_PASSWORD`, `EVOLUTION_TEST_EMAIL_2`, `EVOLUTION_TEST_PASSWORD_2`. Без них connected-тесты **пропускаются**, а не выдаются за пройденные. Чтобы хранить тестовые пароли вне истории команд:

```sh
cp .env.e2e.example .env.e2e.local
# Заполните .env.e2e.local и Supabase keys в .env.local.
npm run build
node --env-file=.env.e2e.local node_modules/@playwright/test/cli.js test
```

Для проверки опубликованного приложения без тестовых аккаунтов:

```sh
EVOLUTION_TEST_BASE_URL=https://YOUR_DOMAIN npx playwright test tests/e2e/smoke.spec.ts
```

`.env.e2e.local` игнорируется Git. После изменения `NEXT_PUBLIC_*` обязательно пересоберите приложение.

SQL интеграционные проверки запускаются на **пустой временной** локальной базе, от её владельца:

```sh
EVOLUTION_TEST_DATABASE_URL='postgresql://localhost/evolution_test' node scripts/check-postgres.mjs
```

Они используют Supabase-совместимые тестовые `auth.uid()`/Storage-схемы и проверяют миграции/seed, RLS двух пользователей, недоступность чужих задач, защиту роли, каталог/админа и идемпотентность. Это проверка PostgreSQL, **не проверка реального Supabase Auth/доставки email**. Статус проведённых проверок — в `VERIFICATION.md`.

## Web Push и напоминания

Настройки → Уведомления: разрешите push на устройстве, включите напоминания и сохраните расписание. Доступны питание один раз в день и перерывы каждые 30/60/90/120 минут в выбранные рабочие часы; перерывы можно ограничить буднями. Часовой пояс берётся из профиля. В настройках есть настоящий тестовый push и отключение устройства. При выходе подписка текущего устройства отключается. При боли/болезни или указанных ограничениях вместо разминки предлагается спокойный перерыв. В тексте push нет личных медицинских подробностей.

В production настроены VAPID-ключи, worker credential в Supabase Vault и Supabase Cron каждые 5 минут. Cron вызывает защищённый `/api/v1/notifications/dispatch`; Vercel не требует постоянного процесса или платного frequent Cron. RLS защищает `push_settings` и `push_subscriptions`. У worker только узкие RPC с отдельным секретом, без service-role key. Очередь использует leases, уникальные слоты и до 3 попыток; недействительные подписки удаляются при HTTP 404/410. Доставка на устройство может задержаться или отсутствовать из-за разрешений, сети/OS. Опоздавшие более чем на 15 минут напоминания не накапливаются. Повтор после сбоя возможен; одинаковый notification tag заменяет прежнее уведомление.

Для другого окружения после миграций:

```sh
node --env-file=.env.local scripts/setup-push.mjs --generate --app-url https://YOUR_DOMAIN
node --env-file=.env.local scripts/setup-push.mjs
```

В Vercel Production добавьте `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, серверные `VAPID_PRIVATE_KEY` и `PUSH_WORKER_SECRET`. Не публикуйте private key/worker secret. `scripts/push-vercel-env.mjs` загружает только эти четыре переменные в текущий production-проект команды владельца. Не запускайте его для другого аккаунта без изменения scope. Setup сохраняет приватный hash в закрытой схеме и worker secret в Vault; функция claim не выдаёт данные без корректного секрета. `tests/push.sql` проверяет расписание, RLS, дедупликацию, безопасное восстановление и удаление истёкших подписок транзакционно.

На iPhone/iPad Web Push требует iOS 16.4+ и установки приложения на главный экран; откройте установленное приложение и разрешите уведомления кнопкой. На desktop/Android требуется поддерживающий Push API браузер и HTTPS. [Условия Web Push Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Supabase Cron и Vault](https://supabase.com/docs/guides/functions/schedule-functions).

## PWA

Манифест, оригинальная SVG-иконка и PNG 192/512, HTTPS на Vercel. Service Worker кэширует **только публичные** иконки и offline-страницу. Не кэширует authenticated HTML, API, токены, профиль или health данные. Полного offline-режима и фоновой синхронизации нет. Установка зависит от браузера; на iOS используйте «Поделиться → На экран Домой». Иконки можно пересоздать `node scripts/generate-icons.mjs`; текст fallback — `node --experimental-strip-types scripts/generate-offline.mjs`.

## Vercel

Production MVP опубликован: https://evolution-azure.vercel.app. Проект `evolution`, команда `sukhanovpavels-projects`. Исходники: https://github.com/SukhanovPavel/evolution. Vercel использует настройки из `vercel.json`, включая воспроизводимую установку npm 12.2.0.

Для этого домена в Supabase → Authentication → URL Configuration задайте:

- Site URL: `https://evolution-azure.vercel.app`
- Redirect URLs: `https://evolution-azure.vercel.app/auth/callback` и `https://evolution-azure.vercel.app/auth/callback?next=/reset-password`.

Ручной smoke: регистрация → подтверждение email → onboarding → выполнение задачи → перезагрузка (статус сохранён) → check-in → прогресс → выход/вход → восстановление пароля.

1. Загрузите репозиторий в Git-провайдер и импортируйте в Vercel как Next.js.
2. Node.js 24 (закреплён в package.json), install `npx --yes npm@12.2.0 ci`, build `npm run build`, output default.
3. Добавьте `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL` (HTTPS-домен приложения) в production env. Для удаления аккаунта дополнительно нужен серверный `SUPABASE_SERVICE_ROLE_KEY`. **Не переносите `SUPABASE_DB_URL` и `SUPABASE_ACCESS_TOKEN` в Vercel.** `NEXT_PUBLIC_*` фиксируются при сборке.
4. Примените миграции и seed к соответствующему Supabase-проекту до первого входа.
5. Укажите production Site URL/Redirect URLs в Auth. HTTPS обязателен для PWA.
6. Проверьте регистрацию/письма/вход/onboarding/повторную загрузку задач, две учётные записи и admin права в тестовом окружении.

[Vercel Hobby предназначен для личного некоммерческого использования](https://vercel.com/docs/plans/hobby). Перед коммерческим запуском перепроверьте тарифы, лимиты Vercel/Supabase и SMTP. Текущий статус деплоя и проверок — в `VERIFICATION.md`.

## Архитектура и будущий Capacitor

```text
src/app/                Next страницы, layout, /api/v1 HTTP adapter
src/server/api.ts       API dispatch, validation and authorization
src/components/         Web presentation, CSS Modules, UI primitives
src/domain/             Zod contracts, dates, plan engine, progress, localized seed
src/lib/repository.ts   Supabase data access / transactional plan storage
src/lib/supabase/       Browser/SSR clients
src/lib/api-client.ts   Typed JSON-envelope transport
src/lib/data.ts         Web data facade and explicitly marked demo adapter
src/i18n/               Russian dictionary and locale resolver
supabase/migrations/    Schema, RLS, transactional RPC
supabase/seed.sql       Original catalog/program data
public/                 PWA fallback, service worker and icons
scripts/                Asset generation, SQL verification
tests/                 Vitest, SQL and Playwright
```

Typed transport `createApiTransport({baseUrl,getAccessToken})` уже принимает HTTPS base URL и bearer token provider. Для Capacitor создайте отдельный статический/mobile frontend (например Vite), переиспользуя domain/contracts и typed API client с configurable HTTPS base URL. Next SSR и Route Handlers остаются на Vercel, **не выполняются в WebView**. Supabase native sessions получают access token; API проверяет его сервером и использует scoped bearer Supabase client, не service role. Перед включением WebView настройте CORS allowlist разрешённых app origins, безопасное OS-хранилище refresh token и redirect/deep links. Экранная логика отделена от DB; Server Actions не используются для core flows.

Отложено по ТЗ: native push, Health Connect/Apple Health, камера/AI-анализ еды, внешние AI APIs, публикация в app stores. Web Push добавлен после MVP по запросу владельца; native push остаётся будущей интеграцией. Нет постоянных процессов/локальных файлов для пользовательских данных на Vercel.
