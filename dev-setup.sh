#!/bin/bash

# FairStock Development Setup Script
# This script helps set up the development environment

echo "🚀 FairStock Development Setup"
echo "================================"

# Check if Docker is installed
if command -v docker &> /dev/null; then
    echo "✅ Docker found"
    
    echo "🔧 Starting SMTP4dev for email testing..."
    echo "This will run SMTP4dev on:"
    echo "  - Web interface: http://localhost:3001"
    echo "  - SMTP server: localhost:2525"
    
    # Stop any existing SMTP4dev container
    docker stop smtp4dev 2>/dev/null || true
    docker rm smtp4dev 2>/dev/null || true
    
    # Start SMTP4dev
    docker run -d \
        --name smtp4dev \
        -p 3001:80 \
        -p 2525:25 \
        rnwood/smtp4dev
    
    echo "✅ SMTP4dev started successfully!"
    echo "📧 Access the email interface at: http://localhost:3001"
    
else
    echo "⚠️  Docker not found. You can install SMTP4dev with .NET instead:"
    echo "   dotnet tool install -g Rnwood.Smtp4dev"
    echo "   smtp4dev"
fi

echo ""
echo "📋 Next steps:"
echo "1. Create a Supabase project at https://supabase.com"
echo "2. Update .env.local with your Supabase credentials"
echo "3. Run the database-schema.sql in Supabase SQL Editor"
echo "4. Configure Supabase SMTP settings (optional, for SMTP4dev):"
echo "   - Host: localhost"
echo "   - Port: 2525"
echo "   - No username/password needed"
echo "5. Start the development server: npm run dev"
echo ""
echo "🔗 Useful links:"
echo "   - Supabase Dashboard: https://supabase.com/dashboard"
echo "   - SMTP4dev Interface: http://localhost:3001"
echo "   - Your App: http://localhost:3000"
echo ""
echo "Happy coding! 🎉"
