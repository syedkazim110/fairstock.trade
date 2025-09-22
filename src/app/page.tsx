import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to login page as the entry point
  redirect('/auth/login')
}
