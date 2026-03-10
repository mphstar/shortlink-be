# Shortlink Backend API

This is the backend service for the Shortlink application. Built with modern, lightweight web technologies to handle URL shortening, elegant redirection, and analytics.

---

## 🚀 Tech Stack

- **[Hono](https://hono.dev/)**: Ultrafast, lightweight web framework designed for Edge and Node.js.
- **[Drizzle ORM](https://orm.drizzle.team/)**: A highly performant, type-safe TypeScript ORM.
- **[SQLite (LibSQL)](https://turso.tech/libsql)**: Embedded database stored as a localized file (`data/shortlink.db`) — keeping things drastically fast and portable.
- **Node.js**: As target runtime utilizing `tsx` for optimal TypeScript experience.
- **Docker**: Simple container deployment.

---

## 📂 Project Structure

```text
src/
├── db/             # Database connection, schemas, and migrations
├── routes/         # Expressive API endpoints (Auth, Links, Analytics, Redirect)
├── utils/          # Helper utilities (auth hashing, user-agent parsing, code generation)
└── index.ts        # Application entry point, CORS, and global middlewares
```

---

## 🛠️ Setup & Development

### 1. Requirements

- Node.js version 20 or higher.
- `npm` for managing packages.

### 2. Installation

Clone this repository and install all dependencies:

```bash
npm install
```

### 3. Initialize the Database

Use Drizzle's push command to synchronize the TypeScript schema directly to your local SQLite database:

```bash
npm run db:push
```

*This command automatically creates the `data/` folder and the `shortlink.db` file.*

### 4. Start the Application

Start the local development server (it watches for file changes automatically using `tsx`):

```bash
npm run dev
```

The server will begin listening at `http://localhost:3001`!

---

## 🗄️ Database Management

To view and manage your data visually from the browser without any SQL commands, simply run Drizzle Studio:

```bash
npm run db:studio
```

---

## 🐳 Docker Deployment

The simplest and recommended way to deploy the application in production is using Docker Compose.

```bash
# Build and run the associated container in detached mode
docker compose up -d --build
```

### ⚠️ Important Note on Database Persistence:
The provided `docker-compose.yml` is thoughtfully configured to mount your local `./data` directory dynamically to `/app/data` inside the container. **This ensures that your SQLite database (`shortlink.db`) persists safely across container restarts, rebuilds, and crashes.**

---

## 🔑 Key Features Overview

- **Authentication** (`/api/auth/*`): Secure JSON Web Token (JWT) based login and registration.
- **Links Engine** (`/api/links/*`): Create, read, update, delete custom or randomly generated shortlinks.
- **Deep Analytics** (`/api/analytics/*`): Tracks clicks over time, capturing referer domains, browsers, OS, and devices via advanced User-Agent parsing silently.
- **SPA Redirection Proxy** (`/api/redirect/:code`): Specifically designed for modern Single Page Applications (SPA). Verifies link validity, records telemetry silently, and returns the destination securely to the frontend client for elegant UI redirection (preventing hard backend reloads).
