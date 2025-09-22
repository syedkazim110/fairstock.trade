# FairStock - Dutch Auction Platform

A modern Dutch auction platform built with Next.js, Supabase, and Tailwind CSS, featuring magic link authentication.

## Features

- 🔐 **Magic Link Authentication** - Passwordless login via email
- 👤 **User Profile Management** - Complete profile setup for new users
- 🏠 **Dashboard** - User-friendly dashboard for authenticated users
- 🔒 **Secure** - Row Level Security (RLS) with Supabase
- 📱 **Responsive** - Mobile-first design with Tailwind CSS
- ⚡ **Fast** - Built with Next.js 15 and Turbopack

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth)
- **Hosting**: Hetzner Cloud (planned)
- **AI Integration**: OpenAI API (planned)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Hetzner Cloud account (for deployment)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd fairstock
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Go to SQL Editor and run the contents of `database-schema.sql`
4. Configure authentication:
   - Go to Authentication > Settings
   - Enable email authentication
   - Configure email templates for magic links
   - Set site URL to `http://localhost:3000` (development) or your production URL

#### Optional: Using SMTP4dev for Local Email Testing

If you want to use SMTP4dev for testing emails locally:

1. **Install and run SMTP4dev:**
   ```bash
   # Using Docker
   docker run -p 3001:80 -p 2525:25 rnwood/smtp4dev
   
   # Or install globally with .NET
   dotnet tool install -g Rnwood.Smtp4dev
   smtp4dev
   ```

2. **Configure Supabase SMTP settings:**
   - In Supabase dashboard, go to **Settings** > **Auth**
   - Scroll down to **SMTP Settings**
   - Enable **Enable custom SMTP**
   - Configure:
     - **Host**: `localhost` (or your Docker host IP)
     - **Port**: `2525`
     - **Username**: (leave empty)
     - **Password**: (leave empty)
     - **Sender name**: `FairStock`
     - **Sender email**: `noreply@fairstock.local`

3. **Access SMTP4dev interface:**
   - Open `http://localhost:3001` to view captured emails
   - All magic link emails will appear here instead of being sent to real email addresses

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration (for future use)
OPENAI_API_KEY=your_openai_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
fairstock/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/          # Magic link login page
│   │   │   ├── callback/       # Auth callback handler
│   │   │   ├── profile-setup/  # New user profile setup
│   │   │   └── signout/        # Sign out handler
│   │   ├── dashboard/          # User dashboard
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page (redirects to login)
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts       # Browser Supabase client
│   │       └── server.ts       # Server Supabase client
│   └── middleware.ts           # Auth middleware
├── database-schema.sql         # Database setup SQL
├── .env.local                  # Environment variables
└── README.md                   # This file
```

## Authentication Flow

1. **User visits the site** → Redirected to `/auth/login`
2. **User enters email** → Magic link sent via Supabase Auth
3. **User clicks magic link** → Redirected to `/auth/callback`
4. **Callback processes auth** → Checks if profile exists
   - **New user** → Redirected to `/auth/profile-setup`
   - **Existing user** → Redirected to `/dashboard`
5. **Profile setup** → User completes profile → Redirected to `/dashboard`

## Database Schema

The application uses the following main table:

### `profiles`
- `id` (UUID) - References auth.users(id)
- `email` (TEXT) - User's email address
- `full_name` (TEXT) - User's full name
- `company` (TEXT) - Optional company name
- `phone` (TEXT) - Optional phone number
- `profile_completed` (BOOLEAN) - Whether profile setup is complete
- `created_at` / `updated_at` (TIMESTAMP) - Audit fields

## Deployment

### Hetzner Cloud Setup

1. Create a Hetzner Cloud server
2. Install Node.js and PM2
3. Set up domain and SSL certificate
4. Configure environment variables for production
5. Deploy the application

```bash
# Build the application
npm run build

# Start with PM2
pm2 start npm --name "fairstock" -- start
```

### Environment Variables for Production

Update your `.env.local` for production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
OPENAI_API_KEY=your_openai_api_key
```

## Security Features

- **Row Level Security (RLS)** - Users can only access their own data
- **Magic Link Authentication** - No passwords to compromise
- **CSRF Protection** - Built-in Next.js protection
- **Secure Cookies** - HTTP-only cookies for session management
- **Environment Variables** - Sensitive data stored securely

## Future Features

- Dutch auction creation and management
- Real-time bidding system
- AI-powered auction recommendations
- Payment integration
- Email notifications
- Mobile app

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@fairstock.com or create an issue in the repository.
