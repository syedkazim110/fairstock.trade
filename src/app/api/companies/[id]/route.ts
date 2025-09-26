import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const companyId = id

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user is the owner of the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, created_by')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.created_by !== user.id) {
      return NextResponse.json({ error: 'Only company owners can delete companies' }, { status: 403 })
    }

    // Delete the company (CASCADE will handle related records)
    const { data: deleteData, error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)
      .select()

    console.log('Delete operation result:', { deleteData, deleteError })

    if (deleteError) {
      console.error('Error deleting company:', deleteError)
      return NextResponse.json({ error: `Failed to delete company: ${deleteError.message}` }, { status: 500 })
    }

    if (!deleteData || deleteData.length === 0) {
      console.error('No company was deleted - possibly due to RLS policies')
      return NextResponse.json({ error: 'Company could not be deleted - check permissions' }, { status: 500 })
    }

    // Log the deletion for audit purposes
    console.log(`Company deleted: ${company.name} (${companyId}) by user ${user.id}`, {
      timestamp: new Date().toISOString(),
      deletedData: deleteData
    })

    return NextResponse.json({ 
      message: 'Company deleted successfully',
      deletedCompany: deleteData[0]
    })

  } catch (error) {
    console.error('Unexpected error deleting company:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET method to retrieve company details (if needed)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const companyId = id

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get company details with user access check
    const { data: company, error: companyError } = await supabase
      .from('user_accessible_companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    return NextResponse.json(company)

  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
