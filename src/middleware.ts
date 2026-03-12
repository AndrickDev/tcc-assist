import { auth } from "@/lib/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Protect /dashboard and all its sub-routes
  if (pathname.startsWith('/dashboard')) {
    if (!isLoggedIn) {
      return Response.redirect(new URL('/login', req.nextUrl));
    }
  }

  // Optional: Redirect logged-in users away from /login
  if (pathname === '/login' || pathname === '/register') {
    if (isLoggedIn) {
      return Response.redirect(new URL('/dashboard', req.nextUrl));
    }
  }
})

// Specify the paths where the middleware should run
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
