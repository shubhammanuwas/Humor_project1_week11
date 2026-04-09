import LoginButtons from './login-buttons'

export default function LoginPage() {
  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel">
          <h1 className="title">Sign In</h1>
          <p className="subtitle">
            Continue with Google to access protected routes and API features.
          </p>
        </section>

        <section className="panel stack-sm">
          <p>This flow redirects to `/auth/callback` after OAuth.</p>
          <LoginButtons />
        </section>
      </div>
    </main>
  )
}
