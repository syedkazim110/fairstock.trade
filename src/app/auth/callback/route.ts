import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const redirectTo = searchParams.get('redirectTo')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if user has a profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_completed')
          .eq('id', user.id)
          .single()

        // If no profile exists or profile is not completed, redirect to profile setup
        // But preserve the redirectTo parameter for after profile setup
        if (!profile || !profile.profile_completed) {
          const profileSetupUrl = new URL('/auth/profile-setup', origin)
          if (redirectTo) {
            profileSetupUrl.searchParams.set('redirectTo', redirectTo)
          }
          return NextResponse.redirect(profileSetupUrl.toString())
        }
        
        // If profile is completed, redirect to the intended destination or dashboard
        const destination = redirectTo || '/dashboard'
        return NextResponse.redirect(`${origin}${destination}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
