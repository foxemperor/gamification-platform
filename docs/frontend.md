# Frontend: Руководство разработчика
## Gamification Platform — React/TypeScript

> **Ветка с последними изменениями:** `feature/frontend-auth`  
> **Актуальное состояние:** страница авторизации/регистрации полностью готова, Dashboard — заглушка.

---

## 1. Технологический стек

| Инструмент | Версия | Назначение |
|---|---|---|
| React | 18 | UI-фреймворк |
| TypeScript | 5.x | Строгая типизация |
| Vite | 5.x | Сборщик, dev-сервер |
| React Router | v6 | Маршрутизация |
| Zustand | 4.x | Глобальное состояние |
| Axios | 1.x | HTTP-клиент |
| CSS Modules | — | Изолированные стили |

**Намеренно не используется:**
- Redux/MobX — Zustand достаточно для текущего масштаба
- Styled-components/Emotion — CSS Modules + Custom Properties дают всё нужное без runtime-overhead
- UI-библиотеки (MUI, Ant Design) — кастомный дизайн, иконки из Feather Icons

---

## 2. Структура директорий

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/
│   │   ├── axios.ts        # Настройка axios: базовый URL, токены, авто-рефреш 401
│   │   └── auth.ts         # authApi: login(), register(), refreshToken(), getMe()
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx          # Форма входа
│   │   │   ├── RegisterForm.tsx       # Форма регистрации
│   │   │   └── AuthForm.module.css    # Стили форм
│   │   ├── ui/
│   │   │   ├── Button.tsx             # Кнопка (primary/ghost/danger)
│   │   │   ├── Button.module.css
│   │   │   ├── Input.tsx              # Поле ввода с иконкой и ошибкой
│   │   │   ├── Input.module.css
│   │   │   ├── Toast.tsx              # Toast-уведомления
│   │   │   ├── Toast.module.css
│   │   │   └── FeatherIcons.tsx       # SVG-иконки (Feather Icons subset)
│   │   └── ProtectedRoute.tsx        # HOC: редирект на /auth если не авторизован
│   │
│   ├── hooks/
│   │   ├── useAuth.ts      # useLogin(), useRegister() — хуки для форм авторизации
│   │   └── useToast.ts     # useToast() — стейт toast-уведомлений
│   │
│   ├── pages/
│   │   └── AuthPage.tsx    # Страница /auth — табы Войти/Регистрация
│   │
│   ├── store/
│   │   ├── authStore.ts    # Zustand: user, accessToken, refreshToken, isAuthenticated
│   │   └── themeStore.ts   # Zustand: текущая тема, setTheme()
│   │
│   ├── styles/
│   │   ├── globals.css     # Сброс стилей, базовые правила
│   │   └── themes.css      # CSS Custom Properties для 3 тем
│   │
│   ├── App.tsx             # Роуты, ToastProvider, тема
│   └── main.tsx            # Точка входа React
│
├── index.html              # Шаблон HTML с anti-flash inline-скриптом
├── vite.config.ts          # Vite: proxy, CSP-заголовки, code splitting
├── tsconfig.json
└── package.json
```

---

## 3. Архитектурные решения и «почему так»

### 3.1 Токены в памяти, не в localStorage

```typescript
// store/authStore.ts
setTokens: (accessToken, refreshToken) => {
  // Намеренно: только Zustand-стейт, без localStorage/sessionStorage
  set({ accessToken, refreshToken, isAuthenticated: true })
}
```

**Почему:** XSS-атака может прочитать `localStorage`, но не может получить переменные в памяти JS-модуля. Компромисс: при F5 пользователь выходит из системы (пока не реализован `httpOnly cookie` для refresh-токена на бэкенде).

### 3.2 Авто-рефреш токена (перехватчик 401)

```typescript
// api/axios.ts
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true  // флаг предотвращает бесконечную рекурсию
      try {
        // обновить токены...
        return api(original)  // повторить исходный запрос
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/auth'
      }
    }
    return Promise.reject(error)
  },
)
```

**Как это работает:** если любой запрос вернул 401 (токен истёк), перехватчик автоматически вызывает `/auth/refresh`, обновляет токены в сторе и повторяет исходный запрос. Пользователь ничего не замечает.

### 3.3 AbortController — защита от утечек памяти

```typescript
// В LoginForm.tsx и RegisterForm.tsx
const abortRef = useRef<AbortController | null>(null)

useEffect(() => {
  return () => { abortRef.current?.abort() }  // cleanup при размонтировании
}, [])

const handleSubmit = () => {
  abortRef.current?.abort()   // отменить предыдущий in-flight запрос
  abortRef.current = new AbortController()
  login(payload, abortRef.current.signal)
}
```

**Зачем:** если пользователь быстро переключается между табами или навигирует, React размонтирует компонент. Без AbortController завершившийся запрос вызовет `setState` на мёртвом компоненте → warning в консоли и потенциальная утечка памяти.

### 3.4 Глобальный Toast через React Context

```typescript
// App.tsx
const ToastCtx = createContext<ToastFn>(() => {})
export const useAppToast = () => useContext(ToastCtx)
```

Любой компонент в дереве может вызвать `toast()` не прокидывая пропсы:

```typescript
const toast = useAppToast()
toast('Что-то пошло не так', 'error')       // красный
toast('Функция в разработке', 'info')        // синий
toast('Сохранено!', 'success')               // зелёный
toast('Бэкенд не готов', 'warning')          // жёлтый
```

### 3.5 Система тем через CSS Custom Properties

Тема не перерисовывает React-компоненты. Она работает на уровне DOM:

```typescript
// App.tsx
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme)
}, [theme])
```

```css
/* styles/themes.css */
:root, [data-theme="aurora"] {
  --primary: #22d3ee;
  --grad-btn: linear-gradient(135deg, #22d3ee, #a78bfa);
  /* ... */
}
[data-theme="obsidian"] {
  --primary: #f59e0b;
  --grad-btn: linear-gradient(135deg, #f59e0b, #14b8a6);
}
[data-theme="ivory"] {
  --primary: #3b82f6;
  --grad-btn: linear-gradient(135deg, #3b82f6, #38bdf8);
}
```

Переключение темы = один вызов `setAttribute` = нулевой re-render React.

---

## 4. Компоненты UI-библиотеки

### Button

```tsx
import { Button } from './components/ui/Button'

<Button>Сохранить</Button>                    // primary (по умолчанию)
<Button variant="ghost">Отмена</Button>        // прозрачный с рамкой
<Button variant="danger">Удалить</Button>      // красный
<Button loading={true}>Загрузка...</Button>    // заблокирован + спиннер
<Button disabled>Недоступно</Button>
```

**Контраст кнопок по темам:**
- Aurora / Obsidian: белый текст + `text-shadow` для читаемости на градиенте
- Ivory: тёмный текст `#0f172a` (светлый градиент)

### Input

```tsx
import { Input } from './components/ui/Input'
import { IconMail } from './components/ui/FeatherIcons'

<Input
  label="Email"
  iconNode={<IconMail size={15} />}   // SVG-иконка слева
  placeholder="your@company.com"
  type="email"
  value={value}
  error={errorMessage}                // красная подпись снизу
  onChange={handler}
  rightSlot={<button>...</button>}    // любой элемент справа (eye-toggle)
/>
```

### FeatherIcons

```tsx
import {
  IconMail,    // конверт — email/логин
  IconLock,    // замок — пароль
  IconUser,    // силуэт — имя/фамилия
  IconAtSign,  // @ — email (альтернатива)
  IconGamepad, // геймпад — username
  IconEye,     // открытый глаз — показать пароль
  IconEyeOff,  // перечёркнутый глаз — скрыть пароль
} from './components/ui/FeatherIcons'

// Использование:
<IconMail size={16} className={styles.icon} />
```

---

## 5. Авторизационный флоу (step-by-step)

```
1. Пользователь открывает /auth
   └── AuthPage рендерит табы [Войти | Регистрация]

2. Вход:
   LoginForm → handleSubmit()
   → validate() — клиентская проверка полей
   → login(payload, signal)  [hooks/useAuth.ts]
   → authApi.login(payload, signal)  [api/auth.ts]
   → POST /api/v1/auth/login
   → setTokens() + setUser()  [store/authStore.ts]
   → navigate('/dashboard')

3. Регистрация:
   RegisterForm → handleSubmit()
   → validate() — EMAIL_RE, min_length, agree checkbox
   → register({ ...fields, role: 'employee' }, signal)
   → POST /api/v1/auth/register
   → success: показать экран поздравления
   → navigate('/dashboard')

4. Защищённый маршрут:
   <ProtectedRoute> проверяет isAuthenticated из authStore
   Если false → <Navigate to="/auth" replace />
```

---

## 6. Валидация форм

Вся валидация — **клиентская**, выполняется в `validate()` до отправки запроса:

| Поле | Правило |
|---|---|
| `first_name`, `last_name` | Не пустое |
| `email` | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` |
| `username` | Минимум 3 символа |
| `password` | Минимум 8 символов |
| `agree` | Чекбокс должен быть отмечен |

Поле пароля дополнительно показывает **индикатор силы** (4 сегмента, Power Bar):
- 🔴 Очень слабый — менее 8 символов
- 🟡 Слабый — только строчные/цифры
- 🔵 Хороший — есть заглавные + цифры
- 🟢 Надёжный — есть спецсимвол

---

## 7. Временные заглушки (TODO)

Следующие места содержат toast-заглушки вместо реального функционала:

```typescript
// LoginForm.tsx — кнопка "Войти в систему"
const handleSubmit = () => {
  // TEMPORARY: бэкенд ещё не обновлён
  toast('🛠️ Авторизация в разработке. Бэкенд ещё не готов.', 'warning')
  // TODO: раскомментировать когда Auth Service обновят:
  // login({ username, password }, abortRef.current.signal)
}

// Кнопки Microsoft и SSO
<button onClick={() => toast('🔷 Microsoft — в разработке', 'info')}>Microsoft</button>
```

**Что нужно сделать чтобы «включить» реальный логин:**
1. Обновить Auth Service — добавить поля `first_name`, `last_name`, `theme_preference` в модель User
2. В `LoginForm.tsx` и `RegisterForm.tsx` убрать `toast(...)` и раскомментировать 3 строки с `login()`/`register()`

---

## 8. Добавление новой страницы (пример)

Предположим, нужно добавить страницу `/quests`.

**Шаг 1 — создать страницу** (`src/pages/QuestsPage.tsx`):
```tsx
export function QuestsPage() {
  return <div>Квесты</div>
}
```

**Шаг 2 — добавить маршрут** (`src/App.tsx`):
```tsx
import { QuestsPage } from './pages/QuestsPage'

// Внутри <Routes>:
<Route path="/quests" element={
  <ProtectedRoute><QuestsPage /></ProtectedRoute>
} />
```

**Шаг 3 — добавить API-вызов** (`src/api/gamification.ts`):
```typescript
import { api } from './axios'

export const gamificationApi = {
  listQuests: (page = 1, perPage = 20) =>
    api.get('/quests', { params: { page, per_page: perPage } }).then(r => r.data),
}
```

---

## 9. Сборка для production

```powershell
# Сборка
.\dev.ps1 ui:build
# Файлы появятся в frontend/dist/

# Или напрямую:
cd frontend
npm run build
```

Vite автоматически разбивает бандл на чанки:
- `vendor` — React, React DOM, React Router
- `state` — Zustand
- `network` — Axios

Это ускоряет повторные загрузки: браузер кэширует `vendor.js` и не перезагружает его при обновлении кода приложения.

---

## 10. Content Security Policy (CSP)

Для dev-сервера настроен в `vite.config.ts`:

```typescript
'Content-Security-Policy': [
  "default-src 'self'",
  "connect-src 'self' ws://localhost:3000 http://localhost:8000",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self' 'unsafe-inline'",  // нужен для Vite HMR
  "img-src 'self' data: https://avatars.githubusercontent.com",
  "frame-ancestors 'none'",
].join('; ')
```

Для production (Nginx) CSP нужно ужесточить: убрать `'unsafe-inline'` из `script-src` и использовать nonce.

---

*Актуально для `feature/frontend-auth`, апрель 2026.*
